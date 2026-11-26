import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import jsdom from 'jsdom';
import demo from '../public/js/demo-snapshot.js';
import {publicSnapshot} from '../scripts/publish-preview.mjs';
import {createCompanion,canonicalWorkspaces} from '../companion/server.mjs';

const OWNER='6d3b9c20-f93c-45c7-bc60-53764d8e0c80';
const source=name=>readFileSync(new URL('../public/js/'+name,import.meta.url),'utf8');
const P='PRIVATE';
function privateBackup(){
 const database={
  tasks:{
   a:{track:'class',title:'Essay draft',course:'ENG 101 — Writing',due:'2026-12-01',status:'todo',order:1,codexPrompt:P,canvas:{courseId:P,url:P,assignmentId:P},url:P,notes:P,folder:P},
   b:{track:'develop',title:'CTEs',course:'SQL',cat:'Data',level:2,reps:3,skillChat:{turns:[{content:P}]}},
   c:{track:'project',title:'Ship page',course:'Portfolio',goal:'Launch',status:'done',doneAt:'2026-11-01T00:00:00Z',codexPrompt:P}
  },
  projects:{portfolio:{name:'Portfolio',skills:['SQL'],computerFolder:P,codingChats:{x:P},notes:P,taskOrder:['c'],taskAssignments:{c:'ai'},sprint:{num:2,goal:'Ship',notes:P,items:[{id:'c',pts:3,who:'me',chat:P}]},past:[{num:1,goal:'Plan',retro:P,items:['c']}]}},
  sessions:{s1:{date:'2026-11-20T10:00:00Z',minutes:45,track:'class',byTrack:{class:45,skill:0,project:0},recap:P,feedback:P,skillChats:{b:{turns:[{content:P}]}},tasks:[{id:'a',title:P}],projectTime:{p:P},skills:P,confidence:4}},
  state:{current:{active:P}},settings:{main:{email:P,token:P}}
 };
 return {format:'session-tv-backup',version:1,values:{'sessiontv.database.v1':JSON.stringify(database),
  'sb.classes':JSON.stringify({'ENG 101 — Writing':{code:'ENG 101',name:'Writing',url:P,canvasId:P,description:P}}),
  'sb.skillCategories':JSON.stringify(['Data','Design']),
  'sb.skills':JSON.stringify({Data:['SQL','dbt'],Design:['Figma']}),
  'sb.skillChannels':JSON.stringify({'skill:Data:SQL':{level:3,reps:4,lastPracticed:'2026-11-19T00:00:00Z',chat:P,threadId:P}}),
  'sb.sectionThemes':JSON.stringify({class:'library',skill:'lab',project:'studio',other:P}),
  'sb.sectionCharacters':JSON.stringify({class:'Ada',skill:'Grace',project:'Linus'}),
  'sb.studyChats':JSON.stringify({a:P}),'sb.chatgptChats':JSON.stringify([P]),'sb.projectCodingChats':JSON.stringify({p:P}),'sb.localChats':JSON.stringify([P]),
  'sb.chatgptAccount':JSON.stringify(P),'sb.canvasAccount':JSON.stringify(P),'sb.canvasCourses':JSON.stringify({1:P}),'sb.codexApproval':JSON.stringify(P),'sb.draft2':JSON.stringify({goal:P}),'sb.ws.one':P}};
}

test('allowlist publishes owner records and preferences and nothing private',()=>{
 const snapshot=demo.publicSnapshot(privateBackup()),file=demo.renderDemoFile(snapshot);
 assert.equal(JSON.stringify(snapshot).includes(P),false);assert.equal(file.includes(P),false);
 assert.deepEqual(snapshot.database.tasks.a,{track:'class',title:'Essay draft',course:'ENG 101 — Writing',status:'todo',order:1,due:'2026-12-01'});
 assert.equal(snapshot.database.tasks.b.cat,'Data');
 assert.deepEqual(snapshot.database.sessions.s1,{date:'2026-11-20T10:00:00Z',minutes:45,track:'class',byTrack:{class:45,skill:0,project:0}});
 assert.deepEqual(snapshot.database.projects.portfolio.sprint.items,[{id:'c',pts:3,who:'me'}]);
 assert.deepEqual(snapshot.database.state,{});assert.equal(snapshot.database.settings.main.email,undefined);
 assert.deepEqual(Object.keys(snapshot.preferences).sort(),[...demo.PREFERENCE_KEYS].sort());
 assert.deepEqual(snapshot.preferences['sb.classes'],{'ENG 101 — Writing':{code:'ENG 101',name:'Writing'}});
 assert.deepEqual(snapshot.preferences['sb.skills'],{Data:['SQL','dbt'],Design:['Figma']});
 assert.deepEqual(snapshot.preferences['sb.skillChannels'],{'skill:Data:SQL':{level:3,reps:4,lastPracticed:'2026-11-19T00:00:00Z'}});
 assert.deepEqual(snapshot.preferences['sb.sectionThemes'],{class:'library',skill:'lab',project:'studio'});
 assert.equal(publicSnapshot,demo.publicSnapshot);
 const context=vm.createContext({});context.window=context;vm.runInContext(file,context);assert.equal(context.window.SessionTVDemo.preferences['sb.sectionCharacters'].skill,'Grace');
 assert.match(demo.renderDemoFile(demo.publicSnapshot({...privateBackup(),values:{...privateBackup().values,'sb.skillCategories':JSON.stringify(['</script><b>'])}})),/\\u003c\/script>/);
 const summary=demo.summary(snapshot);assert.equal(summary.find(group=>group.label==='Class assignments').items[0],'Essay draft — ENG 101 — Writing');
});

test('validation rejects snapshots carrying fields outside the allowlist',()=>{
 const clean=demo.publicSnapshot(privateBackup()),copy=()=>JSON.parse(JSON.stringify(clean));
 assert.doesNotThrow(()=>demo.validateSnapshot(copy()));
 const cases=[
  s=>{s.database.tasks.a.codexPrompt=P},s=>{s.database.sessions.s1.recap=P},s=>{s.database.projects.portfolio.computerFolder=P},
  s=>{s.preferences['sb.localChats']=[P]},s=>{s.preferences['sb.classes']['ENG 101 — Writing'].url=P},s=>{s.database.state={current:{active:P}}},
  s=>{s.database.settings.main.email=P},s=>{s.extra=P},s=>{s.source='sample'},s=>{s.database.tasks.a.title={nested:P}}
 ];
 for(const change of cases){const s=copy();change(s);assert.throws(()=>demo.validateSnapshot(s),undefined,String(change))}
 const proto=JSON.parse(JSON.stringify(clean).replace('"a":{','"__proto__":{'));assert.throws(()=>demo.validateSnapshot(proto));
 assert.throws(()=>demo.validateSnapshot(undefined));
});

test('demo mode loads published preferences so menus match the owner',()=>{
 const snapshot=demo.publicSnapshot(privateBackup());
 const context=vm.createContext({location:{hostname:'tannermayfield.dev',pathname:'/session-tv/'},localStorage:{setItem(){},removeItem(){}},console,queueMicrotask,crypto:globalThis.crypto});
 context.window=context;vm.runInContext(source('storage.js'),context);
 vm.runInContext('window.SessionTVDemo='+JSON.stringify({...snapshot,preferences:{...snapshot.preferences,'sb.localChats':[P]}}),context);
 vm.runInContext(source('workspace.js'),context);
 const storage=context.SessionWorkspace.storage;assert.equal(context.SessionWorkspace.mode,'demo');
 assert.deepEqual(JSON.parse(storage.getItem('sb.skillCategories')),['Data','Design']);
 assert.equal(JSON.parse(storage.getItem('sb.classes'))['ENG 101 — Writing'].code,'ENG 101');
 assert.equal(storage.getItem('sb.localChats'),null);
 assert.equal(JSON.parse(storage.getItem('sessiontv.database.v1')).tasks.b.title,'CTEs');
 const workspaceKeys=source('workspace.js').match(/const demoPreferences=(\[[^\]]+\])/)[1];assert.deepEqual(JSON.parse(workspaceKeys.replaceAll("'",'"')),demo.PREFERENCE_KEYS);
});

function settingsWindow({ownerId=OWNER,user=OWNER,mode='private',publishDemo}={}){
 const dom=new jsdom.JSDOM('<div id="set-body"></div>',{runScripts:'outside-only',url:'https://tannermayfield.dev/session-tv/'});const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
 const calls=[];
 Object.assign(w,{SessionTVConfig:{ownerId},SessionWorkspace:{mode},SessionCloud:{user:user?{id:user}:null,exportBackup:async()=>privateBackup()},
  SessionCompanion:{publishDemo:async snapshot=>{calls.push(snapshot);return publishDemo(snapshot)}},SessionProjectPublish:{verify:commit=>calls.push(commit)}});
 w.eval(source('core/hooks.js'));
 w.eval(`var TV={dbView:null};function renderSettings(){return SessionTV.hooks.run('settings:render',arguments,()=>{document.getElementById('set-body').innerHTML='<div class="set-grid"><div class="set-card"><h3>Account</h3><button id="local-open">Sign out</button></div></div>'})}`);
 w.eval(source('demo-snapshot.js'));w.eval(source('demo-export.js'));w.eval('renderSettings()');
 return {w,calls};
}
const until=async check=>{for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,5))}throw Error('timed out')};

test('Publish to demo is shown only to the configured owner',()=>{
 assert.ok(settingsWindow().w.document.getElementById('demo-publish-open'));
 assert.equal(settingsWindow({user:'11111111-1111-1111-1111-111111111111'}).w.document.getElementById('demo-publish-open'),null);
 assert.equal(settingsWindow({ownerId:''}).w.document.getElementById('demo-publish-open'),null);
 assert.equal(settingsWindow({ownerId:'owner@example.com',user:'owner@example.com'}).w.document.getElementById('demo-publish-open'),null);
 assert.equal(settingsWindow({mode:'demo'}).w.document.getElementById('demo-publish-open'),null);
 assert.equal(settingsWindow({user:null}).w.document.getElementById('demo-publish-open'),null);
 assert.equal(/@/.test(source('config.js')),false);
});

test('review dialog lists records and publishes the reviewed snapshot, offering download on failure',async()=>{
 const ok=settingsWindow({publishDemo:async()=>({status:'pushed',commit:'c'.repeat(40)})});const doc=ok.w.document;
 doc.getElementById('demo-publish-open').click();await until(()=>!doc.getElementById('demo-publish-confirm').disabled);
 assert.equal(doc.getElementById('demo-publish').open,true);assert.match(doc.getElementById('demo-publish-list').textContent,/Essay draft/);assert.match(doc.getElementById('demo-publish-counts').textContent,/1 Projects/);
 assert.equal(doc.getElementById('demo-publish').textContent.includes(P),false);
 doc.getElementById('demo-publish-confirm').click();await until(()=>ok.calls.length===2);
 assert.doesNotThrow(()=>demo.validateSnapshot(ok.calls[0]));assert.equal(ok.calls[1],'c'.repeat(40));assert.match(doc.getElementById('demo-publish-message').textContent,/Pushed ccccccc/);
 const down=settingsWindow({publishDemo:async()=>{throw Error('Local companion request failed (401).')}});const d=down.w.document;
 d.getElementById('demo-publish-open').click();await until(()=>!d.getElementById('demo-publish-confirm').disabled);
 d.getElementById('demo-publish-confirm').click();await until(()=>!d.getElementById('demo-publish-download').hidden);
 assert.match(d.getElementById('demo-publish-message').textContent,/download demo-data.js/i);
});

async function companionFixture(callback,{dirty=false,files=['session-tv/public/js/demo-data.js'],user='owner'}={}){
 const temporary=await mkdtemp(path.join(tmpdir(),'sessiontv-demo-'));const folder=path.join(temporary,'tech-portfolio'),js=path.join(folder,'session-tv','public','js');await mkdir(js,{recursive:true});
 await writeFile(path.join(js,'demo-data.js'),'original');
 const workspaces=await canonicalWorkspaces([folder]),pushes=[];let snapshots=0;
 const companion=createCompanion({port:0,origin:'https://tannermayfield.dev',supabaseUrl:'https://test.supabase.co',publishableKey:'public',ownerId:'owner',home:path.join(temporary,'profile'),workspaces,deviceToken:'paired',
  verifyUser:async()=>({id:user}),bridgeFactory:()=>{throw Error('Codex is not needed')},
  publisherFactory:async cwd=>{assert.equal(cwd,workspaces[0]);return {snapshot:async()=>snapshots++===0?{base:'base',tree:dirty?'dirty':null,files:dirty?['session-tv/public/index.html']:[]}:{base:'base',tree:'tree',files},publish:async(review,options)=>{pushes.push({review,options,content:await readFile(path.join(js,'demo-data.js'),'utf8')});return {commit:'d'.repeat(40),url:'https://tannermayfield.dev/session-tv/'}}}}});
 await companion.listen();
 const post=(body,headers={})=>fetch('http://127.0.0.1:'+companion.server.address().port+'/demo/publish',{method:'POST',headers:{Origin:'https://tannermayfield.dev','Content-Type':'application/json',Authorization:'Bearer fixture','X-SessionTV-Pair':'paired',...headers},body:JSON.stringify(body)});
 try{await callback({post,pushes,file:path.join(js,'demo-data.js')})}finally{await new Promise(resolve=>companion.server.close(resolve));await rm(temporary,{recursive:true,force:true})}
}

test('companion demo endpoint requires the paired owner and validates the snapshot again',async()=>{
 const snapshot=demo.publicSnapshot(privateBackup());
 await companionFixture(async({post,pushes,file})=>{
  assert.equal((await post({snapshot},{Authorization:''})).status,401);
  assert.equal((await post({snapshot},{'X-SessionTV-Pair':'wrong'})).status,401);
  assert.equal((await post({snapshot},{Origin:'https://evil.example'})).status,403);
  const leaked=JSON.parse(JSON.stringify(snapshot));leaked.database.tasks.a.codexPrompt=P;
  const rejected=await post({snapshot:leaked});assert.equal(rejected.status,400);assert.match((await rejected.json()).error,/allowlist/);
  assert.equal((await post({})).status,400);
  assert.equal(pushes.length,0);assert.equal(await readFile(file,'utf8'),'original');
  const response=await post({snapshot});assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{status:'pushed',commit:'d'.repeat(40),url:'https://tannermayfield.dev/session-tv/'});
  assert.equal(pushes.length,1);assert.equal(pushes[0].options.message,'Publish SessionTV demo snapshot');assert.equal(pushes[0].content,demo.renderDemoFile(snapshot));
  assert.equal(pushes[0].content.includes(P),false);
 });
 await companionFixture(async({post})=>{assert.equal((await post({snapshot})).status,403)},{user:'visitor'});
});

test('companion demo publish refuses dirty checkouts and other changed files, restoring demo-data.js',async()=>{
 const snapshot=demo.publicSnapshot(privateBackup());
 await companionFixture(async({post,pushes,file})=>{const response=await post({snapshot});assert.equal(response.status,409);assert.match((await response.json()).error,/unpublished local changes/);assert.equal(pushes.length,0);assert.equal(await readFile(file,'utf8'),'original')},{dirty:true});
 await companionFixture(async({post,pushes,file})=>{const response=await post({snapshot});assert.equal(response.status,409);assert.match((await response.json()).error,/Only demo-data.js/);assert.equal(pushes.length,0);assert.equal(await readFile(file,'utf8'),'original')},{files:['session-tv/public/js/demo-data.js','session-tv/public/index.html']});
});
