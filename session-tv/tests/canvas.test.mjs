import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {canvasService} from '../companion/canvas.mjs';
import {createCompanion,canonicalWorkspaces} from '../companion/server.mjs';
const SCHOOL='https://byu.instructure.com',TOKEN='canvas-secret-access';
const account={id:123,name:'Learner'};
async function fixture(t,handler){
 const home=await mkdtemp(join(tmpdir(),'sessiontv-canvas-')),calls=[];
 const fetchImpl=async(url,options)=>{calls.push({url,options});return handler?handler(url,options,calls):Response.json(account);};
 const service=canvasService({home,fetchImpl});t.after(async()=>{service.close();await service.disconnect();await rm(home,{recursive:true,force:true});});return {service,home,calls,fetchImpl};
}
test('Canvas is lazy, verifies profile before saving a protected token, and exposes no token',async t=>{
 const f=await fixture(t);assert.equal((await f.service.status()).connected,false);assert.equal(f.calls.length,0);
 const state=await f.service.connect({token:TOKEN});assert.equal(state.connected,true);assert.deepEqual(state.account,{id:'123',name:'Learner'});assert(!JSON.stringify(state).includes(TOKEN));
 assert.equal(f.calls[0].url,SCHOOL+'/api/v1/users/self/profile');assert.equal(f.calls[0].options.method,'GET');assert.equal(f.calls[0].options.redirect,'error');assert.equal(f.calls[0].options.headers.Authorization,'Bearer '+TOKEN);
 assert.equal(JSON.parse(await readFile(join(f.home,'canvas/connection.json'),'utf8')).token,TOKEN);
 await f.service.disconnect();assert.equal((await f.service.status()).connected,false);await assert.rejects(readFile(join(f.home,'canvas/connection.json')),error=>error.code==='ENOENT');
});
test('invalid token, permission failure, and rate limiting produce safe errors without persisting credentials',async t=>{
 for(const status of [401,403,429]){
  const f=await fixture(t,()=>Response.json({error:'secret '+TOKEN},{status}));await assert.rejects(f.service.connect({token:TOKEN}),error=>[424,429].includes(error.status)&&!error.message.includes(TOKEN));assert.equal((await f.service.status()).connected,false);assert.equal(f.calls.length,1);
 }
});
test('snapshot follows course and assignment pagination and normalizes submitted/late/missing work',async t=>{
 const f=await fixture(t,url=>{
  const u=new URL(url);
  if(u.pathname.endsWith('/profile'))return Response.json(account);
  if(u.pathname==='/api/v1/courses'){
   if(!u.searchParams.has('page')){assert.equal(u.searchParams.get('enrollment_type'),'student');assert.equal(u.searchParams.get('enrollment_state'),'active');}
   return u.searchParams.has('page')?Response.json([{id:2,name:'Second class',course_code:'TWO'}]):Response.json([{id:1,name:'First class',course_code:'ONE'}],{headers:{Link:`<${SCHOOL}/api/v1/courses?page=2>; rel="next"`}});
  }
  if(u.pathname.endsWith('/courses/1/assignments')){
   if(u.searchParams.has('page'))return Response.json([{id:12,course_id:1,name:'Still missing',due_at:'2026-11-01T12:00:00Z',submission:{workflow_state:'unsubmitted',missing:true}}]);
   assert.equal(u.searchParams.get('include[]'),'submission');
   return Response.json([{id:11,course_id:1,name:'Late submitted',description:'<p>Read chapter</p>',points_possible:10,due_at:'2026-11-01T12:00:00Z',submission:{workflow_state:'submitted',submitted_at:'2026-11-02T12:00:00Z',missing:true,late:true,cached_due_date:'2026-11-01T15:00:00Z'}}],{headers:{Link:`<${SCHOOL}/api/v1/courses/1/assignments?page=2>; rel="next"`}});
  }
  return Response.json([{id:21,course_id:2,name:'Graded paper',submission:{workflow_state:'graded',missing:true}}]);
 });
 await f.service.connect({token:TOKEN});const result=await f.service.snapshot();assert.equal(result.courses.length,2);assert.equal(result.assignments.length,3);assert.equal(result.assignments[0].submission.submitted,true);assert.equal(result.assignments[0].submission.missing,false);assert.equal(result.assignments[0].dueAt,'2026-11-01T15:00:00.000Z');assert.equal(result.assignments[1].submission.missing,true);assert.equal(result.assignments[2].submission.submitted,true);assert.equal(result.assignments[2].submission.missing,false);assert.equal(result.courses[0].url,SCHOOL+'/courses/1');
 assert.equal((await f.service.status()).lastSync,result.syncedAt);assert(f.calls.every(call=>call.options.method==='GET'));
});
test('pagination cannot send credentials outside BYU API or follow redirects',async t=>{
 for(const target of ['https://evil.example/api/v1/courses?page=2','https://byu.instructure.com.evil.example/api/v1/courses','https://secret@byu.instructure.com/api/v1/courses','https://byu.instructure.com/login','https://byu.instructure.com/api/v1/courses?access_token=other']){
  const f=await fixture(t,url=>url.endsWith('/profile')?Response.json(account):Response.json([],{headers:{Link:`<${target}>; rel="next"`}}));await f.service.connect({token:TOKEN});await assert.rejects(f.service.snapshot(),/unsafe pagination/);assert(f.calls.every(call=>new URL(call.url).origin===SCHOOL));assert.equal(f.calls.length,3);
 }
 const redirected=await fixture(t,url=>url.endsWith('/profile')?Response.json(account):new Response('',{status:302,headers:{Location:'https://evil.example'}}));await redirected.service.connect({token:TOKEN});await assert.rejects(redirected.service.snapshot(),/redirected/);assert.equal(redirected.calls.length,3);
});
test('one failing course rejects the whole snapshot without advancing previous lastSync',async t=>{
 let failSecond=false;
 const f=await fixture(t,url=>url.endsWith('/profile')?Response.json(account):new URL(url).pathname==='/api/v1/courses'?Response.json([{id:1,name:'One'},{id:2,name:'Two'}]):url.includes('/courses/2/')&&failSecond?Response.json({message:TOKEN},{status:403}):Response.json([]));
 await f.service.connect({token:TOKEN});const previous=await f.service.snapshot();failSecond=true;await assert.rejects(f.service.snapshot(),error=>!error.message.includes(TOKEN));assert.equal((await f.service.status()).lastSync,previous.syncedAt);
});
test('expired token is disconnected safely on status verification and not mistaken for an empty course list',async t=>{
 let expired=false;const f=await fixture(t,()=>expired?Response.json({}, {status:401}):Response.json(account));await f.service.connect({token:TOKEN});expired=true;
 const status=await f.service.status();assert.equal(status.connected,false);assert.match(status.error,/expired or was revoked/);await assert.rejects(f.service.snapshot(),/expired or was revoked/);
});
test('pagination loops are bounded and unsupported JSON fails instead of importing an empty snapshot',async t=>{
 const f=await fixture(t,url=>url.endsWith('/profile')?Response.json(account):Response.json([],{headers:{Link:`<${SCHOOL}/api/v1/courses?again=1>; rel="next"`}}));await f.service.connect({token:TOKEN});await assert.rejects(f.service.snapshot(),/pagination exceeded/);assert(f.calls.length<=4);
 const invalid=await fixture(t,url=>url.endsWith('/profile')?Response.json(account):Response.json({error:'not a list'}));await invalid.service.connect({token:TOKEN});await assert.rejects(invalid.service.snapshot(),/invalid list/);
});
test('disconnect cancels a pending connect and never lets its late response restore a token',async t=>{
 let release;const f=await fixture(t,()=>new Promise(resolve=>release=()=>resolve(Response.json(account))));const connecting=f.service.connect({token:TOKEN});while(!release)await new Promise(resolve=>setImmediate(resolve));const disconnecting=f.service.disconnect();release();await assert.rejects(connecting,/canceled/);await disconnecting;assert.equal((await f.service.status()).connected,false);await assert.rejects(readFile(join(f.home,'canvas/connection.json')),error=>error.code==='ENOENT');
});
test('Canvas routes require paired owner and use injected service independently of Codex operations',async t=>{
 const calls=[];const canvas={status:async()=>{calls.push('status');return {connected:false,schoolUrl:SCHOOL};},connect:async body=>{calls.push(body);if(body.token==='expired')throw Object.assign(new Error('Canvas expired'),{status:401});return {connected:true};},snapshot:async()=>({courses:[],assignments:[],syncedAt:'now'}),disconnect:async()=>({connected:false}),close(){calls.push('close');}};
 const workspaces=await canonicalWorkspaces([tmpdir()]);const companion=createCompanion({port:0,origin:'https://tannermayfield.dev',supabaseUrl:'https://example.supabase.co',publishableKey:'public',ownerId:'owner',home:join(tmpdir(),'canvas-route-home'),workspaces,deviceToken:'paired',verifyUser:async token=>({id:token==='owner'?'owner':'visitor'}),canvas,bridgeFactory:()=>{throw new Error('Canvas should not start Codex');}});
 await companion.listen();t.after(()=>new Promise(resolve=>companion.server.close(resolve)));const base='http://127.0.0.1:'+companion.server.address().port;
 const post=(route,body={},headers={})=>fetch(base+route,{method:'POST',headers:{Origin:'https://tannermayfield.dev',Authorization:'Bearer owner','X-SessionTV-Pair':'paired','Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 assert.equal((await post('/canvas/status',{}, {'X-SessionTV-Pair':''})).status,401);assert.equal((await post('/canvas/connect',{token:TOKEN},{Authorization:'Bearer visitor'})).status,403);assert.equal(calls.length,0);
 assert.equal((await post('/canvas/connect',{token:TOKEN})).status,200);assert.deepEqual(calls[0],{token:TOKEN});assert.equal((await post('/canvas/connect',{token:'expired'})).status,424);assert.equal((await post('/canvas/status')).status,200);assert.equal((await post('/canvas/snapshot')).status,200);assert.equal((await post('/canvas/disconnect')).status,200);
});
