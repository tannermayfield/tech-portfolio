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
   w.__testSources=Array.from({length:17},(_,i)=>readFileSync(path.join(publicDir,'js/artifact/'+String(i+1).padStart(2,'0')+'.js'),'utf8')).concat(['local','account','project-chats','add-forms','home','session-preferences','speech','music','preview'].map(n=>readFileSync(path.join(publicDir,'js/'+n+'.js'),'utf8')));
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
 await until(()=>typeof dom.window.document.getElementById('tv-home-start').onclick==='function');
 assert.equal(dom.window.document.getElementById('tv-home').hidden,false);
 dom.window.document.getElementById('tv-home-start').click();
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
  w.document.getElementById('local-close').click();w.openDrawer('add-drawer');
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

test('appearance preferences persist without changing workspace data',async()=>{const {dom,w,errors}=await boot();try{assert.equal(w.document.getElementById('workspace-banner'),null);w.document.getElementById('btn-set').click();const titles=[...w.document.querySelectorAll('#set-body .set-card>h3')].map(x=>x.textContent);assert.deepEqual(titles.slice(0,3),['Session Login','Appearance','Exit SessionTV']);assert.equal(w.document.getElementById('session-exit').href,'https://tannermayfield.dev/#projects');w.document.getElementById('preferences-open').click();assert.equal(w.document.getElementById('appearance-preferences').open,true);w.document.querySelector('[data-pref="scheme"][data-value="dark"]').click();w.document.querySelector('[data-pref="screenEffect"][data-value="off"]').click();w.document.querySelector('[data-pref="cut"][data-value="0"]').click();assert.equal(w.document.body.dataset.scheme,'dark');assert.equal(w.document.body.dataset.screenEffect,'off');assert.equal(w.eval('TV.cutLen'),0);const saved=w.SessionTVLocal.backup().values;const reload=await boot(saved);try{assert.equal(reload.w.document.body.dataset.scheme,'dark');assert.equal(reload.w.document.body.dataset.screenEffect,'off');assert.equal(reload.w.eval('TV.cutLen'),0);assert.equal(reload.w.eval('tasks.length'),0)}finally{reload.dom.window.close()}assert.deepEqual(errors,[])}finally{dom.window.close()}});

test('linked projects prepare three chats, appear in the menu, and chat only in the work screen',async()=>{
 const {dom,w,errors}=await boot();
 try {
  w.SessionWorkspace={...w.SessionWorkspace,mode:'private'};
  w.SessionCompanion.models=async()=>({models:[{id:'latest-codex',model:'latest-codex',displayName:'Latest available Codex'}],selectedModel:'latest-codex',efforts:['low','medium','high','xhigh']});
  w.SessionCompanion.pickFolder=async()=>({folder:'C:\\Projects\\example'});
  w.SessionCompanion.prepareProject=async folder=>({folder,chats:['plan','apply','work'].map(mode=>({mode,threadId:'thread-'+mode}))});
  w.document.getElementById('btn-set').click();
  w.document.querySelector('[data-db=projects]').click();
  assert.equal([...w.document.querySelectorAll('#tv-settings button')].filter(button=>button.textContent.includes('Create project')).length,1);
  assert.equal(w.document.getElementById('project-chats-open'),null);
  assert.equal(w.document.getElementById('db-add').parentElement.className,'sheet-head');
  assert.equal(w.document.getElementById('set-x').getAttribute('aria-label'),'Back to settings');
  w.document.getElementById('db-add').click();
  const create=w.document.getElementById('create-project');
  create.querySelector('[name=name]').value='Example project';
  create.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  await until(()=>create.textContent.includes('choose a computer folder'));
  create.querySelector('[data-pick-folder]').click();
  await until(()=>create.querySelector('[name=folder]').value);
  create.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  await until(()=>!create.open);
  assert.equal(w.eval('tasks.length'),0);
  assert.equal(w.eval("gdProjects().includes('Example project')"),true);
  assert.equal(w.SessionProjectChats.entry('Example project').chats.length,3);
  assert.match(w.document.querySelector('.project-table-row').textContent,/Example project/);
  w.SessionProjectChats.open('Example project');
  assert.equal(w.document.querySelector('#project-manage textarea'),null);
  w.document.getElementById('pm-close').click();
  w.eval('staticBurst=async()=>{}');
  w.eval("gdTune('project','Example project')");
  await until(()=>w.document.getElementById('coach-form').hidden===false);
  assert.equal(w.eval("T(current.active).projectChannel"),true);
  await until(()=>!w.document.getElementById('coach-send').disabled);
  let expectedMode='apply',expectedEffort='low';
  w.SessionCompanion.start=async({mode,threadId,effort,onEvent})=>{
   assert.equal(mode,expectedMode);assert.equal(threadId,'thread-'+expectedMode);assert.equal(effort,expectedEffort);
   onEvent({method:'item/agentMessage/delta',params:{delta:'A small hint'}});
   onEvent({method:'turn/completed',params:{turn:{status:'completed'}}});
  };
  await w.sendCoach('Give me a hint');
  assert.match(w.document.getElementById('coach-log').textContent,/A small hint/);
  w.eval("current.projModes={'Example project':'plan'};renderWork()");
  assert.doesNotMatch(w.document.getElementById('coach-log').textContent,/A small hint/);
  w.eval("current.projModes={'Example project':'apply'};renderWork()");
  assert.match(w.document.getElementById('coach-log').textContent,/A small hint/);
  assert.match(w.document.querySelector('.project-model-controls').textContent,/Light/);
  w.eval("current.projModes={'Example project':'work'};renderWork()");
  assert.equal(w.document.getElementById('project-reasoning').value,'medium');
  w.document.getElementById('project-reasoning').value='high';w.document.getElementById('project-reasoning').dispatchEvent(new w.Event('change'));
  w.renderWork();assert.equal(w.document.getElementById('project-reasoning').value,'high');
  expectedMode='work';expectedEffort='high';await w.sendCoach('Build with this effort');
  assert.equal(w.document.getElementById('project-reasoning').value,'high');
  w.openSettings();w.closeSheets();w.renderWork();assert.equal(w.document.getElementById('project-reasoning').value,'medium');
  expectedEffort='medium';await w.sendCoach('Continue with the default');
  w.eval("current.projModes={'Example project':'plan'};renderWork()");
  assert.equal(w.document.getElementById('project-reasoning'),null);
  expectedMode='plan';expectedEffort='low';await w.sendCoach('Plan the sprint');
  w.SessionCompanion.prepareProject=async()=>{throw new Error('Sandbox setup needed')};
  await assert.rejects(w.SessionProjectChats.create('Not ready','C:\\Projects\\example'),/Sandbox setup needed/);
  assert.equal(w.SessionProjectChats.names().includes('Not ready'),false);
  assert.deepEqual(errors,[]);
 } finally {dom.window.close()}
});

test('class, assignment, and skill creation use separate forms and save their records',async()=>{
 const {dom,w}=await boot();
 try {
  w.SessionWorkspace={...w.SessionWorkspace,mode:'private'};
  const submit=kind=>w.document.querySelector('#create-'+kind+' form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  w.SessionAddForms.open('class');
  w.document.querySelector('#create-class [name=name]').value='CS 500';submit('class');
  await until(()=>!w.document.getElementById('create-class').open);
  w.SessionAddForms.open('assignment');
  w.document.querySelector('#create-assignment [name=course]').value='CS 500';
  w.document.querySelector('#create-assignment [name=title]').value='My assignment';submit('assignment');
  await until(()=>w.eval("tasks.some(t=>t.title==='My assignment'&&t.course==='CS 500')"));
  w.SessionAddForms.open('skill');
  w.document.querySelector('#create-skill [name=course]').value='Programming';
  w.document.querySelector('#create-skill [name=title]').value='My skill';submit('skill');
  await until(()=>w.eval("tasks.some(t=>t.title==='My skill'&&typeOf(t)==='skill')"));
 } finally {dom.window.close()}
});


test('Start selects Classwork from a saved project session and AI Markdown is formatted safely',async()=>{
 const {dom,w}=await boot();
 try {
  w.eval("current.mood='project';document.body.classList.add('tv-home-active');document.getElementById('tv-home').hidden=false");
  w.document.getElementById('tv-home-start').click();
  assert.equal(w.eval('current.mood'),'class');
  assert.match(w.document.getElementById('tv-guide').textContent,/Classwork/);
  w.__markdown='## Sprint\n\n**Goal**\n\n| Task | Hours |\n|---|---:|\n| Setup | 2 |\n\n```sql\nselect 1;\n```\n<script>alert(1)</script><img src=x onerror=alert(1)>[bad](javascript:alert(1))';
  const html=w.eval('fmtMsg(window.__markdown,true)');
  const node=w.document.createElement('div');node.innerHTML=html;
  assert.equal(node.querySelector('h2').textContent,'Sprint');
  assert.equal(node.querySelector('strong').textContent,'Goal');
  assert.equal(node.querySelectorAll('tbody tr').length,1);
  assert.match(node.querySelector('pre').textContent,/select 1/);
  assert.equal(node.querySelector('script,img,[onerror],[href^="javascript:"]'),null);
 } finally {dom.window.close()}
});


test('section preferences keep identity, Voicebox voices and Apple Music in separate private tabs',async()=>{
 const {dom,w,errors}=await boot();
 try {
  w.SessionWorkspace={...w.SessionWorkspace,mode:'private'};
  w.document.getElementById('btn-set').click();
  w.document.getElementById('session-preferences-open').click();
  assert.equal(w.document.getElementById('local-heading').textContent,'Session Preferences');
  assert.equal(w.document.querySelectorAll('.section-identity').length,3);
  const name=w.document.querySelector('[aria-label="Classes character name"]');name.value='My tutor';name.dispatchEvent(new w.Event('change'));
  assert.equal(w.recall('sb.sectionCharacters',{}).class,'My tutor');
  const theme=w.document.querySelector('[aria-label="Classes background theme"]');theme.value=theme.options[1].value;theme.dispatchEvent(new w.Event('change'));
  assert.equal(w.pickTheme('class').id,theme.value);
  w.document.getElementById('pref-tab-voices').click();
  assert.equal(w.document.getElementById('session-sections').hidden,true);
  assert.equal(w.document.getElementById('session-voices').hidden,false);
  assert.equal(w.document.querySelectorAll('.voice-section').length,3);
  w.document.getElementById('pref-tab-music').click();
  assert.equal(w.document.querySelectorAll('.music-section').length,3);
  assert.equal(w.document.querySelectorAll('iframe').length,0);
  assert.equal(w.document.getElementById('workspace-profile'),null);
  assert.equal(w.document.querySelectorAll('#coach-form [data-speech]').length,2);
  assert.equal(w.document.querySelectorAll('#wc-form [data-speech]').length,2);
  assert.deepEqual(errors,[]);
 }finally{dom.window.close()}
});

 test('account settings are private, expose linked status and require matching deletion confirmation',async()=>{
 const {dom,w}=await boot();try{
 w.SessionWorkspace.setPrivate('account-test');Object.defineProperty(w.SessionCloud,'user',{value:{email:'owner@example.test'},configurable:true});w.SessionCloud.accountInfo=async()=>({email:'owner@example.test',identities:[{provider:'email'}]});
 let deletes=0;w.SessionCloud.deleteAccount=async()=>{deletes++};
 w.eval('renderSettings()');assert.equal(w.document.getElementById('account-settings-open').nextElementSibling.id,'local-open');
 await w.SessionAccount.open();assert.equal(w.document.getElementById('account-google').hidden,false);
 w.document.getElementById('account-delete-email').value='wrong@example.test';w.document.getElementById('account-delete').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,5));assert.equal(deletes,0);
 w.dispatchEvent(new w.Event('sessiontv:auth'));assert.equal(w.document.getElementById('account-settings').open,false);
 }finally{dom.window.close()}
 });

test('class-scoped assignments inherit class and persist combined deadline and newly added skill',async()=>{
 const {dom,w}=await boot();try{
 w.SessionAddForms.open('assignment','CS 500');const form=w.document.querySelector('#create-assignment form');
 // Register the class so it is available to the existing course selector.
 w.eval("store('sb.classes',{'CS 500':{}})");w.document.getElementById('create-assignment').close();w.SessionAddForms.open('assignment','CS 500');
 assert.equal(form.querySelector('[name=course]').closest('label').hidden,true);
 form.querySelector('[name=title]').value='Linked assignment';form.querySelector('[name=dueAt]').value='2026-12-03T14:30';
 w.document.querySelector('[data-new-assignment-skill]').click();const skill=w.document.querySelector('#create-skill form');skill.querySelector('[name=title]').value='New assignment skill';skill.querySelector('[name=course]').value='Data';skill.dispatchEvent(new w.Event('submit',{cancelable:true}));
 await until(()=>!w.document.getElementById('create-skill').open);assert.equal(w.document.getElementById('create-assignment').open,true);assert.match(w.document.getElementById('assignment-skill-summary').textContent,/New assignment skill/);
 form.dispatchEvent(new w.Event('submit',{cancelable:true}));await until(()=>!w.document.getElementById('create-assignment').open);
 const record=w.eval("tasks.find(task=>task.title==='Linked assignment')");assert.equal(record.course,'CS 500');assert.equal(record.due,'2026-12-03');assert.equal(record.dueTime,'14:30');assert.deepEqual(Array.from(record.skills),['New assignment skill']);
 w.SessionAddForms.open('assignment');assert.equal(form.querySelector('[name=course]').closest('label').hidden,false);
 }finally{dom.window.close()}
});
