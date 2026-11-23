import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const cloudSource=readFileSync(new URL('../public/js/cloud.js',import.meta.url),'utf8');
const storeSource=readFileSync(new URL('../public/js/storage.js',import.meta.url),'utf8');
const edgeSource=readFileSync(new URL('../supabase/functions/account-delete/index.ts',import.meta.url),'utf8');
const user={id:'11111111-1111-4111-8111-111111111111',email:'learner@example.com',identities:[{provider:'email'}],last_sign_in_at:new Date().toISOString()};
const saved={access_token:'original-access',refresh_token:'original-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user};
function boot({session=saved,pending,href='https://tannermayfield.dev/session-tv/',handler=()=>user}={}){
 const values=new Map(session?[['sessiontv.auth.v1',JSON.stringify(session)]]:[]), transient=new Map(pending?[['sessiontv.google.pkce.v1',JSON.stringify(pending)]]:[]), calls=[],errors=[], redirects=[];
 const storage=values=>({getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)});
 const location={href,origin:new URL(href).origin,assign:destination=>redirects.push(destination),reload(){this.reloaded=true;}};
 const context=vm.createContext({crypto:globalThis.crypto,btoa,TextEncoder,URL,URLSearchParams,Date,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},queueMicrotask,AbortSignal,location,history:{replaceState(...args){this.replaced=args[2];}},document:{visibilityState:'visible'},localStorage:storage(values),sessionStorage:storage(transient),SessionWorkspace:{setPrivate(id){this.id=id;},clearPrivate(){this.cleared=true;}},CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},dispatchEvent:event=>errors.push(event.detail),addEventListener(){},SessionTVConfig:{supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'public-key'},async fetch(url,options){calls.push({url,...options});const result=await handler(url,options);return {ok:!result?.status||result.status<400,status:result?.status||200,text:async()=>JSON.stringify(result?.body??result)};}});
 vm.runInContext(storeSource,context);vm.runInContext(cloudSource,context);return {cloud:context.SessionCloud,context,calls,values,transient,redirects,errors};
}
test('Google uses PKCE and only the canonical production redirect',async()=>{
 const app=boot({session:null});await app.cloud.signInWithGoogle();const url=new URL(app.redirects[0]);assert.equal(url.pathname,'/auth/v1/authorize');assert.equal(url.searchParams.get('provider'),'google');assert.equal(url.searchParams.get('redirect_to'),'https://tannermayfield.dev/session-tv/');assert.equal(url.searchParams.get('code_challenge_method'),'s256');const pending=JSON.parse(app.transient.get('sessiontv.google.pkce.v1'));assert.equal(pending.verifier.length,43);assert(!url.href.includes(pending.verifier));
 const local=boot({session:null,href:'http://localhost:3000/'});await assert.rejects(local.cloud.signInWithGoogle(),/Open SessionTV/);assert.equal(local.redirects.length,0);
});
test('Google linking uses authenticated identities endpoint and pins original account',async()=>{
 const app=boot({handler:url=>url.includes('/identities/authorize')?{url:'https://accounts.google.com/o/oauth2/auth?state=example'}:user});await app.cloud.linkGoogle();const link=app.calls.find(call=>call.url.includes('/identities/authorize'));assert.equal(link.headers.Authorization,'Bearer original-access');assert.equal(JSON.parse(app.transient.get('sessiontv.google.pkce.v1')).userId,user.id);assert.match(app.redirects[0],/^https:\/\/accounts.google.com\//);
});
test('PKCE callback is processed before workspace activation and callback code is scrubbed',async()=>{
 const pending={verifier:'A'.repeat(43),created:Date.now(),userId:null};const app=boot({session:null,pending,href:'https://tannermayfield.dev/session-tv/?code=one-time-code',handler:url=>url.includes('grant_type=pkce')?{...saved,access_token:'oauth-access'}:user});await app.cloud.ready;assert.equal(app.calls[0].url,'https://example.supabase.co/auth/v1/token?grant_type=pkce');assert.deepEqual(JSON.parse(app.calls[0].body),{auth_code:'one-time-code',code_verifier:pending.verifier});assert.equal(app.cloud.user.id,user.id);assert.equal(app.transient.size,0);assert.equal(app.context.history.replaced,'/session-tv/');
});
test('unsolicited callback and mismatched linked account never activate a replacement workspace',async()=>{
 const unsolicited=boot({session:null,href:'https://tannermayfield.dev/session-tv/?code=bad'});await unsolicited.cloud.ready;assert.equal(unsolicited.calls.length,0);assert.equal(unsolicited.cloud.user,null);
 let gets=0;const app=boot({pending:{verifier:'B'.repeat(43),created:Date.now(),userId:user.id},href:'https://tannermayfield.dev/session-tv/?code=wrong-account',handler:url=>url.includes('grant_type=pkce')?{...saved,access_token:'wrong-access'}:++gets===1?{...user,id:'different-user'}:user});await app.cloud.ready;assert.equal(app.cloud.user.id,user.id);assert(!app.values.get('sessiontv.auth.v1').includes('wrong-access'));assert(app.errors.some(e=>e.includes('verification')));
});
test('password change checks current password without persisting it or replacing active tokens',async()=>{
 const app=boot({handler:(url,options)=>url.includes('grant_type=password')?{...saved,access_token:'verified-access'}:url.includes('/logout')?{}:user});await app.cloud.changePassword('old-password','new-password');const update=app.calls.find(call=>call.method==='PUT');assert.equal(update.headers.Authorization,'Bearer original-access');assert.deepEqual(JSON.parse(update.body),{password:'new-password',current_password:'old-password'});const cleanup=app.calls.find(call=>call.url.endsWith('/logout?scope=local'));assert(cleanup);assert.equal(cleanup.headers.Authorization,'Bearer verified-access');assert(app.calls.filter(call=>call.method==='PUT').every(call=>call.headers.Authorization==='Bearer original-access'));const stored=app.values.get('sessiontv.auth.v1');assert(stored.includes('original-access'));assert(!stored.includes('password'));assert(!stored.includes('verified-access'));
});
test('incorrect current password cannot update account',async()=>{
 const app=boot({handler:url=>url.includes('grant_type=password')?{status:400,body:{msg:'Invalid login credentials'}}:user});await assert.rejects(app.cloud.changePassword('wrong-password','new-password'),/Invalid login/);assert(!app.calls.some(call=>call.method==='PUT'));assert.equal(app.cloud.user.id,user.id);
});
test('Google-only account can set a password after a recent verified sign-in',async()=>{
 const app=boot({handler:()=>({...user,identities:[{provider:'google'}]})});assert.equal((await app.cloud.changePassword('','new-password')).changed,true);assert(!app.calls.some(call=>call.url.includes('grant_type=password')));assert(app.calls.some(call=>call.method==='PUT'));
});
test('account deletion only clears local data after server success and requires matching email',async()=>{
 const failed=boot({handler:url=>url.includes('account-delete')?{status:503,body:{message:'Unavailable'}}:user});await assert.rejects(failed.cloud.deleteAccount('wrong@example.com'),/Type your account email/);assert(!failed.calls.some(call=>call.url.includes('account-delete')));await assert.rejects(failed.cloud.deleteAccount(user.email),/Unavailable/);assert.equal(failed.cloud.user.id,user.id);
 const app=boot({handler:url=>url.includes('account-delete')?{deleted:true}:user});await app.cloud.deleteAccount(user.email);assert.deepEqual(JSON.parse(app.calls.find(c=>c.url.includes('account-delete')).body),{confirmationEmail:user.email});assert.equal(app.cloud.user,null);assert.equal(app.values.has('sessiontv.auth.v1'),false);assert.equal(app.context.SessionWorkspace.cleared,true);
});
function edge({handler=()=>new Response('{}'),environment={}}={}){
 let run;const calls=[];const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private-service',...environment};
 vm.runInNewContext(edgeSource,{Deno:{env:{get:name=>env[name]},serve:fn=>run=fn},Response,AbortSignal,TextDecoder,Date,fetch:async(url,options)=>{calls.push({url,...options});return handler(url,options);}});
 return {run,calls};
}
const deletion=(body={confirmationEmail:user.email},token='user-access')=>new Request('https://example.supabase.co/functions/v1/account-delete',{method:'POST',headers:{Origin:'https://tannermayfield.dev',Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('deletion Edge Function verifies user, rejects forged user ID, revokes sessions then hard-deletes only self',async()=>{
 const app=edge({handler:url=>url.endsWith('/user')?Response.json(user):new Response('{}')});assert.equal((await app.run(deletion({confirmationEmail:user.email,userId:'victim'}))).status,400);assert.equal(app.calls.length,1);app.calls.length=0;
 const result=await app.run(deletion());assert.equal(result.status,200);assert.equal(app.calls[0].headers.Authorization,'Bearer user-access');assert(app.calls[1].url.endsWith('/logout?scope=global'));assert(app.calls[2].url.endsWith('/admin/users/'+user.id));assert.equal(app.calls[2].headers.Authorization,'Bearer private-service');assert.deepEqual(JSON.parse(app.calls[2].body),{should_soft_delete:false});assert.equal((await result.json()).deleted,true);
});
test('invalid, stale sessions and revocation failure cannot delete any user',async()=>{
 for(const mode of ['invalid','stale','logout-fails']){
  const app=edge({handler:url=>url.endsWith('/user')?mode==='invalid'?new Response('{}',{status:401}):Response.json({...user,...(mode==='stale'?{last_sign_in_at:'2000-01-01T00:00:00Z'}:{})}):new Response('{}',{status:503})});assert((await app.run(deletion())).status>=400);assert(!app.calls.some(call=>call.method==='DELETE'));
 }
});

test('disabled Google provider gives an actionable error before navigation',async()=>{
 const app=boot({session:null,handler:()=>({external:{google:false}})});await assert.rejects(app.cloud.signInWithGoogle(),/Enable Google in Supabase Authentication/);assert.equal(app.redirects.length,0);assert.equal(app.transient.size,0);
});
