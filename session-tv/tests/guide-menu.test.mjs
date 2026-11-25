// The Menu (core/guide.js): click-again hint, dynamic class names, due-time format, project entries.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import jsdom from 'jsdom';
import {appSources,source} from './manifest.mjs';
const {JSDOM,VirtualConsole}=jsdom;
const publicDir=fileURLToPath(new URL('../public/',import.meta.url));
async function until(check){for(let i=0;i<150;i++){if(check())return;await new Promise(r=>setTimeout(r,10))}throw new Error('App did not reach expected state: '+check)}
async function boot(){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const html=readFileSync(path.join(publicDir,'index.html'),'utf8').replace(/<script src="([^"]+)"><\/script>/g,(_,src)=>'<script>'+(src==='js/boot.js'?"(async()=>{await SessionCloud.ready;for(const source of window.__testSources){const s=document.createElement('script');s.textContent=source;document.body.appendChild(s)}})()":readFileSync(path.join(publicDir,src),'utf8'))+'</script>');
 const dom=new JSDOM(html,{
  url:'http://127.0.0.1:4173',runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true,
  beforeParse(w){
   w.__testSources=appSources();
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
 dom.window.document.getElementById('tv-home-start').click();
 return {dom,w:dom.window,errors};
}
const ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const tomorrow=()=>ymd(new Date(Date.now()+864e5));
async function addClasswork(w){
 w.eval("store('sb.classes',{'CS 101 — Computing':{code:'CS 101',name:'Computing'},'MATH 120':{}})");
 const due=tomorrow();
 await w.eval(`Promise.all([
  db.doc('tasks/hw-a').set({track:'class',title:'Loops worksheet',course:'CS 101 — Computing',due:'${due}',dueTime:'23:59',status:'todo',goal:'Explain a loop and when it stops'}),
  db.doc('tasks/hw-b').set({track:'class',title:'Quiz 3',course:'MATH 120',due:'${due}',dueTime:'09:05',status:'todo'})])`);
 await until(()=>w.eval("tasks.filter(t=>typeOf(t)==='class').length===2"));
}
const again=(w,sel)=>[...w.document.querySelectorAll(sel)].map(b=>[b.dataset.gid,b.getAttribute('title')]);

test('Classes grid: only the selected show carries the "Click again to open" hint, and it follows the selection',async()=>{
 const {dom,w}=await boot();
 try{
  await addClasswork(w);
  w.eval("TV.gSel.class='hw-a';current.mood='class';openGuide()");
  assert.deepEqual(Object.fromEntries(again(w,'#tv-guide .gd-prog')),{'hw-a':'Click again to open','hw-b':null});
  w.document.querySelector('#tv-guide [data-gid="hw-b"]').click(); // first click selects it
  assert.equal(w.eval('TV.gSel.class'),'hw-b');
  assert.deepEqual(Object.fromEntries(again(w,'#tv-guide .gd-prog')),{'hw-a':null,'hw-b':'Click again to open'});
  assert.equal(w.eval('TV.mode'),'guide'); // still in the Menu until the second click
 }finally{dom.window.close()}
});

test('Classes grid shows due times as "11:59 PM" and reads class names from the user\'s classes',async()=>{
 const {dom,w}=await boot();
 try{
  assert.equal(w.eval("gdShortTime('23:59')"),'11:59 PM');
  assert.equal(w.eval("gdShortTime('09:05')"),'9:05 AM');
  assert.equal(w.eval("gdShortTime('12:00')"),'12:00 PM');
  assert.equal(w.eval("gdShortTime('00:30')"),'12:30 AM');
  assert.equal(w.eval('gdShortTime(null)'),'11:59 PM');
  await addClasswork(w);
  w.eval("current.mood='class';openGuide()");
  const cell=id=>w.document.querySelector(`#tv-guide [data-gid="${id}"] small`).textContent;
  assert.equal(cell('hw-a'),'11:59 PM');assert.equal(cell('hw-b'),'9:05 AM');
  const rows=[...w.document.querySelectorAll('#tv-guide .gd-row:not(.gd-hdr) .gd-ch')].map(n=>[n.querySelector('b').textContent,n.querySelector('small').textContent]);
  assert.deepEqual(rows,[['CS 101','Computing'],['MATH 120','CH 102']]);
  assert.equal(w.eval("courseLabel('CS 101 — Computing')"),'CS 101 · Computing');
  assert.equal(w.eval("courseLabel('MATH 120')"),'MATH 120');
  assert.equal(w.eval("courseLabel('IS 401')"),'IS 401'); // no built-in course names
  assert.equal(w.eval('typeof GD_COURSE_NAMES'),'undefined'); // the built-in map is gone
 }finally{dom.window.close()}
});

test('class assignments show no "explain" goal in the Menu or the details popup, and editing does not write one',async()=>{
 const {dom,w}=await boot();
 try{
  await addClasswork(w);
  w.eval("TV.gSel.class='hw-a';current.mood='class';openGuide()");
  assert.doesNotMatch(w.document.getElementById('gd-info-sel').textContent,/explain|Explain a loop/);
  w.openTask('hw-a');
  assert.doesNotMatch(w.document.getElementById('td-view').textContent,/Goal|explain/i);
  assert.equal(w.document.getElementById('td-goal'),null);
  w.openTask('hw-a',true);
  assert.deepEqual([...w.document.querySelectorAll('#td-courses option')].map(o=>o.value),['CS 101 — Computing','MATH 120']);
  w.document.getElementById('td-t').value='Loops worksheet v2';
  w.document.getElementById('td-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  await until(()=>w.eval("T('hw-a').title==='Loops worksheet v2'"));
  assert.equal(w.eval("T('hw-a').goal"),'Explain a loop and when it stops'); // the stored value is left alone
 }finally{dom.window.close()}
});

test('Projects menu: one project is a full entry with its task count, carrying the hint once selected',async()=>{
 const {dom,w}=await boot();
 try{
  await w.eval("db.doc('tasks/p-one').set({track:'project',title:'Write the README',course:'Portfolio site',status:'todo',order:1})");
  await until(()=>w.eval("gdProjects().includes('Portfolio site')"));
  w.eval("current.mood='project';openGuide()");
  const pills=w.document.getElementById('gd-pills');
  assert.ok(pills.classList.contains('gd-projs'));
  const entry=w.document.querySelector('#tv-guide .gd-pill.gd-proj[data-gid="Portfolio site"]');
  assert.ok(entry);assert.ok(entry.classList.contains('sel'));
  assert.equal(entry.getAttribute('title'),'Click again to open');
  assert.equal(entry.querySelector('.ps').textContent,'1 open task');
  // the layout no longer forces two half-width columns on the project entries
  const css=readFileSync(path.join(publicDir,'styles.css'),'utf8');
  const rule=css.match(/\.gd-pills\.gd-projs\{([^}]*)\}/);
  assert.ok(rule,'project entries have their own grid rule');
  assert.match(rule[1],/auto-fit/);assert.match(rule[1],/justify-content:center/);
 }finally{dom.window.close()}
});

test('Skills menu: only the selected skill carries the hint',async()=>{
 const {dom,w}=await boot();
 try{
  await w.eval("Promise.all([db.doc('tasks/sk-a').set({track:'skill',title:'SQL joins',course:'SQL',cat:'Data',status:'todo'}),db.doc('tasks/sk-b').set({track:'skill',title:'Window functions',course:'SQL',cat:'Data',status:'todo'})])");
  await until(()=>w.eval("current.mood='skill';gdSkills().length>=2"));
  w.eval('openGuide()');
  const list=again(w,'#tv-guide .gd-pill');
  assert.ok(list.length>=2);
  assert.equal(list.filter(([,t])=>t==='Click again to open').length,1);
  const sel=w.eval('TV.gSel.skill');
  assert.equal(list.find(([id])=>id===sel)[1],'Click again to open');
  const other=list.find(([id])=>id!==sel)[0];
  w.document.querySelector(`#tv-guide .gd-pill[data-gid="${other}"]`).click();
  const after=Object.fromEntries(again(w,'#tv-guide .gd-pill'));
  assert.equal(after[other],'Click again to open');assert.equal(after[sel],null);
 }finally{dom.window.close()}
});

test('the channel knob reads "Classes"',async()=>{
 const {dom,w}=await boot();
 try{
  assert.match(source('core/tv-controls.js'),/MAIN_LBL=\{class:'Classes'/);
  w.eval("current.mood='class';renderPanel()");
  assert.match(w.document.getElementById('knob-main').getAttribute('aria-label'),/^Channel knob: Classes\./);
  assert.equal(w.document.querySelector('#dial-disc .d2-lbl[data-k="class"]').textContent.trim(),'CLASSES');
 }finally{dom.window.close()}
});
