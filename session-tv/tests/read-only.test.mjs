// The public demo is read-only: every control that changes data carries data-write, and preview.js
// hides or disables it. This walks the demo's screens and checks that no write control is left usable.
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
async function bootDemo(){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const html=readFileSync(path.join(publicDir,'index.html'),'utf8').replace(/<script src="([^"]+)"><\/script>/g,(_,src)=>'<script>'+(src==='js/boot.js'?"(async()=>{await SessionCloud.ready;for(const source of window.__testSources){const s=document.createElement('script');s.textContent=source;document.body.appendChild(s)}})()":readFileSync(path.join(publicDir,src),'utf8'))+'</script>');
 const dom=new JSDOM(html,{url:'https://tannermayfield.dev/session-tv/',runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true,beforeParse(w){
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
const settle=()=>new Promise(r=>setTimeout(r,20));
// shown: no hidden ancestor, no closed dialog, no display:none from a style sheet (preview.js hides [data-write] that way)
function shown(w,el){for(let n=el;n&&n.nodeType===1;n=n.parentElement){if(n.hidden)return false;if(n.tagName==='DIALOG'&&!n.open)return false;if(w.getComputedStyle(n).display==='none')return false}return true}
const usable=(w,el)=>shown(w,el)&&!el.disabled&&!el.closest('fieldset[disabled]');
// labels and ids of controls that change data, whether or not they remember to carry data-write
const WRITE_LABELS=[/^\+ /,/^Edit\b/,/^Manage$/,/^Mark (done|not done|submitted|not submitted)$/,/^Done$/,/^Next skill$/,/^Wrap up$/,/^Publish to demo$/,/^Save\b/,/^Delete\b/,/^Remove\b/,/^Add\b/,/^Auto run$/,/^Run query$/,/^Submit$/,/^Reset$/,/^Save to learning log$/];
const WRITE_IDS=['db-add','td-edit','td-sub','done-btn','undo-done','wrapup-btn','ws-run','ws-send','ws-reset','demo-publish-open','coach-send','pp-new'];
function leaks(w,where){
 const out=[];const doc=w.document;
 for(const el of doc.querySelectorAll('[data-write]')){
  const controls=el.matches('form')?[...el.querySelectorAll('button,input,select,textarea')]:[el];
  for(const control of controls)if(usable(w,control))out.push(where+': usable [data-write] '+(control.id||control.textContent.trim()||control.outerHTML.slice(0,80)));
 }
 for(const el of doc.querySelectorAll('button,a.btn,[role=button]')){
  if(!usable(w,el))continue;const text=el.textContent.trim().replace(/\s+/g,' ');
  if(WRITE_IDS.includes(el.id)||WRITE_LABELS.some(re=>re.test(text)))out.push(where+': write control "'+(text||el.id)+'"');
 }
 for(const el of doc.querySelectorAll('input,select,textarea'))if(usable(w,el)&&!el.closest('#workspace-auth')&&el.id!=='homework-course')out.push(where+': editable field '+(el.name||el.id||el.outerHTML.slice(0,60)));
 return out;
}

test('the public demo leaves no write control usable on any screen, while browsing still works',async()=>{
 const {dom,w,errors}=await bootDemo();
 try{
  assert.equal(w.SessionWorkspace.readOnly,true);
  const found=[],visit=async(where,run)=>{w.eval(run);await settle();found.push(...leaks(w,where))};
  await visit('Settings home','openSettings()');
  // Sign in stays available, and the My Database cards still navigate
  const signIn=w.document.getElementById('local-open');assert.equal(signIn.textContent,'Sign in');assert.ok(usable(w,signIn));
  w.document.querySelector('[data-db="skills"]').click();await settle();assert.equal(w.eval('TV.dbView'),'skills');
  for(const view of ['classes','skills','projects','experience'])await visit('My Database '+view,`TV.dbView='${view}';renderSettings()`);
  // every add/edit button in My Database is marked, and the marked ones are hidden
  w.eval("TV.dbView='classes';renderSettings()");await settle();
  assert.ok(w.document.querySelectorAll('#set-body [data-add-assignment],.class-add-assignment,.class-edit-button').length>0,'Classes rows have their write buttons');
  for(const el of w.document.querySelectorAll('#set-body [data-add-assignment],.class-add-assignment,.class-edit-button,#db-add'))assert.equal(el.hasAttribute('data-write'),true,el.outerHTML.slice(0,80));
  w.eval("TV.dbView='skills';renderSettings()");await settle();
  for(const el of w.document.querySelectorAll('[data-add-tool],[data-edit-skill],[data-skill-editor],.settings-skill-filters [data-write]'))assert.equal(shown(w,el),false,el.outerHTML.slice(0,80));
  // the skill category chips are navigation and keep working
  const chips=[...w.document.querySelectorAll('.settings-skill-filters [data-category]')];assert.ok(chips.length>1);chips[1].click();assert.equal(chips[1].getAttribute('aria-pressed'),'true');
  await visit('Homework Overview','closeSheets();SessionHomework.open()');
  const course=w.document.getElementById('homework-course');assert.ok(usable(w,course),'the class filter keeps working');
  w.document.querySelector('#homework-overview [data-close]').click();
  for(const section of ['class','skill','project'])await visit('Menu '+section,`current.mood='${section}';openGuide()`);
  // Menu selection still works
  w.eval("current.mood='skill';openGuide()");const pills=[...w.document.querySelectorAll('#tv-guide .gd-pill')];assert.ok(pills.length>1);
  pills[1].click();assert.equal(w.eval('TV.gSel.skill'),pills[1].dataset.gid);
  await visit('Work: class','closeSheets();tune("demo-cs")');
  await visit('Assignment details','openTask("demo-cs")');w.document.getElementById('task-dlg').close();
  await visit('Work: skill','tune(allChannels("skill")[0].id)');
  await visit('Work: project','tune("demo-project")');
  await visit('Preferences','SessionTVLocal.openSetup("preferences")');
  await visit('Preferences coach','document.getElementById("pref-tab-coach").click()');
  // appearance preferences are kept in memory and still apply
  w.document.getElementById('pref-tab-appearance').click();
  const dark=w.document.querySelector('[data-pref="scheme"][data-value="dark"]');assert.ok(usable(w,dark));dark.click();assert.equal(w.eval('TV.scheme'),'dark');
  assert.deepEqual(found,[]);
  // the data layer still refuses writes
  await assert.rejects(w.eval("db.doc('tasks/demo-cs').update({title:'Forbidden'})"),/read-only/);
  assert.deepEqual(errors,[]);
 }finally{dom.window.close()}
});
