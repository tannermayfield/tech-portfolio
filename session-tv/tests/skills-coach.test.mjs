// Skills (Python split, levels, per-skill code editor, Settings → Skills, Skills count) and the coach profile.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import jsdom from 'jsdom';
import {appScripts,appSources,source} from './manifest.mjs';
const {JSDOM,VirtualConsole}=jsdom;
const publicDir=fileURLToPath(new URL('../public/',import.meta.url));
async function until(check){for(let i=0;i<300;i++){if(check())return;await new Promise(r=>setTimeout(r,10))}throw new Error('App did not reach expected state: '+check)}
async function boot(saved={}){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const html=readFileSync(path.join(publicDir,'index.html'),'utf8').replace(/<script src="([^"]+)"><\/script>/g,(_,src)=>'<script>'+(src==='js/boot.js'?"(async()=>{await SessionCloud.ready;for(const source of window.__testSources){const s=document.createElement('script');s.textContent=source;document.body.appendChild(s)}})()":readFileSync(path.join(publicDir,src),'utf8'))+'</script>');
 const dom=new JSDOM(html,{url:'http://127.0.0.1:4173',runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true,beforeParse(w){
  w.__testSources=appSources();
  for(const [k,v]of Object.entries(saved))w.localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));
  w.fetch=async()=>({ok:true,json:async()=>({aiConfigured:false})});
  w.matchMedia=q=>({matches:q.includes('reduced-motion'),media:q,addEventListener(){},removeEventListener(){}});
  w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};w.scrollTo=()=>{};
  w.HTMLDialogElement.prototype.show=function(){this.open=true};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
  const no=()=>{},gradient={addColorStop:no};
  const ctx=new Proxy({createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)}),createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,measureText:()=>({width:50})},{get:(target,key)=>target[key]??no});
  w.HTMLCanvasElement.prototype.getContext=()=>ctx;
 }});
 await until(()=>dom.window.eval('typeof loaded!=="undefined" && loaded.state && loaded.tasks && !!current'));
 return {dom,w:dom.window,errors};
}
const prefs=(w,key)=>JSON.parse(w.localStorage.getItem(key)||'null');

test('default skills split Python by category and drop the AI skill from AI',async()=>{
 const {dom,w}=await boot();
 try{
  const tags=w.eval('JSON.parse(JSON.stringify(SKILL_TAGS))');
  assert.ok(tags.Data.includes('Python (Data)'));assert.ok(tags.Software.includes('Python (Software)'));
  assert.equal(Object.values(tags).flat().includes('Python'),false);
  assert.deepEqual([...tags.AI],['Machine learning','Deep learning','Generative AI','Responsible AI']);
  assert.deepEqual(Array.from(w.eval("['Data','Software'].map(c=>SessionSkills.channels(c).find(s=>s.title.startsWith('Python')).id)")),['skill:Data:Python%20(Data)','skill:Software:Python%20(Software)']);
 }finally{dom.window.close()}
});

test('existing Python tools, channel state, study chats and drafts move to the split skills once',async()=>{
 const chat={account:'a',messages:[{role:'user',content:'Old Python chat'}]};
 const {dom,w,errors}=await boot({
  'sb.skillChannels':{'skill:Data:Python':{level:3,reps:2},'skill:Software:Python':{level:4,editor:'js'},'skill:Data:SQL':{level:2}},
  'sb.studyChats':{'skill:Data:Python':chat,'class-x':{account:'a',messages:[]}},
  'sb.ws.skill:Data:Python':'print("draft")'
 });
 try{
  await w.eval("Promise.all([db.doc('tasks/py-none').set({track:'develop',title:'pandas',course:'Python',level:1,status:'todo',order:1}),db.doc('tasks/py-data').set({track:'develop',title:'NumPy',course:'Python',cat:'Data',level:1,status:'todo',order:2}),db.doc('tasks/py-soft').set({track:'practice',title:'Flask',course:'Python',cat:'Software',level:3,status:'todo',order:3}),db.doc('tasks/py-old').set({track:'develop',title:'Old',course:'Python',status:'archived'})])");
  await until(()=>w.eval("['py-none','py-data','py-soft','py-old'].every(id=>T(id)&&T(id).course!=='Python')"));
  // saved, not only changed in memory
  await until(()=>{const data=JSON.parse(w.localStorage.getItem('sessiontv.database.v1')).tasks;return data['py-soft'].course==='Python (Software)'&&data['py-none'].course==='Python (Data)'});
  assert.deepEqual(Array.from(w.eval("['py-none','py-data','py-soft','py-old'].map(id=>T(id).course)")),['Python (Data)','Python (Data)','Python (Software)','Python (Data)']);
  const channels=prefs(w,'sb.skillChannels');
  assert.deepEqual(Object.keys(channels).sort(),['skill:Data:Python%20(Data)','skill:Data:SQL','skill:Software:Python%20(Software)']);
  assert.deepEqual(channels['skill:Data:Python%20(Data)'],{level:3,reps:2});assert.equal(channels['skill:Software:Python%20(Software)'].editor,'js');
  const chats=prefs(w,'sb.studyChats');assert.deepEqual(chats['skill:Data:Python%20(Data)'],chat);assert.equal('skill:Data:Python' in chats,false);assert.ok(chats['class-x']);
  assert.equal(w.localStorage.getItem('sb.ws.skill:Data:Python%20(Data)'),'print("draft")');assert.equal(w.localStorage.getItem('sb.ws.skill:Data:Python'),null);
  const pyData=w.eval("SessionSkills.channels('Data').find(s=>s.title==='Python (Data)')");assert.equal(pyData.level,3);assert.deepEqual(Array.from(pyData.tools),['pandas','NumPy']);
  // idempotent: running it again changes nothing and writes nothing
  const before=w.localStorage.getItem('sessiontv.database.v1'),channelsBefore=w.localStorage.getItem('sb.skillChannels');
  w.SessionSkills.migratePython();w.renderWork();await new Promise(r=>setTimeout(r,30));
  assert.equal(w.localStorage.getItem('sessiontv.database.v1'),before);assert.equal(w.localStorage.getItem('sb.skillChannels'),channelsBefore);
  assert.deepEqual(errors,[]);
 }finally{dom.window.close()}
});

test('the open Python skill channel follows the move',async()=>{
 const {dom,w}=await boot();
 try{
  w.eval("current.active='skill:Software:Python';current.cur={...current.cur,skill:'skill:Software:Python'};current.timeOn['skill:Software:Python']=60000");
  w.renderWork();
  assert.equal(w.eval('current.active'),'skill:Software:Python%20(Software)');assert.equal(w.eval('current.cur.skill'),'skill:Software:Python%20(Software)');
  assert.equal(w.eval("current.timeOn['skill:Software:Python%20(Software)']"),60000);
 }finally{dom.window.close()}
});

test('skill levels show only as stage names',async()=>{
 const {dom,w}=await boot();
 try{
  assert.deepEqual(Array.from(w.eval('[1,2,3,4].map(LVL_TAG)')),['NEW','LEARNED','EXPERIENCED','MASTERED']);
  for(const name of ['core/model.js','core/tasks.js','core/settings.js','skill-categories.js','study-chats.js','demo-snapshot.js'])assert.doesNotMatch(source(name),/1[–-]5|1[–-]2 NEW|level 1-|' — level '/,name);
  assert.doesNotMatch(readFileSync(path.join(publicDir,'styles.css'),'utf8'),/skill level 1-5|red \(1\) to green \(5\)/);
 }finally{dom.window.close()}
});

test('each skill chooses its code editor; defaults follow the skill name',async()=>{
 const {dom,w,errors}=await boot();
 try{
  w.loadCM=async()=>{};
  assert.equal(w.eval("wsEditorOf('Data','SQL')"),'sql');assert.equal(w.eval("wsEditorOf('Data','Databases')"),'sql');
  assert.equal(w.eval("wsEditorOf('Data','Python (Data)')"),'python');assert.equal(w.eval("wsEditorOf('Software','Python (Software)')"),'python');
  assert.equal(w.eval("wsEditorOf('Software','JavaScript')"),'js');assert.equal(w.eval("wsEditorOf('Software','HTML/CSS')"),'html');assert.equal(w.eval("wsEditorOf('AI','Generative AI')"),null);
  const {id}=await w.eval("db.collection('tasks').add({track:'develop',title:'Joins',course:'SQL',cat:'Data',level:1,status:'todo',order:1})");
  await until(()=>w.eval('tasks.length===1'));
  const sql=w.eval("SessionSkills.channels('Data').find(s=>s.title==='SQL').id");
  assert.equal(w.eval(`wsKindOf(T(${JSON.stringify(sql)}))`),'sql');assert.equal(w.eval(`wsKindOf(T(${JSON.stringify(id)}))`),'sql');
  w.SessionSkills.setEditor(sql,'python');
  assert.equal(prefs(w,'sb.skillChannels')[sql].editor,'python');
  assert.equal(w.eval(`wsKindOf(T(${JSON.stringify(sql)}))`),'python');assert.equal(w.eval(`wsKindOf(T(${JSON.stringify(id)}))`),'python');
  await w.tune(sql,{cut:false});await until(()=>w.eval("WS.kind==='python'&&!!WS.ed"));
  assert.equal(w.document.getElementById('ws').hidden,false);assert.equal(w.document.getElementById('ws-title').textContent,'Python editor');
  w.SessionSkills.setEditor(sql,'none');assert.equal(w.eval(`wsKindOf(T(${JSON.stringify(sql)}))`),null);assert.equal(w.document.getElementById('ws').hidden,true);
  assert.equal(w.eval(`wsRulesFor(T(${JSON.stringify(sql)}))`),'');
  // a skill with no default editor can still get one
  const ai=w.eval("SessionSkills.channels('AI').find(s=>s.title==='Generative AI').id");w.SessionSkills.setEditor(ai,'js');assert.equal(w.eval(`wsKindOf(T(${JSON.stringify(ai)}))`),'js');
  assert.throws(()=>w.SessionSkills.setEditor(ai,'cobol'),/Choose an editor/);
  // Settings → Skills sets it with the row's select
  w.eval("openSettings();TV.dbView='skills';renderSettings()");
  const select=w.document.querySelector(`[data-skill-editor="${sql}"]`);assert.equal(select.value,'none');
  assert.deepEqual([...select.options].map(o=>o.textContent),['None','SQL editor','Python editor','JavaScript editor','HTML/CSS editor']);
  select.value='html';select.dispatchEvent(new w.Event('change'));assert.equal(prefs(w,'sb.skillChannels')[sql].editor,'html');
  assert.deepEqual(errors,[]);
 }finally{dom.window.close()}
});

test('Settings → Skills lists one row per skill with stage, counters, editor and actions; Edit saves stage and editor',async()=>{
 const {dom,w,errors}=await boot();
 try{
  await w.eval("Promise.all([db.collection('tasks').add({track:'develop',title:'CTEs',course:'SQL',cat:'Data',level:3,status:'todo',order:1}),db.collection('tasks').add({track:'develop',title:'Joins',course:'SQL',cat:'Data',level:1,status:'done',order:2})])");
  await until(()=>w.eval('tasks.length===2'));
  w.eval("openSettings();TV.dbView='skills';renderSettings()");
  const body=w.document.getElementById('set-body'),rows=[...body.querySelectorAll('[data-skill-category="Data"] .skill-settings-row')];
  assert.equal(rows.length,w.eval("SessionSkills.skillsIn('Data',tasks).length"));
  const sql=rows[0];assert.equal(sql.dataset.skill,'SQL');
  assert.equal(sql.querySelector('.lvl-box').textContent,'EXPERIENCED');
  assert.deepEqual([...sql.querySelectorAll('.skill-counters b')].map(b=>b.textContent),['2','0','Never']);
  assert.deepEqual([...sql.querySelectorAll('.skill-tool span')].map(s=>s.textContent),['CTEs','Joins']);assert.ok(sql.querySelector('.skill-tool.done'));
  assert.equal(rows.find(row=>row.dataset.skill==='Databases').querySelector('.skill-tools').textContent,'No tools yet.');
  sql.querySelector('[data-add-tool]').click();assert.equal(w.document.getElementById('create-tool').open,true);w.document.getElementById('create-tool').close();
  sql.querySelector('[data-edit-skill]').click();
  const edit=w.document.getElementById('skill-edit');assert.equal(edit.open,true);
  const form=edit.querySelector('form');assert.equal(form.elements.name.disabled,true);assert.equal(edit.querySelector('[data-remove-skill]').hidden,true);
  assert.deepEqual([...form.elements.level.options].map(o=>o.textContent),['New','Learned','Experienced','Mastered']);
  form.elements.level.value='4';form.elements.editor.value='python';form.dispatchEvent(new w.Event('submit',{cancelable:true}));
  await until(()=>!edit.open);
  const id='skill:Data:SQL';assert.deepEqual({level:prefs(w,'sb.skillChannels')[id].level,editor:prefs(w,'sb.skillChannels')[id].editor},{level:4,editor:'python'});
  assert.equal(body.querySelector(`[data-skill-id="${id}"] .lvl-box`).textContent,'MASTERED');
  assert.deepEqual(errors,[]);
 }finally{dom.window.close()}
});

test('a skill the owner added can be renamed, which moves its tools, level and chat',async()=>{
 const {dom,w}=await boot({'sb.studyChats':{'skill:Data:dbt':{account:'a',messages:[{role:'user',content:'hi'}]}}});
 try{
  w.SessionSkills.addSkill('dbt','Data');w.SessionSkills.setLevel('skill:Data:dbt',2);
  await w.eval("db.doc('tasks/dbt-1').set({track:'develop',title:'Models',course:'dbt',cat:'Data',level:1,status:'todo',order:1})");
  await until(()=>w.eval("!!T('dbt-1')"));
  assert.equal(await w.SessionSkills.rename('Data','dbt','dbt Core'),true);
  assert.equal(w.eval("T('dbt-1').course"),'dbt Core');assert.deepEqual(prefs(w,'sb.skills').Data,['dbt Core']);
  assert.equal(prefs(w,'sb.skillChannels')['skill:Data:dbt%20Core'].level,2);assert.ok(prefs(w,'sb.studyChats')['skill:Data:dbt%20Core']);
  await assert.rejects(w.SessionSkills.rename('Data','SQL','Structured Query Language'),/Only skills you added/);
  assert.throws(()=>w.SessionSkills.remove('Data','dbt Core'),/tools first/);
 }finally{dom.window.close()}
});

test('the Settings home Skills count counts skills, including skills with no tools',async()=>{
 const {dom,w}=await boot();
 try{
  const stat=()=>w.document.querySelector('[data-db="skills"] b').textContent;
  const listed=w.eval('Object.values(SKILL_TAGS).flat().length');
  w.eval('openSettings()');assert.equal(stat(),String(listed));
  await w.eval("Promise.all([db.collection('tasks').add({track:'develop',title:'CTEs',course:'SQL',cat:'Data',level:1,status:'todo',order:1}),db.collection('tasks').add({track:'develop',title:'Joins',course:'SQL',cat:'Data',level:1,status:'todo',order:2}),db.collection('tasks').add({track:'develop',title:'Prompts',course:'Prompting',cat:'AI',level:1,status:'todo',order:3})])");
  await until(()=>w.eval('tasks.length===3'));
  w.SessionSkills.addSkill('dbt','Data');
  w.eval('renderSettings()');assert.equal(stat(),String(listed+2)); // dbt (no tools) and Prompting (a tool's own skill); SQL's two tools still count once
  assert.equal(w.SessionSkills.count(),listed+2);
 }finally{dom.window.close()}
});

test('coach profile defaults keep the owner\'s coaching; prompts follow name, pronouns and build-it-myself projects',async()=>{
 const {dom,w}=await boot();
 try{
  const profile=w.SessionCoachProfile.get();
  assert.deepEqual({...profile,buildProjects:[...profile.buildProjects]},{name:'Tanner',pronouns:'he/him',school:'BYU Information Systems',goal:'a data analyst co-op interview at Delta Air Lines',focus:'SQL, Python, AWS data pipelines',buildProjects:['Airline Pipeline']});
  assert.equal(w.eval('coachLearner()'),'Tanner, a BYU Information Systems student preparing for a data analyst co-op interview at Delta Air Lines');
  assert.match(w.eval('COACH_RULES.skill'),/This is a skill he is building for a data analyst co-op interview at Delta Air Lines\. Match his stage/);
  assert.match(w.eval('COACH_RULES.skill'),/his Airline Pipeline project/);
  assert.equal(w.eval("isPipe({course:'Airline Pipeline'})"),true);assert.equal(w.eval("isPipe({course:'Portfolio'})"),false);
  w.SessionCoachProfile.set({name:'Sam',pronouns:'they/them',school:'Information Systems',goal:'a software internship',focus:'',buildProjects:['Portfolio','Portfolio',' ']});
  assert.deepEqual(Array.from(w.SessionCoachProfile.get().buildProjects),['Portfolio']);
  assert.equal(w.eval('coachLearner()'),'Sam, an Information Systems student preparing for a software internship');
  assert.equal(w.eval("isPipe({course:'portfolio'})"),true);assert.equal(w.eval("isPipe({course:'Airline Pipeline'})"),false);
  const cls=w.eval('COACH_RULES.class');assert.match(cls,/quiz them, and check their understanding\. Do not write answers they would submit/);assert.match(cls,/do it on their own/);
  assert.match(w.eval('COACH_RULES.skill'),/a skill they are building for a software internship\. Match their stage/);assert.match(w.eval('COACH_RULES.pipeline'),/they must build themselves .* ask what they have tried/);
  assert.equal(w.eval("coachVoice('He learns best. When he sends code, tell him he can click Next. He has tried it himself, and he still needs his notes.')"),'They learn best. When they send code, tell them they can click Next. They have tried it themselves, and they still need their notes.');
  const {id}=await w.eval("db.collection('tasks').add({track:'develop',title:'Joins',course:'SQL',cat:'Data',level:1,status:'todo',order:1})");await until(()=>w.eval('tasks.length===1'));
  assert.match(w.eval(`wsRulesFor(T(${JSON.stringify(id)}))`),/They have a SQL editor open beside this chat/);
  w.SessionCoachProfile.set({pronouns:'she/her'});assert.match(w.eval('COACH_RULES.class'),/quiz her, and check her understanding\. Do not write answers she would submit/);
  assert.throws(()=>w.SessionCoachProfile.set({pronouns:'it/its'}),/Choose he\/him/);
  // no personal details are hardcoded in the coach prompts any more; the defaults live only in the preferences registry
  for(const name of appScripts().filter(name=>name!=='core/preferences.js')){assert.doesNotMatch(source(name),/\bTanner\b/,name);assert.doesNotMatch(source(name),/BYU Information|co-op interview|airline pipeline/i,name)}
 }finally{dom.window.close()}
});

test('SessionCoachProfile.render draws an editable form that saves the profile',async()=>{
 const {dom,w}=await boot();
 try{
  await w.eval("db.collection('tasks').add({track:'project',title:'Plan',course:'Portfolio site',status:'todo',order:1})");await until(()=>w.eval('tasks.length===1'));
  const tab=w.document.createElement('section');w.document.body.append(tab);
  const form=w.SessionCoachProfile.render(tab);assert.equal(tab.firstElementChild,form);
  assert.deepEqual([...form.querySelectorAll('label.coach-profile-field')].map(label=>label.firstChild.textContent),['Name','Pronouns','School or program','Goal','Focus skills']);
  assert.equal(form.elements.name.value,'Tanner');assert.equal(form.elements.pronouns.value,'he/him');
  const boxes=[...form.querySelectorAll('[name=buildProjects]')];assert.deepEqual(boxes.map(box=>[box.value,box.checked]),[['Airline Pipeline',true],['Portfolio site',false]]);
  form.elements.name.value='Alex';form.elements.pronouns.value='she/her';form.elements.goal.value='a BI analyst role';boxes[0].checked=false;boxes[1].checked=true;
  form.dispatchEvent(new w.Event('submit',{cancelable:true}));
  const saved=prefs(w,'sb.coachProfile');assert.equal(saved.name,'Alex');assert.equal(saved.pronouns,'she/her');assert.equal(saved.goal,'a BI analyst role');assert.deepEqual(saved.buildProjects,['Portfolio site']);
  assert.match(form.querySelector('[role=status]').textContent,/Saved/);
  assert.equal(w.eval("isPipe({course:'Portfolio site'})"),true);
 }finally{dom.window.close()}
});
