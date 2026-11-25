import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import jsdom from 'jsdom';
import {appSources} from './manifest.mjs';
const {JSDOM,VirtualConsole}=jsdom;
const publicDir=fileURLToPath(new URL('../public/',import.meta.url));
async function until(check){for(let i=0;i<150;i++){if(check())return;await new Promise(r=>setTimeout(r,10))}throw new Error('App did not reach expected state: '+check)}
async function boot(saved={},url='http://127.0.0.1:4173'){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const html=readFileSync(path.join(publicDir,'index.html'),'utf8').replace(/<script src="([^"]+)"><\/script>/g,(_,src)=>'<script>'+(src==='js/boot.js'?"(async()=>{await SessionCloud.ready;for(const source of window.__testSources){const s=document.createElement('script');s.textContent=source;document.body.appendChild(s)}})()":readFileSync(path.join(publicDir,src),'utf8'))+'</script>');

 const dom=new JSDOM(html,{
  url,runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true,
  beforeParse(w){
   w.__testSources=appSources(); // the same ordered list boot.js loads (js/manifest.js)
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
  w.document.getElementById('local-close').click();
  const submit=kind=>w.document.querySelector('#create-'+kind+' form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  w.SessionAddForms.open('class');w.document.querySelector('#create-class [name=name]').value='IS 402';submit('class');
  await until(()=>!w.document.getElementById('create-class').open);
  w.SessionAddForms.open('assignment','IS 402');
  w.document.querySelector('#create-assignment [name=title]').value='Integration test assignment';submit('assignment');
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

test('skills menu lists one chat per skill and practicing it stamps every tool',async()=>{
 const {dom,w,errors}=await boot();
 try{
  await w.eval("Promise.all([db.collection('tasks').add({track:'develop',title:'CTEs',course:'SQL',cat:'Data',level:2,status:'todo',order:1}),db.collection('tasks').add({track:'develop',title:'Window functions',course:'SQL',cat:'Data',level:1,status:'todo',order:2})])");
  await until(()=>w.eval('tasks.length===2'));
  const skills=Array.from(w.eval("TV.gFilter='Data';gdSkills().map(s=>s.title)"));
  assert.equal(skills.filter(name=>name==='SQL').length,1);
  assert.equal(skills.includes('CTEs'),false);
  const sql=w.eval("gdSkills().find(s=>s.title==='SQL')");
  assert.equal(sql.skillChannel,true);assert.deepEqual(Array.from(sql.tools),['CTEs','Window functions']);assert.equal(sql.level,2);
  w.gdTune('skill',sql.id);await until(()=>w.eval('current.active')===sql.id);
  assert.equal(w.document.querySelector('#focus h2').textContent,'SQL');
  await w.setLevel(sql.id,3);assert.equal(w.eval('T(current.active).level'),3);
  await w.markDone(sql.id);
  await until(()=>w.eval("tasks.every(t=>t.lastPracticed)"));
  assert.ok(w.eval(`T(${JSON.stringify(sql.id)}).lastPracticed`));
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
test('public preview keeps sign-in usable and blocks record editing in the DOM',async()=>{const {dom,w,errors}=await boot({},'https://tannermayfield.dev/session-tv/');try{assert.equal(w.SessionWorkspace.readOnly,true);assert.equal(w.document.body.dataset.readonly,'true');assert.equal(w.eval('tasks.length'),7);await assert.rejects(w.eval("db.doc('tasks/demo-cs').update({title:'Forbidden'})"),/read-only/);w.SessionAddForms.open('assignment');assert.equal(w.document.getElementById('create-assignment').open,false);w.document.querySelector('#create-assignment form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(w.eval('tasks.length'),7);assert.equal(w.document.getElementById('workspace-email').disabled,false);assert.equal(w.document.getElementById('workspace-data'),null);assert.deepEqual(errors,[])}finally{dom.window.close()}});

test('appearance preferences persist without changing workspace data',async()=>{const {dom,w,errors}=await boot();try{assert.equal(w.document.getElementById('workspace-banner'),null);w.document.getElementById('btn-set').click();const titles=[...w.document.querySelectorAll('#set-body .set-card>h3')].map(x=>x.textContent);assert.deepEqual(titles.slice(0,4),['Session Login','Preferences','Exit SessionTV','Connections']);assert.equal(titles.includes('Appearance'),false);assert.equal(w.document.getElementById('session-preferences-open'),null);assert.ok(w.document.getElementById('session-connection-summary'));assert.equal(w.document.getElementById('session-exit').href,'https://tannermayfield.dev/#projects');
 assert.equal(w.document.body.dataset.screenStatic,'on');assert.equal(w.document.body.dataset.screenColor,'bw');
 w.document.getElementById('preferences-open').click();assert.equal(w.document.getElementById('preferences').open,true);assert.equal(w.document.getElementById('pref-tab-appearance').getAttribute('aria-selected'),'true');
 for(const key of ['sections','voices','music','canvas','ai'])assert.equal(w.document.getElementById('pref-tab-'+key).hidden,true,key+' needs a private workspace');
 w.document.querySelector('[data-pref="scheme"][data-value="dark"]').click();w.document.querySelector('[data-pref="screenStatic"][data-value="off"]').click();w.document.querySelector('[data-pref="cut"][data-value="0"]').click();
 assert.equal(w.document.body.dataset.scheme,'dark');assert.equal(w.document.body.dataset.screenStatic,'off');assert.equal(w.document.body.dataset.screenColor,'bw','static and color are independent');assert.equal(w.eval('TV.cutLen'),0);
 w.document.querySelector('[data-pref="screenColor"][data-value="color"]').click();assert.equal(w.document.body.dataset.screenColor,'color');assert.equal(w.document.querySelector('[data-pref="screenColor"][data-value="color"]').getAttribute('aria-pressed'),'true');
 const saved=w.SessionTVLocal.backup().values;const reload=await boot(saved);try{assert.equal(reload.w.document.body.dataset.scheme,'dark');assert.equal(reload.w.document.body.dataset.screenStatic,'off');assert.equal(reload.w.document.body.dataset.screenColor,'color');assert.equal(reload.w.eval('TV.cutLen'),0);assert.equal(reload.w.eval('tasks.length'),0)}finally{reload.dom.window.close()}assert.deepEqual(errors,[])}finally{dom.window.close()}});

test('the old TV Screen Effect setting migrates to separate static and color settings',async()=>{
 for(const [old,staticValue,color]of [['false','off','color'],['true','on','bw']]){
  const {dom,w,errors}=await boot({'sb.screenEffect':old});
  try{assert.equal(w.document.body.dataset.screenStatic,staticValue);assert.equal(w.document.body.dataset.screenColor,color);assert.equal(w.recall('sb.screenStatic'),staticValue==='on');assert.equal(w.recall('sb.screenColor'),color);assert.deepEqual(errors,[])}finally{dom.window.close()}
 }
 const {dom,w}=await boot({'sb.screenEffect':'false','sb.screenStatic':'true','sb.screenColor':'"bw"'});
 try{assert.equal(w.document.body.dataset.screenStatic,'on','new settings win over the old one');assert.equal(w.document.body.dataset.screenColor,'bw')}finally{dom.window.close()}
});

test('Preferences is one tabbed popup with arrow-key tabs, private tabs and a coach tab',async()=>{
 const {dom,w,errors}=await boot();
 try{
  w.SessionWorkspace={...w.SessionWorkspace,mode:'private'};
  w.document.getElementById('btn-set').click();w.document.getElementById('preferences-open').click();
  const dialog=w.document.getElementById('preferences'),list=dialog.querySelector('[role=tablist]'),tabs=[...list.querySelectorAll('[role=tab]')];
  assert.equal(dialog.open,true);assert.equal(dialog.getAttribute('aria-labelledby'),'preferences-heading');assert.equal(list.getAttribute('aria-orientation'),'vertical');
  assert.deepEqual(tabs.map(tab=>tab.textContent),['Appearance','Sections','Voices','Apple Music','Canvas','AI Connections','Coach']);
  for(const tab of tabs){const panel=w.document.getElementById(tab.getAttribute('aria-controls'));assert.equal(panel.getAttribute('role'),'tabpanel');assert.equal(panel.getAttribute('aria-labelledby'),tab.id)}
  assert.deepEqual(tabs.map(tab=>tab.tabIndex),[0,-1,-1,-1,-1,-1,-1]);
  const key=(tab,name)=>tab.dispatchEvent(new w.KeyboardEvent('keydown',{key:name,bubbles:true,cancelable:true}));
  key(tabs[0],'ArrowDown');assert.equal(tabs[1].getAttribute('aria-selected'),'true');assert.equal(w.document.activeElement,tabs[1]);assert.equal(w.document.getElementById('pref-panel-sections').hidden,false);assert.equal(w.document.getElementById('pref-panel-appearance').hidden,true);
  key(tabs[1],'End');assert.equal(tabs[6].getAttribute('aria-selected'),'true');
  assert.equal(w.document.getElementById('pref-panel-coach').textContent.includes('Coach profile is not available.'),true);
  key(tabs[6],'ArrowDown');assert.equal(tabs[0].getAttribute('aria-selected'),'true','arrows wrap around');
  key(tabs[0],'ArrowUp');assert.equal(tabs[6].getAttribute('aria-selected'),'true');
  w.SessionCoachProfile={render(panel){panel.textContent='Coach profile ready'}};key(tabs[6],'Home');tabs[6].click();
  assert.equal(w.document.getElementById('pref-panel-coach').textContent.includes('Coach profile ready'),true);
  // other features still reach a tab by its id
  w.SessionTVLocal.openSetup('preferences');w.document.getElementById('pref-tab-canvas').click();assert.equal(w.document.getElementById('pref-panel-canvas').hidden,false);
  w.SessionPreferences.open('ai');assert.equal(w.document.getElementById('pref-tab-ai').getAttribute('aria-selected'),'true');assert.ok(w.document.querySelector('#pref-panel-ai [data-connection-summary]'));
  w.document.getElementById('preferences-close').click();assert.equal(dialog.open,false);
  assert.deepEqual(errors,[]);
 }finally{dom.window.close()}
});

test('Session Login offers only email and password or Google',async()=>{
 const {dom,w}=await boot();
 try{
  w.SessionTVLocal.openSetup('login');const dialog=w.document.getElementById('local-setup');assert.equal(dialog.open,true);
  assert.deepEqual([...dialog.querySelectorAll('input')].map(input=>input.type),['email','password']);
  assert.equal(w.document.getElementById('workspace-google').textContent,'Continue with Google');
  assert.doesNotMatch(dialog.textContent,/username/i);
 }finally{dom.window.close()}
});

test('linked projects prepare three chats, appear in the menu, and chat only in the work screen',async()=>{
 const {dom,w,errors}=await boot();
 try {
  w.SessionWorkspace={...w.SessionWorkspace,mode:'private'};
  w.SessionCompanion.models=async()=>({models:[{id:'latest-codex',model:'latest-codex',displayName:'Latest available Codex'},{id:'gpt-6-luna',displayName:'GPT-6 Luna',efforts:['low']}],selectedModel:'latest-codex',efforts:['low','medium','high','xhigh']});
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
  await until(()=>w.document.getElementById('coach-form').dataset.providerReady==='true');
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
  assert.equal(w.document.querySelector('.project-chat-heading'),null);assert.equal(w.document.querySelector('#project-reasoning'),null);
  w.eval("current.projModes={'Example project':'work'};renderWork()");
  assert.match(w.document.getElementById('project-effort-button').textContent,/Medium/);
  await until(()=>!w.document.getElementById('project-effort-button').disabled);w.document.getElementById('project-effort-button').click();const openPopup=w.document.getElementById('project-effort-popup');w.renderWork();w.renderWork();assert.equal(w.document.getElementById('project-effort-popup'),openPopup);w.document.getElementById('project-reasoning').value='2';w.document.getElementById('project-reasoning').dispatchEvent(new w.Event('change'));
  w.renderWork();assert.match(w.document.getElementById('project-effort-button').textContent,/High/);
  expectedMode='work';expectedEffort='high';await w.sendCoach('Build with this effort');
  assert.match(w.document.getElementById('project-effort-button').textContent,/High/);
  w.openSettings();w.closeSheets();w.renderWork();assert.match(w.document.getElementById('project-effort-button').textContent,/Medium/);
  expectedEffort='medium';await w.sendCoach('Continue with the default');
  w.eval("current.projModes={'Example project':'plan'};renderWork()");
  assert.equal(w.document.getElementById('project-reasoning'),null);
  expectedMode='plan';expectedEffort='low';await until(()=>w.document.getElementById('coach-form').dataset.providerReady==='true');await w.sendCoach('Plan the sprint');
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
  const skillForm=w.document.querySelector('#create-skill form');
  assert.deepEqual([...skillForm.querySelectorAll('[name]')].map(el=>el.name),['title','category']);
  assert.deepEqual([...skillForm.querySelectorAll('[name=category] option')].slice(1).map(o=>o.value),Array.from(w.eval('Object.keys(SKILL_TAGS)')));
  skillForm.querySelector('[name=category]').value='Data';
  skillForm.querySelector('[name=title]').value='My skill';submit('skill');
  await until(()=>!w.document.getElementById('create-skill').open);
  assert.ok(w.eval("SKILL_TAGS.Data.includes('My skill')"));
  assert.equal(w.eval("tasks.some(t=>t.title==='My skill')"),false);
  w.SessionAddForms.open('tool','My skill','Data');
  assert.equal(w.document.querySelector('#create-tool [name=course]').closest('label').hidden,true);
  w.document.querySelector('#create-tool [name=title]').value='CTEs';submit('tool');
  await until(()=>w.eval("tasks.some(t=>t.title==='CTEs'&&typeOf(t)==='skill')"));
  const tool=w.eval("tasks.find(t=>t.title==='CTEs')");assert.equal(tool.course,'My skill');assert.equal(tool.cat,'Data');
 } finally {dom.window.close()}
});

test('skill settings show category chips, then each skill in a row with its tools below',async()=>{
 const {dom,w}=await boot();
 try {
  w.SessionWorkspace={...w.SessionWorkspace,mode:'private'};
  await w.eval("db.collection('tasks').add({track:'develop',title:'CTEs',course:'SQL',cat:'Data',level:2,status:'todo',order:1})");
  await until(()=>w.eval("tasks.some(t=>t.title==='CTEs')"));
  w.eval("openSettings();TV.dbView='skills';renderSettings()");
  const body=w.document.getElementById('set-body');
  assert.deepEqual([...body.querySelectorAll('.settings-skill-filters [data-category]')].map(b=>b.textContent),Array.from(w.eval('Object.keys(SKILL_TAGS)')));
  const data=body.querySelector('[data-skill-category="Data"]');assert.equal(data.hidden,false);
  assert.deepEqual([...data.querySelectorAll('.skill-section h4')].map(h=>h.firstChild.textContent).slice(0,2),['SQL','Databases']);
  const sql=data.querySelector('.skill-section');assert.match(sql.querySelector('ul').textContent,/CTEs/);assert.match(sql.querySelector('small').textContent,/1 tool$/);
  body.querySelector('[data-category="AI"]').click();
  assert.equal(data.hidden,true);assert.equal(body.querySelector('[data-skill-category="AI"]').hidden,false);
  w.document.getElementById('db-add').click();
  assert.equal(w.document.querySelector('#create-skill [name=category]').value,'AI');
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
  w.document.getElementById('preferences-open').click();
  assert.equal(w.document.getElementById('preferences').open,true);
  w.document.getElementById('pref-tab-sections').click();
  assert.equal(w.document.querySelectorAll('.section-identity').length,3);
  const name=w.document.querySelector('[aria-label="Classes character name"]');name.value='My tutor';name.dispatchEvent(new w.Event('change'));
  assert.equal(w.recall('sb.sectionCharacters',{}).class,'My tutor');
  const theme=w.document.querySelector('[aria-label="Classes background theme"]');theme.value=theme.options[1].value;theme.dispatchEvent(new w.Event('change'));
  assert.equal(w.pickTheme('class').id,theme.value);
  w.document.getElementById('pref-tab-voices').click();
  assert.equal(w.document.getElementById('pref-panel-sections').hidden,true);
  assert.equal(w.document.getElementById('pref-panel-voices').hidden,false);
  assert.equal(w.document.querySelectorAll('.voice-section').length,3);
  w.document.getElementById('pref-tab-music').click();
  assert.equal(w.document.querySelectorAll('.music-section').length,3);
  assert.equal(w.document.querySelectorAll('iframe').length,0);
  assert.equal(w.document.getElementById('workspace-profile'),null);
  assert.equal(w.document.querySelectorAll('#coach-form [data-speech]').length,1);
  assert.equal(w.document.querySelectorAll('#wc-form [data-speech]').length,1);
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
 w.document.querySelector('[data-new-assignment-skill]').click();const skill=w.document.querySelector('#create-skill form');skill.querySelector('[name=title]').value='New assignment skill';skill.querySelector('[name=category]').value='Data';skill.dispatchEvent(new w.Event('submit',{cancelable:true}));
 await until(()=>!w.document.getElementById('create-skill').open);assert.equal(w.document.getElementById('create-assignment').open,true);assert.match(w.document.getElementById('assignment-skill-summary').textContent,/New assignment skill/);
 form.dispatchEvent(new w.Event('submit',{cancelable:true}));await until(()=>!w.document.getElementById('create-assignment').open);
 const record=w.eval("tasks.find(task=>task.title==='Linked assignment')");assert.equal(record.course,'CS 500');assert.equal(record.due,'2026-12-03');assert.equal(record.dueTime,'14:30');assert.deepEqual(Array.from(record.skills),['New assignment skill']);
 w.SessionAddForms.open('assignment');assert.equal(form.querySelector('[name=course]').closest('label').hidden,false);
 }finally{dom.window.close()}
});

test('homework overview separates upcoming, missing and submitted and keeps menu action singular',async()=>{
 const {dom,w}=await boot();try{
 assert.equal(w.SessionHomework.classify({status:'done',due:'2020-01-01'}),'submitted');assert.equal(w.SessionHomework.classify({due:'2020-01-01'}),'missing');assert.equal(w.SessionHomework.classify({due:'2099-01-01'}),'due');assert.equal(w.SessionHomework.classify({}),'due');
 w.SessionHomework.open();assert.equal(w.document.querySelectorAll('.homework-stat').length,3);w.document.querySelector('.homework-stat.submitted').click();assert.equal(w.document.querySelector('.homework-stat.submitted').getAttribute('aria-pressed'),'true');
 const html=w.eval("gdInfoHTML('class')");assert.match(html,/Homework Overview/);assert.ok(!html.includes('Past Assignments'));assert.ok(!html.includes('Add Assignment'));
 }finally{dom.window.close()}
});

test('homework overview formats due dates as weekday, month, day and time',async()=>{
 const {dom,w}=await boot();try{
 const {formatDue}=w.SessionHomework;
 assert.equal(formatDue({due:'2026-11-26',dueTime:'23:59'}),'Thu, Nov 26 · 11:59 PM');
 assert.equal(formatDue({due:'2026-11-26',dueTime:'09:05'}),'Thu, Nov 26 · 9:05 AM');
 assert.equal(formatDue({due:'2026-11-26'}),'Thu, Nov 26');assert.equal(formatDue({due:'2026-11-26',dueTime:''}),'Thu, Nov 26');
 assert.equal(formatDue({}),'No due date');assert.equal(formatDue({due:''}),'No due date');
 await w.eval("Promise.all([db.doc('tasks/hw-timed').set({title:'Timed essay',track:'class',course:'WRTG 150',status:'todo',due:'2099-11-26',dueTime:'23:59'}),db.doc('tasks/hw-untimed').set({title:'Untimed essay',track:'class',course:'WRTG 150',status:'todo',due:'2099-11-27'}),db.doc('tasks/hw-none').set({title:'Someday essay',track:'class',course:'WRTG 150',status:'todo'})])");
 w.SessionHomework.open();const deadline=title=>[...w.document.querySelectorAll('.homework-row')].find(row=>row.querySelector('.homework-title').textContent===title).querySelector('.homework-deadline');
 assert.match(deadline('Timed essay').textContent,/^[A-Z][a-z]{2}, Nov 26 · 11:59 PM$/);assert.equal(deadline('Timed essay').dateTime,'2099-11-26T23:59');
 assert.match(deadline('Untimed essay').textContent,/^[A-Z][a-z]{2}, Nov 27$/);assert.equal(deadline('Untimed essay').dateTime,'2099-11-27');
 assert.equal(deadline('Someday essay').textContent,'No due date');
 }finally{dom.window.close()}
});

test('homework overview shows a labeled line icon per assignment type',async()=>{
 const {dom,w}=await boot();try{
 const {kindOf}=w.SessionHomework;
 for(const [task,kind]of [[{kind:'quiz',title:'Midterm exam'},'quiz'],[{kind:'Midterm',title:'Essay'},'exam'],[{kind:'Final',title:'Essay'},'exam'],[{kind:'mystery',title:'Lab 3'},'lab'],[{kind:null,title:'Unit 2 Quiz'},'quiz'],
  [{title:'Midterm 1'},'exam'],[{title:'Final Exam'},'exam'],[{title:'Final'},'exam'],[{title:'Exams review'},'exam'],[{title:'Weekly Quiz 4'},'quiz'],[{title:'Discussion: Week 3'},'discussion'],[{title:'Reading response: Chapter 5'},'reading'],
  [{title:'Read chapter 2'},'reading'],[{title:'Final Project'},'project'],[{title:'Group project proposal'},'project'],[{title:'Lab 2: Joins'},'lab'],[{title:'Homework 3'},'assignment'],[{title:'Already graded'},'assignment'],[{},'assignment']])
  assert.equal(kindOf(task),kind,JSON.stringify(task));
 await w.eval("Promise.all([db.doc('tasks/hw-kind-exam').set({title:'Midterm 1',track:'class',course:'STAT 121',status:'todo',due:'2099-11-26'}),db.doc('tasks/hw-kind-canvas').set({title:'Weekly check-in',kind:'discussion',track:'class',course:'STAT 121',status:'todo',due:'2099-11-27'}),db.doc('tasks/hw-kind-plain').set({title:'Problem set 4',track:'class',course:'STAT 121',status:'todo',due:'2099-11-28'})])");
 w.SessionHomework.open();const icon=title=>[...w.document.querySelectorAll('.homework-row')].find(row=>row.querySelector('.homework-title').textContent===title).querySelector('.homework-icon');
 for(const [title,kind,label]of [['Midterm 1','exam','Exam'],['Weekly check-in','discussion','Discussion'],['Problem set 4','assignment','Assignment']]){const node=icon(title);assert.equal(node.dataset.kind,kind);assert.equal(node.getAttribute('role'),'img');assert.equal(node.getAttribute('aria-label'),label);const svg=node.querySelector('svg');assert.equal(svg.getAttribute('aria-hidden'),'true');assert.equal(svg.getAttribute('viewBox'),'0 0 24 24');assert.ok(!svg.querySelector('use'));assert.ok(svg.children.length>0)}
 assert.ok(![...w.document.querySelectorAll('.homework-icon')].some(node=>/\p{Extended_Pictographic}|✦/u.test(node.textContent)));
 }finally{dom.window.close()}
});

test('class rows rename assignment courses and delete only SessionTV records with Canvas exclusions',async()=>{
 const {dom,w}=await boot();try{
 // canvas.js only lets a signed-in workspace edit classes; this test covers the local record edits without Canvas
 w.SessionCanvas=undefined;
 w.eval("store('sb.classes',{'CS 500':{canvasId:'123',code:'CS 500',name:'Original'}});store('sb.canvasCourses',{'123':'CS 500'});");await w.eval("db.doc('tasks/class-row-test').set({title:'Class task',track:'class',course:'CS 500',status:'todo',canvas:{courseId:'123',submitted:false,missing:false}})");
 w.eval("TV.dbView='classes';renderSettings()");assert.ok(w.document.querySelectorAll('.class-settings-row').length>0);w.SessionClasses.open('CS 500');w.document.querySelector('#class-edit [name=code]').value='IS 402';w.document.querySelector('#class-edit [name=name]').value='Database Systems';w.document.getElementById('class-name-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await until(()=>w.eval("T('class-row-test').course")==='IS 402 — Database Systems');
 assert.equal(w.eval("T('class-row-test').course"),'IS 402 — Database Systems');assert.equal(w.eval("recall('sb.canvasCourses',{})['123']"),'IS 402 — Database Systems');
 w.SessionClasses.open('IS 402 — Database Systems');assert.equal(w.document.querySelector('#class-edit [name=confirmation]'),null);w.document.getElementById('class-delete-button').click();assert.equal(w.document.getElementById('class-delete-confirm').open,true);assert.ok(w.eval("T('class-row-test')"));w.document.querySelector('#class-delete-confirm [data-cancel]').click();assert.equal(w.document.getElementById('class-edit').open,true);w.document.getElementById('class-delete-button').click();w.document.querySelector('#class-delete-confirm [data-confirm-delete]').click();await until(()=>!w.eval("T('class-row-test')"));assert.equal(w.eval("T('class-row-test')"),null);assert.ok(w.eval("recall('sb.canvasExcludedCourses',[]).includes('123')"));
 }finally{dom.window.close()}
});

test('class edits appear immediately and another class remains editable while saving',async()=>{
 const {dom,w}=await boot();try{
 w.SessionWorkspace.setPrivate('test-owner');Object.defineProperty(w.SessionCloud,'user',{value:{id:'test-owner'},configurable:true});w.eval("store('sb.classes',{'A':{code:'A',name:'Alpha'},'B':{code:'B',name:'Beta'}})");let finish;w.SessionCloud.manageClass=()=>new Promise(resolve=>finish=resolve);w.eval("TV.mode='settings';TV.dbView='classes';renderSettings()");w.SessionClasses.open('A');w.document.querySelector('#class-edit [name=name]').value='Renamed';w.document.getElementById('class-name-form').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(w.document.getElementById('class-edit').open,false);assert.match(w.document.getElementById('set-body').textContent,/Renamed/);const row=[...w.document.querySelectorAll('.class-settings-row')].find(row=>row.textContent.includes('Beta'));assert.equal(row.querySelector('button:last-child').disabled,false);row.querySelector('button:last-child').click();assert.equal(w.document.getElementById('class-edit').open,true);await until(()=>!!finish);finish({});await new Promise(r=>setTimeout(r,5));
 }finally{dom.window.close()}
});

test('project assignment board replaces sprint setup and routes Me and Codex backlogs persistently',async()=>{
 const {dom,w}=await boot();try{await w.eval("db.doc('tasks/board-one').set({track:'project',title:'Board task',course:'Test board',status:'todo',order:1})");w.eval("globalThis.boardTask=tasks.find(t=>typeOf(t)==='project');current.active=boardTask.id;current.mood='project';projectPanel(boardTask,boardTask.course,'plan')");const name=w.boardTask.course,id=w.boardTask.id;
 assert.equal(w.document.getElementById('pp-title').textContent,'Assign tasks');assert.equal(w.document.getElementById('pp-create'),null);assert.equal(w.SessionProjectBacklogs.items(name).find(row=>row.task.id===id).who,'');await w.SessionProjectBacklogs.assign(name,id);assert.equal(w.SessionProjectBacklogs.items(name).find(row=>row.task.id===id).who,'me');w.eval('projectPanel(boardTask,boardTask.course,"apply")');assert.equal(w.document.getElementById('pp-title').textContent,'Apply backlog');assert(w.document.querySelector('.project-task-table [data-iid="'+id+'"]'));assert.equal(w.document.querySelector('.project-task-table input[type="checkbox"]'),null);w.eval('projectPanel(boardTask,boardTask.course,"work")');assert.equal(w.document.querySelector('.project-task-table [data-iid="'+id+'"]'),null);await w.SessionProjectBacklogs.assign(name,id);w.eval('projectPanel(boardTask,boardTask.course,"work")');assert(w.document.querySelector('.project-task-table [data-iid="'+id+'"]'));assert.equal(w.document.querySelector('.project-task-table input[type="checkbox"]'),null);await w.SessionProjectBacklogs.assign(name,id);assert.equal(w.SessionProjectBacklogs.items(name).find(row=>row.task.id===id).who,'');w.eval('projectPanel(boardTask,boardTask.course,"plan")');const input=w.document.getElementById('pp-new');input.value='New unassigned task';w.document.getElementById('project-task-create').dispatchEvent(new w.Event('submit',{cancelable:true}));await until(()=>w.SessionProjectBacklogs.items(name).some(row=>row.task.title==='New unassigned task'));assert.equal(w.SessionProjectBacklogs.items(name).find(row=>row.task.title==='New unassigned task').who,'');
 }finally{dom.window.close()}
});

test('task controls persist prompts and skills, queue only prepared Codex tasks, and pause safely',async()=>{
 const {dom,w}=await boot();try{await w.eval("Promise.all([db.doc('tasks/auto-one').set({track:'project',title:'First',course:'Queue project',status:'todo',order:1,codexEffort:'low',codexPrompt:'First prompt'}),db.doc('tasks/auto-two').set({track:'project',title:'Second',course:'Queue project',status:'todo',order:2,codexEffort:'high',codexPrompt:'Second prompt'}),db.doc('tasks/auto-skip').set({track:'project',title:'Unprepared',course:'Queue project',status:'todo',order:3}),db.doc('tasks/manual-one').set({track:'project',title:'Manual',course:'Queue project',status:'todo',order:4}),db.doc('tasks/skill-one').set({track:'skill',title:'SQL joins',course:'SQL',cat:'Data',status:'todo'})])");w.eval("current.active='auto-one';current.mood='project';current.projModes={...(current.projModes||{}),'Queue project':'work'};TV.mode='task';PROJ.data[pslug('Queue project')]={name:'Queue project',taskAssignments:{'auto-one':'ai','auto-two':'ai','auto-skip':'ai','manual-one':'me'}};projectPanel(T('auto-one'),'Queue project','work')");
 const messages=[];w.SessionProjectChats.sendTask=async(name,prompt,effort)=>{messages.push({name,prompt,effort});return {completed:true}};await w.SessionTaskControls.run('Queue project');assert.deepEqual(messages.map(message=>message.effort),['low','high']);assert.match(messages[0].prompt,/First prompt/);assert.equal(w.eval("T('auto-skip').status"),'todo');assert.equal(w.eval("T('auto-one').status"),'done');
 w.eval("current.projModes['Queue project']='apply';projectPanel(T('auto-one'),'Queue project','apply')");w.document.querySelector('[aria-label="Skills for Manual"]').click();const skill=w.document.querySelector('#task-skill-picker [aria-label="Select SQL joins"]');skill.click();w.document.querySelector('#task-skill-picker [data-save]').click();await until(()=>w.eval("T('manual-one').skills?.includes('skill-one')"));assert.match(w.document.querySelector('[aria-label="Skills for Manual"]').textContent,/1 skill/);
 await w.eval("db.doc('tasks/auto-one').update({status:'todo'})");w.eval("current.projModes['Queue project']='work';projectPanel(T('auto-one'),'Queue project','work')");w.document.querySelector('[aria-label="Edit prompt for First"]').click();w.document.querySelector('#task-prompt-editor textarea').value='Revised prompt';w.document.querySelector('#task-prompt-editor form').dispatchEvent(new w.Event('submit',{cancelable:true}));await until(()=>w.eval("T('auto-one').codexPrompt==='Revised prompt'"));
 let release;w.SessionProjectChats.sendTask=()=>new Promise(resolve=>release=resolve);w.SessionCompanion.cancel=()=>release({completed:false});const pending=w.SessionTaskControls.run('Queue project');await until(()=>!!release);w.SessionTaskControls.pause();await pending;assert.equal(w.SessionTaskControls.running,false);assert.equal(w.eval("T('auto-one').status"),'todo');
 }finally{dom.window.close()}
});

test('Classwork menu uses exactly the settings classes including empty classes and custom names',async()=>{const {dom,w}=await boot();try{w.eval("store('sb.classes',{'CS 101 — Computing':{code:'CS 101',name:'Computing'},'MATH 120 — Algebra':{code:'MATH 120',name:'Algebra'},'ENG 110 — Writing':{code:'ENG 110',name:'Writing'},'HIST 100 — History':{code:'HIST 100',name:'History'}})");w.eval("TV.mode='settings';TV.dbView='classes';renderSettings()");const count=w.document.querySelectorAll('.class-settings-row').length;assert.equal(count,4);assert.equal(w.eval('gdCourses().length'),4);assert.deepEqual(Array.from(w.eval("subsOf('class')")),['Due Date',...Array.from(w.eval('SessionClasses.names()'))]);w.eval("current.mood='class';openGuide()");const labels=[...w.document.querySelectorAll('#tv-guide .gd-row:not(.gd-hdr) .gd-ch b')].map(node=>node.textContent);assert.equal(labels.length,4);assert(labels.includes('CS 101'));assert(!labels.includes('IS 401'));assert.match(w.document.getElementById('tv-guide').textContent,/Computing/);}finally{dom.window.close()}});

test('failed saves put optimistic changes back and say so',async()=>{
 const {dom,w,errors}=await boot();
 try{
  await w.eval("Promise.all([db.doc('tasks/rb-class').set({track:'class',title:'Essay',course:'IS 402',status:'todo',order:1}),db.doc('tasks/rb-tool').set({track:'develop',title:'Joins',course:'SQL',cat:'Data',level:1,status:'todo',order:2})])");
  await until(()=>w.eval('tasks.length===2'));
  // every task update fails from here on
  w.eval("const realDoc=db.doc.bind(db);db.doc=path=>{const ref=realDoc(path);if(path.startsWith('tasks/'))ref.update=()=>Promise.reject(new Error('offline'));return ref}");
  const toast=()=>w.document.getElementById('toast').textContent;
  assert.equal(await w.toggleSubmitted('rb-class'),false);
  assert.equal(w.eval("T('rb-class').status"),'todo');assert.equal(w.eval("T('rb-class').doneAt"),undefined);assert.match(toast(),/Couldn't save/);
  w.document.getElementById('toast').textContent='';
  assert.equal(await w.setLevel('rb-tool',3),false);
  assert.equal(w.eval("T('rb-tool').level"),1);assert.match(toast(),/Couldn't save/);
  w.openTask('rb-class',true);w.document.getElementById('td-t').value='Renamed essay';
  w.document.getElementById('td-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  await until(()=>w.eval("T('rb-class').title")==='Essay');
  assert.match(w.document.getElementById('td-view').textContent,/Essay/);assert.doesNotMatch(w.document.getElementById('td-view').textContent,/Renamed/);
  w.document.getElementById('task-dlg').close();
  await w.tune('rb-tool',{cut:false});w.eval('current.practiced=[]');
  await w.markDone('rb-tool');
  assert.deepEqual(Array.from(w.eval('current.practiced')),[]);assert.equal(w.eval('current.active'),'rb-tool');
  assert.deepEqual(errors,[]);
 }finally{dom.window.close()}
});
