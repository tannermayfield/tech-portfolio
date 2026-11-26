// Settings → My Database: the shared class form, project stats and project skills.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import jsdom from 'jsdom';
import {appSources} from './manifest.mjs';
const {JSDOM,VirtualConsole}=jsdom;
const publicDir=fileURLToPath(new URL('../public/',import.meta.url));
async function until(check){for(let i=0;i<500;i++){if(check())return;await new Promise(r=>setTimeout(r,10))}throw new Error('App did not reach expected state: '+check)}
async function boot(){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const html=readFileSync(path.join(publicDir,'index.html'),'utf8').replace(/<script src="([^"]+)"><\/script>/g,(_,src)=>'<script>'+(src==='js/boot.js'?"(async()=>{await SessionCloud.ready;for(const source of window.__testSources){const s=document.createElement('script');s.textContent=source;document.body.appendChild(s)}})()":readFileSync(path.join(publicDir,src),'utf8'))+'</script>');
 const dom=new JSDOM(html,{url:'http://127.0.0.1:4173',runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true,beforeParse(w){
  w.__testSources=appSources();
  w.fetch=async()=>({ok:true,json:async()=>({aiConfigured:false})});
  w.matchMedia=q=>({matches:q.includes('reduced-motion'),media:q,addEventListener(){},removeEventListener(){}});
  w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};w.scrollTo=()=>{};
  w.HTMLDialogElement.prototype.show=function(){this.open=true};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
  const no=()=>{},gradient={addColorStop:no};
  const ctx=new Proxy({createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)}),createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,measureText:()=>({width:50})},{get:(target,key)=>target[key]??no});
  w.HTMLCanvasElement.prototype.getContext=()=>ctx;
 }});
 await until(()=>dom.window.eval('typeof loaded!=="undefined" && loaded.state && loaded.tasks && !!current'));
 await until(()=>typeof dom.window.document.getElementById('tv-home-start').onclick==='function');
 dom.window.document.getElementById('tv-home-start').click();
 return {dom,w:dom.window,errors};
}
const submitClass=w=>w.document.getElementById('class-name-form').dispatchEvent(new w.Event('submit',{cancelable:true}));

test('one class form adds classes with a separate code and optional name from every entry point',async()=>{
 const {dom,w,errors}=await boot();try{
  w.eval("TV.mode='settings';TV.dbView='classes';renderSettings()");
  w.document.getElementById('db-add').click();
  const form=w.document.getElementById('class-edit');
  assert.equal(form.open,true);assert.equal(form.querySelector('h2').textContent,'Add class');assert.equal(w.document.getElementById('class-delete-button').hidden,true);
  assert.deepEqual([...form.querySelectorAll('form [name]')].map(el=>el.name),['code','name','description','url']);
  assert.equal(w.document.getElementById('create-class'),null,'the old single-field add dialog is gone');
  submitClass(w);assert.equal(form.open,true);assert.match(form.querySelector('[role=status]').textContent,/class code/);
  form.querySelector('[name=code]').value='IS 402';form.querySelector('[name=name]').value='Database Systems';form.querySelector('[name=url]').value='https://example.edu/is402';submitClass(w);
  assert.equal(form.open,false);
  assert.deepEqual({...w.eval("recall('sb.classes')['IS 402 — Database Systems']")},{code:'IS 402',name:'Database Systems',url:'https://example.edu/is402'});
  const row=[...w.document.querySelectorAll('.class-settings-row')].find(row=>row.textContent.includes('Database Systems'));
  const edit=row.querySelector('.class-edit-button');assert.equal(edit.textContent,'Edit');assert.equal(edit.className,'btn class-edit-button');
  // code only: the key is just the code
  w.SessionAddForms.open('class');assert.equal(form.querySelector('[name=code]').value,'');form.querySelector('[name=code]').value='MATH 120';submitClass(w);
  assert.ok(w.eval("Object.hasOwn(recall('sb.classes'),'MATH 120')"));
  w.SessionAddForms.open('class');form.querySelector('[name=code]').value='MATH 120';submitClass(w);assert.match(form.querySelector('[role=status]').textContent,/already/);form.querySelector('[data-close]').click();
  // assignment form: + Add class opens the same form and comes back with the new class selected
  w.SessionAddForms.open('assignment');const assignment=w.document.getElementById('create-assignment');
  assignment.querySelector('[data-new-assignment-class]').click();assert.equal(form.open,true);assert.equal(form.querySelector('h2').textContent,'Add class');
  form.querySelector('[name=code]').value='CS 101';form.querySelector('[name=name]').value='Computing';submitClass(w);
  assert.equal(assignment.open,true);assert.equal(assignment.querySelector('[name=course]').value,'CS 101 — Computing');
  // editing uses the same dialog; clearing the name keeps the key as the code (canvas.js only lets a signed-in workspace save edits)
  w.SessionCanvas=undefined;
  w.SessionClasses.open('CS 101 — Computing');assert.equal(form.querySelector('h2').textContent,'Edit class');assert.equal(w.document.getElementById('class-delete-button').hidden,false);
  assert.equal(form.querySelector('[name=code]').value,'CS 101');assert.equal(form.querySelector('[name=name]').value,'Computing');
  form.querySelector('[name=name]').value='';submitClass(w);await until(()=>w.eval("Object.hasOwn(recall('sb.classes'),'CS 101')"));
  assert.equal(w.SessionClasses.key('CS 101',''),'CS 101');assert.equal(w.SessionClasses.key('CS 101','Computing'),'CS 101 — Computing');
  assert.deepEqual(errors,[]);
 }finally{dom.window.close()}
});

test('project skills come from completed Apply tasks and feed the menu and Settings → Projects',async()=>{
 const {dom,w,errors}=await boot();try{
  await w.eval(`Promise.all([
   db.doc('tasks/sk-sql').set({track:'skill',title:'SQL joins',course:'SQL',cat:'Data',status:'todo'}),
   db.doc('tasks/sk-py').set({track:'skill',title:'Pandas',course:'Python',cat:'Data',status:'todo'}),
   db.doc('tasks/ps-me-done').set({track:'project',title:'Write queries',course:'Skill project',status:'done',order:1,skills:['sk-sql','sk-py']}),
   db.doc('tasks/ps-me-done2').set({track:'project',title:'More queries',course:'Skill project',status:'done',order:2,skills:['sk-sql']}),
   db.doc('tasks/ps-me-open').set({track:'project',title:'Draft report',course:'Skill project',status:'todo',order:3,skills:['Open skill']}),
   db.doc('tasks/ps-ai-done').set({track:'project',title:'Codex chore',course:'Skill project',status:'done',order:4,skills:['Codex skill']}),
   db.doc('tasks/ps-legacy').set({track:'project',title:'Old owner',course:'Skill project',status:'done',order:5,skills:['Legacy title']})
  ])`);
  // ps-legacy is owned through retired planning data, which is still read for task ownership
  w.eval("PROJ.data[pslug('Skill project')]={name:'Skill project',taskAssignments:{'ps-me-done':'me','ps-me-done2':'me','ps-me-open':'me','ps-ai-done':'ai'},sprint:{items:[{id:'ps-legacy',who:'me'}]}}");
  assert.deepEqual(Array.from(w.eval("projectSkills('Skill project')")),['SQL joins','Legacy title','Pandas']);
  // the Projects menu info panel reads the same list
  w.eval("TV.gSel.project='Skill project'");assert.match(w.eval("gdInfoHTML('project')"),/gd-pskills">Skills applied: SQL joins, Legacy title, Pandas</);
  // Settings → Projects shows exactly three counters, and Open folder looks and acts enabled
  w.SessionWorkspace.setPrivate('test-owner');
  w.eval("TV.mode='settings';TV.dbView='projects';renderSettings()");
  const row=()=>[...w.document.querySelectorAll('.project-table-row')].find(row=>row.textContent.includes('Skill project'));
  assert.deepEqual([...row().querySelectorAll('.project-counters>span')].map(span=>span.querySelector('small').textContent+'='+span.querySelector('b').textContent),['Skills Applied=3','My Tasks Completed=3','Codex Tasks Completed=1']);
  const open=row().querySelector('.project-open-folder');assert.equal(open.disabled,false);assert.equal(open.classList.contains('ghost'),false);
  const toast=()=>w.document.getElementById('toast').textContent;
  open.click();await until(()=>/No computer folder is linked/.test(toast()));
  w.eval("store('sb.projectCodingChats',{...recall('sb.projectCodingChats'),'Skill project':{folder:'C:/Projects/skills',chats:[]}})");
  w.SessionCompanion.openFolder=async()=>{throw new Error('Failed to fetch')};w.eval('renderSettings()');
  row().querySelector('.project-open-folder').click();await until(()=>/companion is running and paired/.test(toast()));
  let opened='';w.SessionCompanion.openFolder=async folder=>{opened=folder;return {opened:true}};
  row().querySelector('.project-open-folder').click();await until(()=>!!opened);assert.equal(opened,'C:/Projects/skills');
  assert.doesNotMatch(w.document.getElementById('set-body').textContent,/sprint/i);
  assert.deepEqual(errors,[]);
 }finally{dom.window.close()}
});

test('Apply tasks can be marked done and given skills, and project copy never says sprint',async()=>{
 const {dom,w}=await boot();try{
  await w.eval("Promise.all([db.doc('tasks/ap-one').set({track:'project',title:'Build page',course:'Apply project',status:'todo',order:1}),db.doc('tasks/ap-skill').set({track:'skill',title:'CSS grid',course:'CSS',cat:'Software',status:'todo'})])");
  w.eval("current.active='ap-one';current.mood='project';current.projModes={...(current.projModes||{}),'Apply project':'apply'};TV.mode='task'");
  // save the owner through the database like the app does, so a late projects snapshot cannot wipe it
  await w.eval("db.doc('projects/'+pslug('Apply project')).set({name:'Apply project',taskAssignments:{'ap-one':'me'}})");
  await until(()=>w.eval("projData('Apply project').taskAssignments?.['ap-one']==='me'"));
  w.eval("projectPanel(T('ap-one'),'Apply project','apply')");
  w.document.querySelector('[aria-label="Skills for Build page"]').click();w.document.querySelector('#task-skill-picker [aria-label="Select CSS grid"]').click();w.document.querySelector('#task-skill-picker [data-save]').click();
  await until(()=>w.eval("T('ap-one').skills?.includes('ap-skill')"));
  assert.deepEqual(Array.from(w.eval("projectSkills('Apply project')")),[],'open tasks do not count yet');
  w.eval("projectPanel(T('ap-one'),'Apply project','apply')");await until(()=>w.document.querySelector('[aria-label="Mark done: Build page"]'));w.document.querySelector('[aria-label="Mark done: Build page"]').click();
  await until(()=>w.eval("T('ap-one').status")==='done');
  assert.deepEqual(Array.from(w.eval("projectSkills('Apply project')")),['CSS grid']);
  w.eval("projectPanel(T('ap-one'),'Apply project','apply')");assert.equal(w.document.querySelector('[aria-label="Mark not done: Build page"]').textContent,'Done ✓');
  for(const mode of ['plan','apply','work']){
   w.eval(`current.projModes['Apply project']='${mode}';projectPanel(T('ap-one'),'Apply project','${mode}')`);
   assert.doesNotMatch(w.document.getElementById('pp').textContent,/sprint/i);
   assert.doesNotMatch(w.eval("projectIntro(T('ap-one'))+projectCtx(T('ap-one'))"),/sprint|scrum/i);
  }
  assert.doesNotMatch(Object.values(w.eval('COACH_RULES')).join(' '),/sprint|scrum/i);
  assert.doesNotMatch(w.document.getElementById('pp-title').textContent,/sprint/i);
 }finally{dom.window.close()}
});
