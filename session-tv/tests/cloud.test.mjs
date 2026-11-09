import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const store=readFileSync(new URL('../public/js/storage.js',import.meta.url),'utf8');
const cloud=readFileSync(new URL('../public/js/cloud.js',import.meta.url),'utf8');
function boot({configured=false,session=null,handler=()=>({})}={}){
 const values=new Map(session?[['sessiontv.auth.v1',JSON.stringify(session)]]:[]),calls=[],listeners={};
 const context=vm.createContext({setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},queueMicrotask,console,AbortSignal,
  crypto:globalThis.crypto,location:{reload(){}},document:{visibilityState:'visible'},
  CustomEvent:class {constructor(type,{detail}){this.type=type;this.detail=detail;}},dispatchEvent(){},addEventListener:(name,fn)=>listeners[name]=fn,
  localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},
  SessionWorkspace:{setPrivate(id){this.id=id;},hydratePrivate(v){this.preferences=v;},onPrivateChange(cb){this.callback=cb;return ()=>{};}},
  SessionTVConfig:configured?{supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'sb_publishable_test'}:{},
  async fetch(url,options){calls.push({url,...options});const result=await handler(url,options);return {ok:result.status===undefined||result.status<400,status:result.status||200,text:async()=>JSON.stringify(result.body??result)};}
 });vm.runInContext(store,context);vm.runInContext(cloud,context);return {context,calls,cloud:context.SessionCloud};
}
const session={access_token:'access',refresh_token:'refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'owner-id'}};
test('unconfigured demo makes no cloud requests and cannot open private data',async()=>{
 const app=boot();await app.cloud.ready;assert.equal(app.calls.length,0);assert.equal(app.cloud.user,null);await assert.rejects(app.cloud.open(),/Sign in/);
});
test('email password login uses official Auth endpoint and stores no password',async()=>{
 const app=boot({configured:true,handler:url=>url.endsWith('/user')?{id:'owner-id'}:session});await app.cloud.signInWithPassword('learner@example.com','example-password');
 assert.match(app.calls[0].url,/\/auth\/v1\/token\?grant_type=password$/);assert.equal(app.calls[0].headers.apikey,'sb_publishable_test');assert.equal(app.calls[0].headers.Authorization,undefined);assert.deepEqual(JSON.parse(app.calls[0].body),{email:'learner@example.com',password:'example-password'});assert.equal(app.cloud.user.id,'owner-id');assert.equal(app.context.localStorage.getItem('sessiontv.auth.v1').includes('example-password'),false);
});

test('username password login resolves only through the private server endpoint',async()=>{
 const app=boot({configured:true,handler:url=>url.endsWith('/user')?{id:'owner-id'}:session});await app.cloud.signInWithPassword('My.User','example-password');assert.match(app.calls[0].url,/\/functions\/v1\/username-login$/);assert.deepEqual(JSON.parse(app.calls[0].body),{username:'my.user',password:'example-password'});assert.equal(app.calls.some(c=>c.url.includes('lookup_login_email')),false);assert.equal(app.context.SessionWorkspace.id,'owner-id');
});

test('failed password verification never opens a private workspace or stores a session',async()=>{
 const app=boot({configured:true,handler:()=>({status:401,body:{error:'Incorrect username or password.'}})});await assert.rejects(app.cloud.signInWithPassword('student','wrong'),/Incorrect/);assert.equal(app.cloud.user,null);assert.equal(app.context.localStorage.getItem('sessiontv.auth.v1'),null);assert.equal(app.context.SessionWorkspace.id,undefined);
});

test('authenticated writes use owner-scoped RPC and failed writes do not commit local data',async()=>{
 const app=boot({configured:true,session,handler:url=>url.endsWith('/user')?{id:'owner-id'}:url.endsWith('sessiontv_snapshot')?{database:{tasks:{first:{title:'Saved'}}},preferences:{'sb.ws.first':'draft'}}:{status:403,body:{message:'denied by RLS'}}});
 const db=await app.cloud.open();assert.equal(app.context.SessionWorkspace.id,'owner-id');assert.equal(app.context.SessionWorkspace.preferences['sb.ws.first'],'draft');
 await assert.rejects(db.doc('tasks/second').set({title:'Denied'}),/denied by RLS/);
 assert.equal(db.snapshot('tasks','second').exists,false);assert.equal(db.snapshot('tasks','first').data().title,'Saved');
 const write=app.calls.find(c=>c.url.endsWith('sessiontv_write'));assert.equal(write.headers.Authorization,'Bearer access');assert.equal(JSON.parse(write.body).document_id,'second');
});
test('backup import rejects unexpected keys and validates legacy documents',()=>{
 const app=boot(),key='sessiontv.database.v1';
 assert.throws(()=>app.cloud.validateBackup({format:'session-tv-backup',version:1,values:{[key]:'{}','sessiontv.auth.v1':'token'}}),/Invalid backup/);
 assert.throws(()=>app.cloud.validateBackup({format:'session-tv-backup',version:1,values:{[key]:'{"unknown":{}}'}}),/collection/);
 assert.ok(app.cloud.validateBackup({format:'session-tv-backup',version:1,values:{[key]:'{"tasks":{"legacy-1":{"title":"Keep me"}}}','sb.ws.legacy-1':'code'}}));
});
test('concurrent open shares one adapter and stale cloud reads cannot replace a newer draft',async()=>{
 let snapshotCount=0,release;
 const app=boot({configured:true,session,handler:async url=>{
  if(url.endsWith('/user'))return {id:'owner-id'};
  if(url.endsWith('sessiontv_snapshot')){snapshotCount++;if(snapshotCount===2)await new Promise(resolve=>release=resolve);return {database:{},preferences:{'sb.ws.example':'old'}};}
  return {};
 }});
 const [one,two]=await Promise.all([app.cloud.open(),app.cloud.open()]);assert.equal(one,two);assert.equal(snapshotCount,1);
 const loading=one.load();while(!release)await Promise.resolve();
 app.context.SessionWorkspace.preferences={'sb.ws.example':'new'};
 app.context.SessionWorkspace.callback('sb.ws.example','new');release();await loading;
 assert.equal(app.context.SessionWorkspace.preferences['sb.ws.example'],'new');await one.flush();
});
