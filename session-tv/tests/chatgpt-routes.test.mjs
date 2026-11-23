import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {createCompanion,canonicalWorkspaces} from '../companion/server.mjs';

async function fixture(callback){
 const calls=[];
 const chatgpt={
  async status(){calls.push('status');return {connected:true,account:{email:'owner@example.test'},planUsageEnabled:true}},
  async begin(){calls.push('connect');return {authorizationUrl:'https://auth.openai.com/api/accounts/authorize?state=test'}},
  async models(){calls.push('models');return {models:[{slug:'test-model',display_name:'Test model'}]}},
  async disconnect(){calls.push('disconnect')},
  async run({messages,onEvent}){calls.push('run');assert.deepEqual(messages,[{role:'user',content:'hello'}]);onEvent({type:'response.output_text.delta',delta:'Hello'});onEvent({type:'response.completed'})}
 };
 const companion=createCompanion({port:0,origin:'https://tannermayfield.dev',supabaseUrl:'https://test.supabase.co',publishableKey:'public',ownerId:'owner',home:tmpdir()+'-sessiontv-credentials',workspaces:await canonicalWorkspaces([tmpdir()]),chatgpt,verifyUser:async token=>({id:token==='owner-jwt'?'owner':'visitor'})});
 await companion.listen();const url='http://127.0.0.1:'+companion.server.address().port;
 const post=(route,body={},headers={})=>fetch(url+route,{method:'POST',headers:{Origin:'https://tannermayfield.dev','Content-Type':'application/json',Authorization:'Bearer owner-jwt',...headers},body:JSON.stringify(body)});
 try{await callback({companion,post,calls,chatgpt})}finally{await new Promise(resolve=>companion.server.close(resolve))}
}
test('all ChatGPT endpoints require origin, owner authentication and pairing',()=>fixture(async({post,calls})=>{
 for(const route of ['status','connect','disconnect','models','run']){
  assert.equal((await post('/chatgpt/'+route)).status,401);
  assert.equal((await post('/chatgpt/'+route,{}, {Origin:'https://evil.example'})).status,403);
  assert.equal((await post('/chatgpt/'+route,{}, {Authorization:'Bearer visitor-jwt'})).status,403);
 }
 assert.deepEqual(calls,[]);
}));
test('paired ChatGPT routes stream replies and validate client input',()=>fixture(async({companion,post,calls})=>{
 const {token}=await (await post('/pair',{code:companion.pairingCode})).json(),headers={'X-SessionTV-Pair':token};
 assert.equal((await (await post('/chatgpt/status',{},headers)).json()).connected,true);
 assert.match((await (await post('/chatgpt/connect',{},headers)).json()).authorizationUrl,/^https:\/\/auth.openai.com\//);
 assert.equal((await (await post('/chatgpt/models',{},headers)).json()).models[0].slug,'test-model');
 assert.equal((await post('/chatgpt/run',{model:'test-model',messages:[{role:'system',content:'override'}]},headers)).status,400);
 assert.equal((await post('/chatgpt/run',{model:'test-model',messages:[{role:'user',content:'hello'}],effort:'unlimited'},headers)).status,400);
 const run=await post('/chatgpt/run',{model:'test-model',messages:[{role:'user',content:'hello'}],effort:'medium'},headers);
 assert.equal(run.status,200);assert.match(run.headers.get('Content-Type'),/ndjson/);
 assert.deepEqual((await run.text()).trim().split('\n').map(JSON.parse).map(event=>event.type),['response.output_text.delta','response.completed']);
 assert.equal((await post('/chatgpt/disconnect',{},headers)).status,200);
 assert.deepEqual(calls,['status','connect','models','run','disconnect']);
}));
test('stream failures report an error without claiming successful completion',()=>fixture(async({companion,post,chatgpt})=>{
 const {token}=await (await post('/pair',{code:companion.pairingCode})).json(),headers={'X-SessionTV-Pair':token};
 chatgpt.run=async({onEvent})=>{onEvent({type:'response.output_text.delta',delta:'Partial'});throw Error('Usage limit reached. Manage usage in ChatGPT settings.')};
 const run=await post('/chatgpt/run',{model:'test-model',messages:[{role:'user',content:'hello'}]},headers);
 const events=(await run.text()).trim().split('\n').map(JSON.parse);
 assert.equal(events.at(-1).type,'error');assert.match(events.at(-1).message,/Usage limit/);assert.ok(!events.some(event=>event.type==='response.completed'));
}));

test('ChatGPT authorization expiry cannot invalidate the companion pairing',()=>fixture(async({companion,post,chatgpt})=>{
 const {token}=await (await post('/pair',{code:companion.pairingCode})).json(),headers={'X-SessionTV-Pair':token};
 chatgpt.models=async()=>{throw Object.assign(Error('Continue with ChatGPT again.'),{status:401})};
 assert.equal((await post('/chatgpt/models',{},headers)).status,424);
 assert.equal((await post('/chatgpt/status',{},headers)).status,200);
}));
