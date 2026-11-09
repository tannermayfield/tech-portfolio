import {test,after,before} from 'node:test';
import assert from 'node:assert/strict';
import {server} from '../server.mjs';
let base;
before(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port});
after(()=>new Promise(r=>server.close(r)));
test('serves the TV, scripts and optional-AI status',async()=>{
 const res=await fetch(base);assert.equal(res.status,200);
 const html=await res.text();assert.match(html,/id="crt"/);assert.match(html,/js\/platform.js/);
 const config=await (await fetch(base+'/api/config')).json();
 assert.equal(typeof config.aiConfigured,'boolean');
 assert.equal((await fetch(base+'/js/artifact/17.js')).status,200);
});
test('does not expose secrets or accept foreign origins',async()=>{
 for(const file of ['/.env','/server.mjs','/package.json','/%2eenv','/..%5c.env'])
  assert.equal((await fetch(base+file)).status,404,file);
 assert.equal((await fetch(base+'/api/config',{headers:{Origin:'https://example.com'}})).status,403);
});
test('missing AI key is an explicit, actionable error',async()=>{
 if(process.env.ANTHROPIC_API_KEY)return;
 const res=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'test'}]})});
 assert.equal(res.status,503);assert.match((await res.json()).error,/ANTHROPIC_API_KEY/);
});
