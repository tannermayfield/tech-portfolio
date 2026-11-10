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
 async start(cwd,prompt){this.cwd=cwd;this.prompt=prompt;setTimeout(()=>{this.emit('event',{method:'item/agentMessage/delta',params:{delta:'Hello'}});this.emit('event',{method:'turn/completed',params:{turn:{status:'completed'}}})},1)}
 stop(){}
}
async function fixture(callback){
 const workspaces=await canonicalWorkspaces([tmpdir()]);let starts=0;
 const companion=createCompanion({port:0,origin:'https://tannermayfield.dev',supabaseUrl:'https://test.supabase.co',publishableKey:'public',ownerId:'owner',home:tmpdir(),workspaces,
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
  return {thread:{id:'saved-chat'},cwd:tmpdir(),runtimeWorkspaceRoots:[tmpdir()],activePermissionProfile:'sessiontv',approvalPolicy:'on-request',approvalsReviewer:'user',modelProvider:'openai'};
 };
 assert.equal(await bridge.start(tmpdir(),'continue','saved-chat'),'saved-chat');
 assert.equal(calls.find(c=>c.method==='thread/resume').params.threadId,'saved-chat');
 assert.equal(calls.at(-1).method,'turn/start');
 calls.length=0;
 await assert.rejects(bridge.start('/different-folder','continue','saved-chat'),/different folder/);
 assert.equal(calls.some(c=>c.method==='turn/start'),false);
});
