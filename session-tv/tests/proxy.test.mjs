import {test} from 'node:test';
import assert from 'node:assert/strict';
test('AI proxy forwards conversations without exposing the server key',async()=>{
 process.env.ANTHROPIC_API_KEY='test-key-only';
 const {server}=await import('../server.mjs?configured-test');
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port;
 const realFetch=globalThis.fetch;let forwarded;
 globalThis.fetch=async(input,options)=>{
  if(String(input)==='https://api.anthropic.com/v1/messages'){
   forwarded=options;return Response.json({content:[{type:'text',text:'Explain what GROUP BY does.'}]});
  }
  return realFetch(input,options);
 };
 try{
  const config=await (await fetch(url+'/api/config')).json();assert.equal(config.aiConfigured,true);assert.equal(config.apiKey,undefined);
  const response=await fetch(url+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'Teach me SQL.'}]})});
  assert.equal(response.status,200);assert.match((await response.json()).text,/GROUP BY/);
  assert.equal(forwarded.headers['x-api-key'],'test-key-only');
  assert.equal(JSON.parse(forwarded.body).messages[0].content,'Teach me SQL.');
  const bad=await fetch(url+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'system',content:'invalid'}]})});
  assert.equal(bad.status,400);
 }finally{globalThis.fetch=realFetch;await new Promise(r=>server.close(r));delete process.env.ANTHROPIC_API_KEY}
});
