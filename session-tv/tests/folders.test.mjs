import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {folderStore,validateFolder} from '../companion/folders.mjs';
import {createCompanion} from '../companion/server.mjs';

async function fixture(callback) {
 const root=await mkdtemp(path.join(tmpdir(),'sessiontv-folders-'));
 const home=path.join(root,'credentials'),first=path.join(root,'first'),chosen=path.join(root,'chosen'),configPath=path.join(root,'configuration','settings.json');
 await Promise.all([mkdir(home),mkdir(first),mkdir(chosen),mkdir(path.dirname(configPath))]);
 await writeFile(configPath,JSON.stringify({ownerId:'owner',deviceToken:'keep-secret',folders:[first]}));
 try {await callback({root,home,first,chosen,configPath})}finally{await rm(root,{recursive:true,force:true})}
}

test('native selection validates and saves new authorized folders without replacing credentials',()=>fixture(async({home,first,chosen,configPath,root})=>{
 const store=folderStore({configPath,initialWorkspaces:[first],home,pickFolder:async()=>chosen,openFolder:async folder=>assert.equal(folder,chosen)});
 await assert.rejects(store.authorized(chosen),/folder picker first/);
 assert.deepEqual(await store.choose(),{folder:chosen});
 assert.deepEqual(await store.open(chosen),{opened:true});
 const saved=JSON.parse(await readFile(configPath,'utf8'));
 assert.equal(saved.ownerId,'owner');assert.equal(saved.deviceToken,'keep-secret');assert.deepEqual(saved.folders,[first,chosen]);
 await assert.rejects(validateFolder(root,home),/credential profile/);
 await assert.rejects(validateFolder(path.parse(root).root,home),/within a drive/);
}));

test('project provisioning saves each mode and retries reuse partial thread references',()=>fixture(async({home,first,configPath})=>{
 const store=folderStore({configPath,initialWorkspaces:[first],home});
 let fail=true;const calls=[];
 const bridge={async prepare(folder,mode,threadId){calls.push({folder,mode,threadId});if(mode==='apply'&&fail)throw new Error('sandbox unavailable');return threadId||mode+'-thread'}};
 await assert.rejects(store.prepare(first,bridge),/sandbox unavailable/);
 fail=false;const prepared=await store.prepare(first,bridge);
 assert.deepEqual(prepared.chats,[{mode:'plan',threadId:'plan-thread'},{mode:'apply',threadId:'apply-thread'},{mode:'work',threadId:'work-thread'}]);
 assert.equal(calls[2].threadId,'plan-thread');
 const reloaded=folderStore({configPath,initialWorkspaces:[first],home});calls.length=0;
 await reloaded.prepare(first,bridge);
 assert.equal(calls.every(call=>!!call.threadId),true);
}));

test('folder routes require paired owner and block concurrent native operations',()=>fixture(async({home,first,chosen,configPath})=>{
 let release,selected=0;
 const pickFolder=()=>{selected++;return new Promise(resolve=>{release=()=>resolve(chosen)})};
 class Bridge extends EventEmitter {async initialize(){}async prepare(folder,mode,id){return id||mode+'-thread'}stop(){}}
 const companion=createCompanion({port:0,origin:'https://tannermayfield.dev',supabaseUrl:'https://test.supabase.co',publishableKey:'public',ownerId:'owner',home,workspaces:[first],configPath,deviceToken:'paired',pickFolder,verifyUser:async token=>({id:token}),bridgeFactory:()=>new Bridge()});
 await companion.listen();
 const post=(route,body={},user='owner',token='paired')=>fetch('http://127.0.0.1:'+companion.server.address().port+route,{method:'POST',headers:{Origin:'https://tannermayfield.dev','Content-Type':'application/json',Authorization:'Bearer '+user,'X-SessionTV-Pair':token},body:JSON.stringify(body)});
 try {
  assert.equal((await post('/folders/pick',{},'visitor')).status,403);
  assert.equal((await post('/folders/pick',{},'owner','wrong')).status,401);assert.equal(selected,0);
  const pending=post('/folders/pick');
  while(!release)await new Promise(resolve=>setTimeout(resolve,1));
  assert.equal((await post('/projects/prepare',{folder:first})).status,409);
  release();assert.equal((await pending).status,200);
  assert.equal((await post('/projects/prepare',{folder:chosen,projectId:'../bad-reference'})).status,400);
  const response=await post('/projects/prepare',{folder:chosen});assert.equal(response.status,200);assert.equal((await response.json()).chats.length,3);
 } finally {await new Promise(resolve=>companion.server.close(resolve))}
}));


test('projects sharing one folder keep distinct starter conversations and stable retries',()=>fixture(async({home,first,configPath})=>{
 const store=folderStore({configPath,initialWorkspaces:[first],home});
 let created=0;
 const bridge={async prepare(folder,mode,threadId){return threadId||mode+'-'+(++created)}};
 const firstProject=await store.prepare(first,bridge,'first-project');
 const secondProject=await store.prepare(first,bridge,'second-project');
 assert.equal(created,6);
 assert.equal(firstProject.chats.some(firstChat=>secondProject.chats.some(secondChat=>firstChat.threadId===secondChat.threadId)),false);
 const reloaded=folderStore({configPath,initialWorkspaces:[first],home});
 assert.deepEqual(await reloaded.prepare(first,bridge,'first-project'),firstProject);
 assert.deepEqual(await reloaded.prepare(first,bridge,'second-project'),secondProject);
 assert.equal(created,6);
}));
