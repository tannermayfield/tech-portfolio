import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import jsdom from 'jsdom';
const {JSDOM,VirtualConsole}=jsdom;
const publicDir=fileURLToPath(new URL('../public/',import.meta.url));
async function until(check){for(let i=0;i<150;i++){if(check())return;await new Promise(r=>setTimeout(r,10))}throw new Error('App did not reach expected state')}
async function boot(saved={},url='http://127.0.0.1:4173'){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const html=readFileSync(path.join(publicDir,'index.html'),'utf8').replace(/<script src="([^"]+)"><\/script>/g,(_,src)=>'<script>'+(src==='js/boot.js'?"(async()=>{await SessionCloud.ready;for(const source of window.__testSources){const s=document.createElement('script');s.textContent=source;document.body.appendChild(s)}})()":readFileSync(path.join(publicDir,src),'utf8'))+'</script>');

 const dom=new JSDOM(html,{
  url,runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true,
  beforeParse(w){
   w.__testSources=Array.from({length:17},(_,i)=>readFileSync(path.join(publicDir,'js/artifact/'+String(i+1).padStart(2,'0')+'.js'),'utf8')).concat(['local','preview'].map(n=>readFileSync(path.join(publicDir,'js/'+n+'.js'),'utf8')));
   for(const [k,v]of Object.entries(saved))w.localStorage.setItem(k,v);
   w.fetch=async()=>({ok:true,json:async()=>({aiConfigured:false})});
   w.matchMedia=q=>({matches:q.includes('reduced-motion'),media:q,addEventListener(){},removeEventListener(){}});
   w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};w.scrollTo=()=>{};
   w.HTMLDialogElement.prototype.show=function(){this.open=true};
   w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
   w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
   const no=()=>{},gradient={addColorStop:no};
   const ctx=new Proxy({createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)}),
    createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,measureText:()=>({width:50})},{get:(target,key)=>target[key]??no});
   w.HTMLCanvasElement.prototype.getContext=()=>ctx;
  }
 });
 await until(()=>dom.window.eval('typeof loaded!=="undefined" && loaded.state && loaded.tasks && !!current'));
 return {dom,w:dom.window,errors};
}
test('boots directly into the TV, adds coursework, edits and reloads saved data',async()=>{
 const {dom,w,errors}=await boot();
 try{
  assert.equal(w.document.body.dataset.view,'work');
  assert.ok(w.document.body.classList.contains('tv'));
  w.document.getElementById('btn-set').click();
  assert.ok(w.document.getElementById('local-open'));
  w.SessionTVLocal.openSetup();await until(()=>w.document.getElementById('local-setup').open);
  w.document.getElementById('local-add').click();
  w.document.getElementById('f-title').value='Integration test assignment';
  w.document.getElementById('f-course').value='IS 402';
  w.document.getElementById('add-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  await until(()=>w.eval('tasks.length===1'));
  const id=w.eval('tasks[0].id');
  await w.tune(id,{cut:false});
  assert.match(w.document.getElementById('focus').textContent,/Integration test assignment/);
  w.openGuide();
  assert.match(w.document.getElementById('tv-guide').textContent,/Integration test assignment/);
  await w.doneToMenu(id);
  assert.equal(w.eval('tasks[0].status'),'done');
  const backup=w.SessionTVLocal.backup();
  w.SessionTVLocal.validateBackup(backup);
  assert.throws(()=>w.SessionTVLocal.validateBackup({format:'wrong'}));
  const reload=await boot(backup.values);
  try{assert.equal(reload.w.eval('tasks[0].status'),'done');assert.deepEqual(reload.errors,[])}finally{reload.dom.window.close()}
  assert.deepEqual(errors,[]);
 }finally{dom.window.close()}
});
test('skill levels, timer, written teach-back and learning log work without AI',async()=>{
 const {dom,w,errors}=await boot();
 try{
  const {id}=await w.eval("db.collection('tasks').add({track:'develop',title:'SQL',course:'SQL',level:1,status:'todo',order:1})");
  await until(()=>w.eval('tasks.length===1'));
  await w.tune(id,{cut:false});
  await w.setLevel(id,3);
  assert.equal(w.eval('tasks[0].level'),3);
  const now=new Date(Date.now()+30*60000),digits=String(now.getHours()%12||12).padStart(2,'0')+String(now.getMinutes()).padStart(2,'0');
  w.timerEditStart();w.eval('TV.tEdit='+JSON.stringify(digits));w.timerCommit();
  assert.ok(w.eval('new Date(current.endAt).getTime()>Date.now()'));
  w.eval('current.timeOn[current.active]=120000');
  await w.startTeachBack();assert.equal(w.eval('wrapping'),true);
  await w.askSkill('I grouped flights by origin and counted each group.');
  assert.match(w.document.getElementById('wc-log').textContent,/I grouped flights/);
  await w.document.getElementById('finish-btn').onclick();
  await until(()=>w.eval('sessions.length===1'));
  assert.match(w.eval('sessions[0].recap'),/I grouped flights/);
  w.go('log');await until(()=>!w.document.getElementById('view-log').hidden);
  assert.deepEqual(errors,[]);
 }finally{dom.window.close()}
});

test('SQL executes on the airline sample data and editor drafts persist',async()=>{
 const {default:initSqlJs}=await import('sql.js');
 const {dom,w,errors}=await boot();
 try{
  // Use the same SQL.js release as the page; omit the CDN/editor network in DOM tests.
  w.loadCM=async()=>{};
  w.testSql=initSqlJs;w.eval('sqlEngine=async()=>window.testSql()');
  const {id}=await w.eval("db.collection('tasks').add({track:'develop',title:'SQL',course:'SQL',level:1,status:'todo',order:1})");
  await until(()=>w.eval('tasks.length===1'));
  await w.tune(id,{cut:false});await until(()=>w.eval('WS.ed!=null'));
  w.eval("WS.ed.set('SELECT COUNT(*) AS flight_count FROM flights;');wsSave()");
  await w.wsRun();
  assert.match(w.document.getElementById('ws-out').textContent,/flight_count/);
  assert.match(w.document.getElementById('ws-out').textContent,/240/);
  assert.match(w.localStorage.getItem('sb.ws.'+id),/COUNT/);
  w.document.getElementById('ws-tables').click();
  assert.ok(w.document.querySelector('#ws-out svg.erd'));
  const htmlTask=await w.eval("db.collection('tasks').add({track:'develop',title:'HTML',course:'HTML/CSS',level:1,status:'todo',order:2})");
  await w.tune(htmlTask.id,{cut:false});await until(()=>w.eval("WS.kind==='html'&&!!WS.ed"));
  w.eval("WS.ed.set('<h1>My preview</h1>')");
  await w.wsRun();
  const frame=w.document.querySelector('#ws-out iframe');
  assert.equal(frame.getAttribute('sandbox'),'allow-scripts');
  assert.match(frame.srcdoc,/My preview/);
  assert.deepEqual(errors,[]);
 }finally{dom.window.close()}
});
test('project sprint planning and completion persist through the local database',async()=>{
 const {dom,w,errors}=await boot();
 try{
  await until(()=>w.eval('PROJ.sub'));
  const {id}=await w.eval("db.collection('tasks').add({track:'project',title:'Build first screen',course:'Test Project',status:'todo',order:1})");
  await until(()=>w.eval('tasks.length===1'));
  await w.tune(id,{cut:false});
  w.document.querySelector('[data-pmode="plan"]').click();
  w.document.getElementById('pp-create').click();
  await until(()=>w.eval("sprintOf('Test Project')?.step===1"));
  const date=w.document.querySelector('[data-cday]:not([disabled])');
  assert.ok(date);date.click();
  await until(()=>!w.document.getElementById('pp-go').disabled);
  w.document.getElementById('pp-go').click();
  await until(()=>w.document.getElementById('pp-goal'));
  w.document.getElementById('pp-goal').value='Ship the first screen';
  w.document.getElementById('pp-goal').dispatchEvent(new w.Event('input'));
  w.document.getElementById('pp-go').click();
  await until(()=>w.eval("sprintOf('Test Project')?.step===3"));
  await w.projSave('Test Project',{sprint:{...w.eval("sprintOf('Test Project')"),items:[{id,pts:3}]}});
  w.document.getElementById('pp-go').click();
  await until(()=>w.document.querySelector('[data-all="me"]'));
  w.document.querySelector('[data-all="me"]').click();
  await until(()=>!w.document.getElementById('pp-go').disabled);
  w.document.getElementById('pp-go').click();
  await until(()=>w.eval("sprintOf('Test Project')?.status==='active'"));
  const checkbox=w.document.querySelector('[data-spdone]');checkbox.checked=true;
  checkbox.dispatchEvent(new w.Event('change'));
  await until(()=>w.eval("tasks[0].status==='done'"));
  assert.match(w.document.getElementById('pp-body').textContent,/100%/);
  const data=JSON.parse(w.localStorage.getItem(w.SessionStore.KEY));
  assert.equal(data.projects['test-project'].sprint.status,'active');
  assert.deepEqual(errors,[]);
 }finally{dom.window.close()}
});

test('public preview keeps sign-in usable and blocks record editing in the DOM',async()=>{const {dom,w,errors}=await boot({},'https://tannermayfield.dev/session-tv/');try{assert.equal(w.SessionWorkspace.readOnly,true);assert.equal(w.document.body.dataset.readonly,'true');assert.equal(w.eval('tasks.length'),7);await assert.rejects(w.eval("db.doc('tasks/demo-cs').update({title:'Forbidden'})"),/read-only/);w.document.getElementById('add-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(w.eval('tasks.length'),7);assert.equal(w.document.getElementById('workspace-email').disabled,false);assert.equal(w.document.getElementById('workspace-data'),null);assert.deepEqual(errors,[])}finally{dom.window.close()}});
