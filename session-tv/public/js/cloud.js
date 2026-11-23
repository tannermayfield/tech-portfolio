/* Supabase Auth + PostgREST. Application records never depend on the AI companion. */
(() => {
 'use strict';
 const config=globalThis.SessionTVConfig||{}, url=(config.supabaseUrl||'').replace(/\/$/,''), key=config.supabasePublishableKey||'';
 const configured=!!(url&&key), AUTH='sessiontv.auth.v1', OAUTH='sessiontv.google.pkce.v1', REDIRECT='https://tannermayfield.dev/session-tv/';
 let session=null, refreshTask=null, database=null, opening=null, refreshing=null, signingOut=false;
 const error=message=>dispatchEvent(new CustomEvent('sessiontv:error',{detail:message}));
 const rawStorage=()=>{try{return globalThis.SessionWorkspace?.originalStorage||globalThis.localStorage;}catch{return null;}};
 async function request(route,{method='GET',body,auth=true,bearer}={}){
  if(!configured)throw new Error('Configure Supabase public credentials to use My Workspace.');
  if(auth&&!bearer){await refresh();if(!session?.access_token)throw new Error('Sign in to your private workspace first.');}
  const response=await fetch(url+route,{method,headers:{apikey:key,'Content-Type':'application/json',...((auth||bearer)?{Authorization:'Bearer '+(bearer||session.access_token)}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const text=await response.text();let data;try{data=text?JSON.parse(text):null}catch{throw new Error('Supabase returned an invalid response.');}
  if(!response.ok){
   throw Object.assign(new Error(data?.msg||data?.message||data?.error_description||data?.error||'Cloud request failed ('+response.status+').'),{status:response.status,code:data?.error_code||data?.code});
  }
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
 async function activate(value,expectedId){
  const previous=session;
  session={...value,expires_at:Number(value.expires_at)||Math.floor(Date.now()/1000)+Number(value.expires_in||3600)};
  try{
   const user=await request('/auth/v1/user');if(!user?.id||(expectedId&&user.id!==expectedId))throw new Error('Account verification failed.');
   saveSession({...session,user});globalThis.SessionWorkspace?.setPrivate?.(user.id);return user;
  }catch(e){session=previous;throw e;}
 }
 function oauthStorage(){try{if(!globalThis.sessionStorage)throw new Error();return globalThis.sessionStorage;}catch{throw new Error('Enable browser session storage to continue with Google.');}}
 const base64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 async function google(link=false){
  await ready;if(!configured)throw new Error('Configure Supabase public credentials first.');
  if(globalThis.location?.origin!==new URL(REDIRECT).origin)throw new Error('Open SessionTV at '+REDIRECT+' to continue with Google.');
  if(link&&!session?.user)throw new Error('Sign in before linking Google.');
  const settings=await request('/auth/v1/settings',{auth:false});
  if(settings?.external?.google===false)throw new Error('Google sign-in is not enabled yet. Enable Google in Supabase Authentication before continuing.');
  const verifier=base64(crypto.getRandomValues(new Uint8Array(32))),challenge=base64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
  const pending={verifier,created:Date.now(),userId:link?session.user.id:null};oauthStorage().setItem(OAUTH,JSON.stringify(pending));
  const query=new URLSearchParams({provider:'google',redirect_to:REDIRECT,code_challenge:challenge,code_challenge_method:'s256'});
  try{
   let target=url+'/auth/v1/authorize?'+query;
   if(link){query.set('skip_http_redirect','true');const result=await request('/auth/v1/user/identities/authorize?'+query);target=result?.url;}
   const destination=new URL(target);if(destination.protocol!=='https:'||(link&&!['accounts.google.com',new URL(url).hostname].includes(destination.hostname))||(!link&&destination.origin!==new URL(url).origin))throw new Error('Google returned an invalid sign-in destination.');
   location.assign(destination.href);return {redirecting:true};
  }catch(e){oauthStorage().removeItem(OAUTH);throw e;}
 }
 async function callback(){
  if(!globalThis.location?.href)return false;
  const current=new URL(location.href);const code=current.searchParams.get('code'),failed=current.searchParams.has('error');
  if(!code&&!failed)return false;
  let pending;try{pending=JSON.parse(oauthStorage().getItem(OAUTH)||'null');}finally{
   oauthStorage().removeItem(OAUTH);for(const name of ['code','error','error_code','error_description','sb_flow_id'])current.searchParams.delete(name);
   globalThis.history?.replaceState?.(null,'',current.pathname+current.search+current.hash);
  }
  if(current.origin!==new URL(REDIRECT).origin||current.pathname!==new URL(REDIRECT).pathname||!pending||Date.now()-pending.created>10*60000||pending.created>Date.now()||typeof pending.verifier!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(pending.verifier))throw new Error('Google sign-in expired or was opened in another browser. Please try again.');
  if(failed)throw new Error('Google sign-in was canceled or could not be completed.');
  const value=await request('/auth/v1/token?grant_type=pkce',{method:'POST',auth:false,body:{auth_code:code,code_verifier:pending.verifier}});
  if(pending.userId&&session?.user?.id!==pending.userId)throw new Error('Sign in to the original account before linking Google.');
  await activate(value,pending.userId);return true;
 }
 const ready=(async()=>{
  if(!configured)return;
  try{
   const saved=rawStorage()?.getItem(AUTH);if(saved)session=JSON.parse(saved);
   try{if(await callback())return;}catch(e){error(e.message);}
   if(session){await refresh();await activate(session);}
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
  async signInWithPassword(identifier,password){
   identifier=String(identifier||'').trim();
   if(!password||typeof password!=='string'||password.length>1024)throw new Error('Enter your password.');
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier))throw new Error('Enter a valid email address.');
   const value=await request('/auth/v1/token?grant_type=password',{method:'POST',auth:false,body:{email:identifier,password}});
   // Persist only session tokens; never store the submitted password.
   await activate(value);location.reload();
  },
  signInWithGoogle(){return google(false);},
  linkGoogle(){return google(true);},
  async accountInfo(){await ready;const user=await request('/auth/v1/user');if(!user?.id||user.id!==session?.user?.id)throw new Error('Account verification failed. Sign in again.');saveSession({...session,user});return user;},
  async changePassword(currentPassword,newPassword){
   await ready;
   if(typeof newPassword!=='string'||newPassword.length<8||newPassword.length>1024)throw new Error('Use a new password with at least 8 characters.');
   if(currentPassword===newPassword)throw new Error('Choose a different new password.');
   const user=await this.accountInfo();if(!user.email)throw new Error('This account does not have an email/password login.');
   const passwordAccount=user.identities?.some(identity=>identity.provider==='email')!==false;
   if(!currentPassword&&!passwordAccount){
    const recent=Date.parse(user.last_sign_in_at||'');
    if(!Number.isFinite(recent)||Date.now()-recent>10*60000)throw new Error('Sign out and continue with Google again before setting a password.');
    try{const updated=await request('/auth/v1/user',{method:'PUT',body:{password:newPassword}});if(updated?.id!==user.id)throw new Error('Account verification failed.');saveSession({...session,user:updated});return {changed:true};}
    catch(e){if(/nonce|reauthenticat/i.test(e.message))throw new Error('Sign out, continue with Google again, then retry setting a password.');throw e;}
   }
   if(typeof currentPassword!=='string'||!currentPassword||currentPassword.length>1024)throw new Error('Enter your current password.');
   const verified=await request('/auth/v1/token?grant_type=password',{method:'POST',auth:false,body:{email:user.email,password:currentPassword}});
   if(typeof verified.access_token!=='string'||!verified.access_token)throw new Error('Password verification failed.');
   let changed;
   try{
    const checked=await request('/auth/v1/user',{bearer:verified.access_token});
    if(checked?.id!==user.id)throw new Error('Password verification did not match your signed-in account.');
    // Update on the active session: Supabase retains this session when revoking other sessions.
    changed=await request('/auth/v1/user',{method:'PUT',body:{password:newPassword,current_password:currentPassword}});
    if(changed?.id!==user.id)throw new Error('Account verification failed. Sign in again.');
    saveSession({...session,user:changed});return {changed:true};
   }catch(e){if(e.code==='reauthentication_needed'||e.code==='reauthentication_not_valid'||/nonce|reauthenticat/i.test(e.message))throw new Error('Your account requires email verification for password changes. Sign out, sign in again, then retry from Account settings.');throw e;}
   finally{if(verified.access_token)await request('/auth/v1/logout?scope=local',{method:'POST',bearer:verified.access_token}).catch(()=>{});}
  },
  async deleteAccount(confirmationEmail){
   await ready;const user=await this.accountInfo();
   if(typeof confirmationEmail!=='string'||confirmationEmail.trim().toLowerCase()!==user.email?.trim().toLowerCase())throw new Error('Type your account email to confirm permanent deletion.');
   await database?.flush();await request('/functions/v1/account-delete',{method:'POST',body:{confirmationEmail:confirmationEmail.trim()}});
   signingOut=true;database?.unsubscribe?.();if(database)clearInterval(database.timer);saveSession(null);try{oauthStorage().removeItem(OAUTH);}catch{}globalThis.SessionWorkspace?.clearPrivate?.();location.reload();return {deleted:true};
  },
  async signOut(){await ready;signingOut=true;database?.unsubscribe?.();if(database)clearInterval(database.timer);try{await database?.flush();if(session)await request('/auth/v1/logout',{method:'POST'});}finally{saveSession(null);globalThis.SessionWorkspace?.clearPrivate?.();location.reload();}},
  async manageClass({oldCourse,newCourse=null,deleteClass=false,classValue=null}={}){
   await ready;
   if(signingOut||!session?.user?.id)throw new Error('Sign in to edit your private classes.');
   if(typeof oldCourse!=='string'||!oldCourse.trim()||oldCourse.length>500)throw new Error('Choose an existing class.');
   if(newCourse!==null&&(typeof newCourse!=='string'||!newCourse.trim()||newCourse.length>500))throw new Error('Enter a valid class name.');
   if(typeof deleteClass!=='boolean')throw new Error('Choose whether to edit or delete the class.');
   if(classValue!==null&&(typeof classValue!=='object'||Array.isArray(classValue)))throw new Error('Enter valid class details.');
   const owner=session.user.id,db=database;
   await db?.flush();
   const update=async()=>{
    if(signingOut||session?.user?.id!==owner)throw new Error('Sign in again before changing this class.');
    const result=await rpc('sessiontv_manage_class',{old_course:oldCourse.trim(),new_course:newCourse===null?null:newCourse.trim(),delete_class:deleteClass,class_value:classValue});
    if(db)await db.load();return result;
   };
   // Keep the one atomic class mutation in order with normal document writes.
   if(!db)return update();
   const pending=db.queue.then(update);db.queue=pending.catch(()=>{});return pending;
  },
  async exportBackup(){const db=await open();await db.flush();const snap=await rpc('sessiontv_snapshot');return {format:'session-tv-backup',version:1,createdAt:new Date().toISOString(),values:{[SessionStore.KEY]:JSON.stringify(snap.database),...snap.preferences}};},
  async importBackup(backup){validateBackup(backup);const db=await open();await db.flush();const result=await rpc('sessiontv_import',{backup_values:backup.values});await db.load();return result;}
 };
 addEventListener('pagehide',()=>{if(database){clearInterval(database.timer);database.unsubscribe?.();}});
})();
