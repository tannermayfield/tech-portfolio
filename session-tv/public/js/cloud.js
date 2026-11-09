/* Supabase Auth + PostgREST. Application records never depend on the AI companion. */
(() => {
 'use strict';
 const config=globalThis.SessionTVConfig||{}, url=(config.supabaseUrl||'').replace(/\/$/,''), key=config.supabasePublishableKey||'';
 const configured=!!(url&&key), AUTH='sessiontv.auth.v1';
 let session=null, refreshTask=null, database=null, opening=null, refreshing=null, signingOut=false;
 const error=message=>dispatchEvent(new CustomEvent('sessiontv:error',{detail:message}));
 const rawStorage=()=>{try{return globalThis.SessionWorkspace?.originalStorage||globalThis.localStorage;}catch{return null;}};
 async function request(route,{method='GET',body,auth=true}={}){
  if(!configured)throw new Error('Configure Supabase public credentials to use My Workspace.');
  if(auth){await refresh();if(!session?.access_token)throw new Error('Sign in to your private workspace first.');}
  const response=await fetch(url+route,{method,headers:{apikey:key,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+session.access_token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const text=await response.text();let data;try{data=text?JSON.parse(text):null}catch{throw new Error('Supabase returned an invalid response.');}
  if(!response.ok)throw new Error(data?.msg||data?.message||data?.error_description||data?.error||'Cloud request failed ('+response.status+').');
  return data;
 }
 function saveSession(value){
  clearTimeout(refreshTask);
  if(value){
   value.expires_at=Number(value.expires_at)||Math.floor(Date.now()/1000)+Number(value.expires_in||3600);
   try{const storage=rawStorage();if(!storage)throw new Error();storage.setItem(AUTH,JSON.stringify(value));}
   catch{session=null;throw new Error('Enable browser storage to keep a private sign-in session. The public demo still works without it.');}
   session=value;refreshTask=setTimeout(()=>refresh().catch(e=>error(e.message)),Math.max(1000,(session.expires_at*1000-Date.now()-60000)));
  }else{session=null;try{rawStorage()?.removeItem(AUTH);}catch{}}
 }
 async function refresh(){
  if(!session||session.expires_at*1000>Date.now()+60000)return;
  if(!refreshing)refreshing=request('/auth/v1/token?grant_type=refresh_token',{method:'POST',auth:false,body:{refresh_token:session.refresh_token}}).then(saveSession).finally(()=>refreshing=null);
  await refreshing;
 }
 async function activate(value){
  saveSession(value);const user=await request('/auth/v1/user');session.user=user;
  globalThis.SessionWorkspace?.setPrivate?.(user.id);
  return user;
 }
 const ready=(async()=>{
  if(!configured)return;
  try{
   const saved=rawStorage()?.getItem(AUTH);if(saved){session=JSON.parse(saved);await refresh();await activate(session);}
  }catch(e){saveSession(null);error('Sign in again: '+e.message);}
 })();
 const rpc=(name,args={})=>request('/rest/v1/rpc/'+name,{method:'POST',body:args});
 class CloudDatabase extends SessionStore.LocalDatabase {
  constructor(){const memory=new Map();super({getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)});this.queue=Promise.resolve();this.preferenceQueue=Promise.resolve();this.preferenceRevision=0;this.timer=null;}
  async load(){
   await this.preferenceQueue;
   const preferenceRevision=this.preferenceRevision;
   const snapshot=await rpc('sessiontv_snapshot');this.data=SessionStore.validate(snapshot.database||{});
   // An edit made while the network read was in flight is newer than that snapshot.
   if(preferenceRevision===this.preferenceRevision)globalThis.SessionWorkspace?.hydratePrivate?.(snapshot.preferences||{});
   for(const listener of this.listeners)queueMicrotask(listener.deliver);
   return snapshot;
  }
  write(name,id,value,mode){
   const write=async()=>{
    // Server merges update atomically, avoiding lost fields across devices.
    try{await rpc('sessiontv_write',{collection_name:name,document_id:id,document_value:value,write_mode:mode});await this.load();}
    catch(e){for(const listener of this.listeners)queueMicrotask(listener.deliver);throw e;}
   };
   const pending=this.queue.then(write);this.queue=pending.catch(()=>{});return pending;
  }
  async start(){
   await this.load();
   this.unsubscribe=globalThis.SessionWorkspace?.onPrivateChange?.((k,v)=>{
    if(!k.startsWith('sb.'))return;
    this.preferenceRevision++;
    this.preferenceQueue=this.preferenceQueue.then(()=>rpc('sessiontv_preference',{preference_key:k,preference_value:v})).catch(e=>error('Preference was not saved online: '+e.message));
   });
   // Low-frequency foreground polling provides cross-device refresh without requiring Realtime.
   this.timer=setInterval(()=>{if(document.visibilityState!=='hidden')this.queue=this.queue.then(()=>this.load()).catch(e=>error('Cloud sync: '+e.message));},30000);
   return this;
  }
  async flush(){await this.queue;await this.preferenceQueue;}
 }
 async function open(){await ready;if(!session?.user)throw new Error('Sign in to open your private workspace.');if(database)return database;if(!opening)opening=new CloudDatabase().start().then(db=>database=db).finally(()=>opening=null);return opening;}
 function validateBackup(backup){
  if(backup?.format!=='session-tv-backup'||backup.version!==1||!backup.values||typeof backup.values!=='object'||Array.isArray(backup.values))throw new Error('Choose a valid Session TV backup.');
  for(const [k,v] of Object.entries(backup.values))if((k!==SessionStore.KEY&&!k.startsWith('sb.'))||typeof v!=='string')throw new Error('Invalid backup values.');
  if(!Object.hasOwn(backup.values,SessionStore.KEY))throw new Error('Backup is missing the database.');
  SessionStore.validate(JSON.parse(backup.values[SessionStore.KEY]));return backup;
 }
 globalThis.SessionCloud={configured,ready,open,validateBackup,get user(){return signingOut?null:session?.user||null;},
  async accessToken(){await ready;await refresh();return session?.user?session.access_token:null;},
  async getAccessToken(){await ready;await refresh();if(!session?.user)throw new Error('Sign in first.');return session.access_token;},
  async signIn(email){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a valid email address.');await request('/auth/v1/otp',{method:'POST',auth:false,body:{email,create_user:true}});},
  async verifyOTP(email,token){const value=await request('/auth/v1/verify',{method:'POST',auth:false,body:{email,token,type:'email'}});await activate(value);location.reload();},
  async signOut(){await ready;signingOut=true;database?.unsubscribe?.();if(database)clearInterval(database.timer);try{await database?.flush();if(session)await request('/auth/v1/logout',{method:'POST'});}finally{saveSession(null);globalThis.SessionWorkspace?.clearPrivate?.();location.reload();}},
  async exportBackup(){const db=await open();await db.flush();const snap=await rpc('sessiontv_snapshot');return {format:'session-tv-backup',version:1,createdAt:new Date().toISOString(),values:{[SessionStore.KEY]:JSON.stringify(snap.database),...snap.preferences}};},
  async importBackup(backup){validateBackup(backup);const db=await open();await db.flush();const result=await rpc('sessiontv_import',{backup_values:backup.values});await db.load();return result;}
 };
 addEventListener('pagehide',()=>{if(database){clearInterval(database.timer);database.unsubscribe?.();}});
})();
