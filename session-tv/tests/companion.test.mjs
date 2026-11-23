import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {tmpdir} from 'node:os';
import http from 'node:http';
import {createCompanion,canonicalWorkspaces} from '../companion/server.mjs';
import {CodexBridge} from '../companion/codex.mjs';

class FakeBridge extends EventEmitter {
 async initialize(){}
 async account(){return {signedIn:true,authType:'chatgpt'}}
 async models(){return {models:[{id:'latest',displayName:'Latest',isDefault:true,efforts:['low','medium','high','xhigh']}],selectedModel:'latest',efforts:['low','medium','high','xhigh']}}
 async start(cwd,prompt){this.cwd=cwd;this.prompt=prompt;setTimeout(()=>{this.emit('event',{method:'item/agentMessage/delta',params:{delta:'Hello'}});this.emit('event',{method:'turn/completed',params:{turn:{status:'completed'}}})},1)}
 stop(){}
}
async function fixture(callback){
 const workspaces=await canonicalWorkspaces([tmpdir()]);let starts=0;
 const companion=createCompanion({port:0,origin:'https://tannermayfield.dev',supabaseUrl:'https://test.supabase.co',publishableKey:'public',ownerId:'owner',home:tmpdir()+'-sessiontv-credentials',workspaces,
  verifyUser:async token=>({id:token==='owner-jwt'?'owner':'visitor'}),bridgeFactory:()=>{starts++;return new FakeBridge()}});
 await companion.listen();const url='http://127.0.0.1:'+companion.server.address().port;
 const post=(route,body={},headers={})=>fetch(url+route,{method:'POST',headers:{Origin:'https://tannermayfield.dev','Content-Type':'application/json',Authorization:'Bearer owner-jwt',...headers},body:JSON.stringify(body)});
 try{await callback({companion,post,url,workspaces,starts:()=>starts})}finally{await new Promise(resolve=>companion.server.close(resolve))}
}
test('companion rejects unauthenticated, cross-origin, non-owner and unpaired clients before accessing Codex',()=>fixture(async({post,starts})=>{
 assert.equal((await post('/status',{}, {Authorization:''})).status,401);
 assert.equal((await post('/status',{}, {Origin:'https://evil.example'})).status,403);
 assert.equal((await post('/pair',{code:'anything'},{Authorization:'Bearer visitor-jwt'})).status,403);
 assert.equal((await post('/status')).status,401);assert.equal(starts(),0);
}));
test('pairing is one-use and runs only explicitly selected canonical workspaces',()=>fixture(async({companion,post,workspaces})=>{
 const paired=await post('/pair',{code:companion.pairingCode});assert.equal(paired.status,200);
 const token=(await paired.json()).token,headers={'X-SessionTV-Pair':token};
 assert.equal((await post('/pair',{code:companion.pairingCode})).status,403);
 const status=await (await post('/status',{},headers)).json();assert.equal(status.signedIn,true);assert.deepEqual(status.workspaces,workspaces);
 assert.equal((await post('/run',{workspace:process.cwd(),prompt:'hello'},headers)).status,403);
 const run=await post('/run',{workspace:workspaces[0],prompt:'hello'},headers);assert.equal(run.status,200);
 const events=(await run.text()).trim().split('\n').map(JSON.parse);assert.ok(events.some(e=>e.method==='turn/completed'));
 assert.equal((await post('/disconnect',{},headers)).status,200);
 assert.equal((await post('/status',{},headers)).status,401);
}));
test('loopback host validation and CORS preflight preserve origin restrictions',()=>fixture(async({url})=>{
 const status=await new Promise(resolve=>{const req=http.request(url+'/status',{method:'POST',headers:{Host:'attacker.example',Origin:'https://tannermayfield.dev'}},res=>{res.resume();resolve(res.statusCode)});req.end('{}')});
 assert.equal(status,403);
 const response=await fetch(url+'/status',{method:'OPTIONS',headers:{Origin:'https://tannermayfield.dev','Access-Control-Request-Private-Network':'true'}});
 assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://tannermayfield.dev');
 assert.equal(response.headers.get('Access-Control-Allow-Headers'),'Authorization, Content-Type, X-SessionTV-Pair');
}));
test('Codex protocol uses restricted profile, excludes billing credentials, and declines privilege grants',async()=>{
 const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{};let launch;
 const bridge=new CodexBridge({home:tmpdir(),cwd:tmpdir(),spawnProcess:(...args)=>{launch=args;return child}});
 const messages=[];child.stdin.on('data',data=>{for(const line of data.toString().trim().split('\n'))messages.push(JSON.parse(line))});
 assert.ok(launch[1].includes('default_permissions="sessiontv"'));
 assert.ok(launch[1].includes('forced_login_method="chatgpt"'));
 assert.ok(launch[1].some(a=>a.includes('":minimal"="read"')));
 assert.equal(launch[2].shell,false);
 for(const key of Object.keys(launch[2].env))assert.doesNotMatch(key,/API_KEY|ACCESS_TOKEN|SESSIONTV_|SUPABASE_|ANTHROPIC|AWS_/i);
 const initialized=bridge.initialize();bridge.receive(JSON.stringify({id:1,result:{}}));await initialized;
 assert.ok(messages.some(m=>m.method==='initialized'));
 bridge.receive(JSON.stringify({id:100,method:'item/commandExecution/requestApproval',params:{command:'dangerous'}}));
 assert.deepEqual(messages.at(-1),{id:100,result:{decision:'decline'}});
 bridge.receive(JSON.stringify({id:101,method:'item/permissions/requestApproval',params:{permissions:{network:{enabled:true}}}}));
 assert.deepEqual(messages.at(-1),{id:101,result:{permissions:{}}});bridge.stop();
});
test('coding does not begin with API authentication or an unconfirmed permission profile',async()=>{
 const calls=[];
 const bridge=Object.create(CodexBridge.prototype);
 bridge.account=async()=>({signedIn:false,authType:'apiKey'});
 bridge.request=async(method)=>{calls.push(method);return {}};
 await assert.rejects(bridge.start(tmpdir(),'hello'),/API-key authentication is disabled/);assert.deepEqual(calls,[]);
 bridge.account=async()=>({signedIn:true,authType:'chatgpt'});
 bridge.request=async(method)=>{calls.push(method);return method==='permissionProfile/list'?{data:[{id:'sessiontv',allowed:true}]}:{activePermissionProfile:':danger-full-access',thread:{id:'fake'}}};
 await assert.rejects(bridge.start(tmpdir(),'hello'),/No coding turn was started/);
 assert.deepEqual(calls,['permissionProfile/list','thread/start']);
});

test('saved conversations resume only in their original restricted folder',async()=>{
 const calls=[];
 const bridge=Object.create(CodexBridge.prototype);
 bridge.account=async()=>({signedIn:true});
 bridge.emit=()=>{};
 bridge.request=async(method,params)=>{
  calls.push({method,params});
  if(method==='permissionProfile/list')return {data:[{id:'sessiontv',allowed:true}]};
  if(method==='thread/read')return {thread:{cwd:tmpdir()}};
  if(method==='model/list')return {data:[{id:'latest',model:'latest',isDefault:true,supportedReasoningEfforts:['low','medium','high','xhigh'].map(reasoningEffort=>({reasoningEffort}))}]};
  return {thread:{id:'saved-chat'},cwd:tmpdir(),runtimeWorkspaceRoots:[tmpdir()],activePermissionProfile:'sessiontv',approvalPolicy:'on-request',approvalsReviewer:'user',modelProvider:'openai'};
 };
 assert.equal(await bridge.start(tmpdir(),'continue','saved-chat'),'saved-chat');
 assert.equal(calls.find(c=>c.method==='thread/resume').params.threadId,'saved-chat');
 assert.equal(calls.at(-1).method,'turn/start');
 calls.length=0;
 await assert.rejects(bridge.start('/different-folder','continue','saved-chat'),/different folder/);
 assert.equal(calls.some(c=>c.method==='turn/start'),false);
});

test('remembered device token still requires owner authentication and exact origin',async()=>{
 const companion=createCompanion({port:0,origin:'https://tannermayfield.dev',supabaseUrl:'https://test.supabase.co',publishableKey:'public',ownerId:'owner',home:tmpdir(),workspaces:[tmpdir()],deviceToken:'remembered-device-secret',verifyUser:async token=>({id:token}),bridgeFactory:()=>new FakeBridge()});
 await companion.listen();
 try {
  const request=(user,origin)=>fetch('http://127.0.0.1:'+companion.server.address().port+'/status',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+user,'X-SessionTV-Pair':'remembered-device-secret'},body:'{}'});
  assert.equal((await request('owner','https://tannermayfield.dev')).status,200);
  assert.equal((await request('visitor','https://tannermayfield.dev')).status,403);
  assert.equal((await request('owner','https://foreign.example')).status,403);
 } finally {await new Promise(resolve=>companion.server.close(resolve))}
});

test('starter modes confirm object permission metadata and name persistent threads before any inference',async()=>{
 const bridge=Object.create(CodexBridge.prototype),calls=[];
 bridge.account=async()=>({signedIn:true});
 bridge.request=async(method,params)=>{
  calls.push({method,params});
  if(method==='permissionProfile/list')return {data:[{id:'sessiontv_plan',allowed:true}]};
  return {thread:{id:'plan-chat'},cwd:tmpdir(),runtimeWorkspaceRoots:[tmpdir()],activePermissionProfile:{id:'sessiontv_plan'},approvalPolicy:'on-request',approvalsReviewer:'user',modelProvider:'openai'};
 };
 assert.equal(await bridge.prepare(tmpdir(),'plan'),'plan-chat');
 assert.equal(calls.at(-1).method,'thread/name/set');
 assert.equal(calls.find(call=>call.method==='thread/start').params.permissions,'sessiontv_plan');
 assert.equal(calls.some(call=>call.method==='turn/start'),false);
});


test('model catalog follows server recommendation across paginated account-scoped results',async()=>{
 const bridge=Object.create(CodexBridge.prototype),calls=[];bridge.account=async()=>({signedIn:true});
 bridge.request=async(method,params)=>{calls.push({method,params});return params.cursor?{data:[{id:'recommended',model:'recommended-model',displayName:'Recommended',isDefault:true,supportedReasoningEfforts:[{reasoningEffort:'low'},{reasoningEffort:'medium'},{reasoningEffort:'ultra'}]}]}:{data:[{id:'z-looks-newer',supportedReasoningEfforts:[]}],nextCursor:'second'}};
 const catalog=await bridge.models();assert.equal(catalog.selectedModel,'recommended-model');assert.deepEqual(catalog.efforts,['low','medium']);assert.equal(calls.length,2);assert.equal(calls[1].params.cursor,'second');
 bridge.account=async()=>({signedIn:false});await assert.rejects(bridge.models(),/Sign in with ChatGPT/);assert.equal(calls.length,2);
});

test('Plan and Apply force Light while Work defaults Medium and only supported effort reaches a turn',async()=>{
 const bridge=Object.create(CodexBridge.prototype),calls=[],events=[];bridge.prepare=async()=> 'thread';bridge.emit=(method,event)=>events.push(event);
 bridge.models=async()=>({models:[{id:'newest',displayName:'Newest'},{id:'gpt-6-luna',displayName:'Luna',efforts:['low']}],selectedModel:'newest',efforts:['low','medium','high','xhigh']});bridge.request=async(method,params)=>{calls.push({method,params});return {}};
 for(const mode of ['plan','apply']){await bridge.start(tmpdir(),'message',undefined,mode,'xhigh');assert.equal(calls.at(-1).params.effort,'low');assert.equal(calls.at(-1).params.model,'gpt-6-luna')}
 await bridge.start(tmpdir(),'message');assert.equal(calls.at(-1).params.effort,'medium');assert.equal(calls.at(-1).params.model,'newest');
 for(const effort of ['low','medium','high','xhigh']){await bridge.start(tmpdir(),'message',undefined,'work',effort);assert.equal(calls.at(-1).params.effort,effort)}
 const count=calls.length;await assert.rejects(bridge.start(tmpdir(),'message',undefined,'work','unsupported'),/does not support/);assert.equal(calls.length,count);
 bridge.models=async()=>({models:[{id:'newest'},{id:'gpt-6-luna',efforts:['medium']}],selectedModel:'newest',efforts:['medium']});await assert.rejects(bridge.start(tmpdir(),'message',undefined,'plan'),/does not support low/);assert.equal(calls.length,count);
 bridge.models=async()=>({models:[{id:'newest',efforts:['low']}],selectedModel:'newest',efforts:['low']});await assert.rejects(bridge.start(tmpdir(),'message',undefined,'apply'),/Luna is unavailable/);assert.equal(calls.length,count);
 assert.ok(events.some(event=>event.method==='sessiontv/model'&&event.params.effort==='medium'));
});

test('models endpoint requires pairing and authorizes a requested folder before listing',()=>fixture(async({companion,post,workspaces,starts})=>{
 assert.equal((await post('/models')).status,401);assert.equal(starts(),0);
 const token=(await (await post('/pair',{code:companion.pairingCode})).json()).token,headers={'X-SessionTV-Pair':token};
 assert.equal((await post('/models',{workspace:process.cwd()},headers)).status,403);
 const response=await post('/models',{workspace:workspaces[0]},headers);assert.equal(response.status,200);const result=await response.json();assert.equal(result.selectedModel,'latest');assert.deepEqual(result.efforts,['low','medium','high','xhigh']);
 assert.equal((await post('/run',{workspace:workspaces[0],prompt:'hello',effort:'invalid'},headers)).status,400);
}));

async function loginFixture(callback,{authUrl='https://auth.openai.com/authorize?state=test',signedIn=false}={}){
 const workspaces=await canonicalWorkspaces([tmpdir()]);let clock=1000,accountSignedIn=signedIn;const bridges=[];
 class LoginBridge extends EventEmitter{
  constructor(){super();this.requests=[];this.stops=0;bridges.push(this);}
  get signedIn(){return accountSignedIn;}
  set signedIn(value){accountSignedIn=value;}
  async initialize(){}
  async account(){return {signedIn:this.signedIn,authType:this.signedIn?'chatgpt':null};}
  async request(method,params){this.requests.push({method,params});return {type:'chatgpt',loginId:'test-login',authUrl};}
  stop(){this.stops++;}
 }
 const companion=createCompanion({port:0,origin:'https://tannermayfield.dev',supabaseUrl:'https://test.supabase.co',publishableKey:'public',ownerId:'owner',home:tmpdir()+'-sessiontv-login',workspaces,now:()=>clock,deviceToken:'remembered',verifyUser:async token=>({id:token==='owner-jwt'?'owner':'visitor'}),bridgeFactory:()=>new LoginBridge()});
 await companion.listen();const url='http://127.0.0.1:'+companion.server.address().port;
 const post=(route,body={},headers={})=>fetch(url+route,{method:'POST',headers:{Origin:'https://tannermayfield.dev','Content-Type':'application/json',Authorization:'Bearer owner-jwt','X-SessionTV-Pair':'remembered',...headers},body:JSON.stringify(body)});
 try{await callback({post,companion,bridges,workspaces,advance:milliseconds=>clock+=milliseconds});}finally{if(companion.server.listening)await new Promise(resolve=>companion.server.close(resolve));}
}
test('Codex connect requires paired owner and does not initiate another login when already connected',()=>loginFixture(async({post,bridges})=>{
 assert.equal((await post('/codex/connect',{}, {'X-SessionTV-Pair':''})).status,401);assert.equal((await post('/codex/connect',{}, {Authorization:'Bearer visitor-jwt'})).status,403);assert.equal(bridges.length,0);
 const result=await(await post('/codex/connect')).json();assert.equal(result.connected,true);assert.equal(result.authUrl,null);assert.equal(bridges[0].requests.length,0);assert(bridges[0].stops>0);
},{signedIn:true}));
test('Codex login survives HTTP response and verifies matching completion before reporting connected',()=>loginFixture(async({post,bridges,workspaces})=>{
 const result=await(await post('/codex/connect')).json();assert.equal(result.pending,true);assert.equal(result.loginId,'test-login');assert.equal(result.authUrl,'https://auth.openai.com/authorize?state=test');const bridge=bridges[0];assert.equal(bridge.stops,0);
 assert.deepEqual(bridge.requests,[{method:'account/login/start',params:{type:'chatgpt',useHostedLoginSuccessPage:true,appBrand:'codex'}}]);
 assert.equal((await(await post('/codex/connect')).json()).authUrl,result.authUrl);assert.equal(bridges.length,1);
 assert.equal((await(await post('/status')).json()).loginPending,true);assert.equal(bridges.length,1);
 assert.deepEqual(await(await post('/codex/login-status')).json(),{pending:true,connected:false,error:null});
 assert.equal((await post('/models')).status,409);assert.equal((await post('/projects/prepare',{folder:workspaces[0]})).status,409);assert.equal((await post('/run',{workspace:workspaces[0],prompt:'Hi'})).status,409);
 bridge.emit('event',{method:'account/login/completed',params:{loginId:'other-login',success:true}});assert.equal(bridge.stops,0);
 bridge.signedIn=true;bridge.emit('event',{method:'account/login/completed',params:{loginId:'test-login',success:true}});await new Promise(resolve=>setImmediate(resolve));assert(bridge.stops>0);assert.equal(bridge.listenerCount('event'),0);
 // A fresh status probe verifies the persisted account without exposing credentials.
 bridges.length=0;
 const status=await(await post('/codex/login-status')).json();assert.equal(status.pending,false);assert.equal(status.connected,true);assert(!JSON.stringify(status).includes('authUrl'));
}));
test('Codex login errors are safe and completion success without authenticated account remains disconnected',()=>loginFixture(async({post,bridges})=>{
 await post('/codex/connect');bridges[0].emit('event',{method:'account/login/completed',params:{loginId:'test-login',success:false,error:'secret-access-token'}});assert(bridges[0].stops>0);let status=await(await post('/codex/login-status')).json();assert.equal(status.connected,false);assert(!status.error.includes('secret-access-token'));
 await post('/codex/connect');const bridge=bridges.at(-1);bridge.emit('event',{method:'account/login/completed',params:{loginId:'test-login',success:true}});await new Promise(resolve=>setImmediate(resolve));assert(bridge.stops>0);status=await(await post('/codex/login-status')).json();assert.equal(status.connected,false);assert.match(status.error,/did not confirm/);
}));
test('Codex login rejects untrusted authorization URLs and cleans up its bridge',async()=>{
 for(const authUrl of ['https://evil.example/authorize','http://auth.openai.com/authorize','https://secret@chatgpt.com/authorize','https://chatgpt.com/authorize?access_token=secret'])await loginFixture(async({post,bridges})=>{const response=await post('/codex/connect');assert.equal(response.status,503);assert(bridges[0].stops>0);assert.equal(bridges[0].listenerCount('event'),0);assert(!(await response.text()).includes('secret'));},{authUrl});
});
test('Codex login expires in five minutes and server close clears pending listeners and child',()=>loginFixture(async({post,bridges,advance,companion})=>{
 await post('/codex/connect');const first=bridges[0];advance(300001);const status=await(await post('/codex/login-status')).json();assert.equal(status.pending,false);assert.equal(status.connected,false);assert.match(status.error,/expired/);assert(first.stops>0);
 await post('/codex/connect');const second=bridges.at(-1);await new Promise(resolve=>companion.server.close(resolve));assert(second.stops>0);assert.equal(second.listenerCount('event'),0);assert.equal(second.listenerCount('stopped'),0);
}));
