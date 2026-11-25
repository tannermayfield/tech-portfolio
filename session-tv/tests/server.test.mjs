import {test,after,before} from 'node:test';
import assert from 'node:assert/strict';
import {server} from '../server.mjs';
import {appScripts} from './manifest.mjs';
let base;
before(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port});
after(()=>new Promise(r=>server.close(r)));
test('serves the TV and every script in the manifest',async()=>{
 const res=await fetch(base);assert.equal(res.status,200);
 const html=await res.text();assert.match(html,/id="crt"/);assert.match(html,/js\/platform.js/);assert.match(html,/js\/manifest.js/);
 for(const name of appScripts())assert.equal((await fetch(base+'/js/'+name)).status,200,name);
});
test('does not expose secrets or accept foreign origins',async()=>{
 for(const file of ['/.env','/server.mjs','/package.json','/%2eenv','/..%5c.env'])
  assert.equal((await fetch(base+file)).status,404,file);
 assert.equal((await fetch(base+'/',{headers:{Origin:'https://example.com'}})).status,403);
});
test('serves static files only: no API routes and no writes',async()=>{
 assert.equal((await fetch(base+'/api/config')).status,404);
 assert.equal((await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,405);
});
