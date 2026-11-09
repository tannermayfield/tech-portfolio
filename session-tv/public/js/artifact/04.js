/* ---------- model ---------- */
const TYPES={
  class:{label:'Classwork',tag:'Class',short:'Class',page:'Class',mood:'class',level:2.6,
    rule:'You do the work. AI coach explains concepts and checks your understanding, but never produces graded answers.'},
  skill:{label:'Skill Development',tag:'Skills',short:'Skill',page:'Skills',mood:'skill',level:3.8,
    rule:'Learn it, practice it, then apply it. Try it cold first; AI coach teaches what you don\'t know yet and checks your work.'},
  project:{label:'Personal Projects',tag:'Projects',short:'Project',page:'Projects',mood:'project',level:3.2,
    rule:'AI coach can do the heavy lifting. Your job is to explain what it built and why.'}
};
const CATS=['class','skill','project'];
const PIPE_RULE='You build it. AI coach teaches and hints, never writes your code or config.';
const LEVEL_BREAK=0.8;
const DEFAULT_ORDER=['class','skill','project'];
let SEQ=[];
function setSeq(order){const o=(order&&order.length===3&&DEFAULT_ORDER.every(k=>order.includes(k)))?order.slice():DEFAULT_ORDER.slice();SEQ=o.slice();return o}
setSeq();
const COLOR={class:'var(--class)',skill:'var(--pipeline)',project:'var(--personal)'};
const MOODS={class:{label:'Class'},skill:{label:'Skills'},project:{label:'Projects'}};
const COACH_PROMPTS={class:['Explain the concept behind this','Quiz me on it','Check my understanding'],skill:['Teach me this from the start','Give me a practice problem','How would I use this in class or a project?'],project:['Walk me through what this code does','Why was it built this way?','Quiz me on it']};
const COACH_RULES={
  class:'This is graded coursework. Teach concepts, quiz him, and check his understanding. Do not write answers he would submit for a grade. If the task is a proctored quiz or says no AI, tell him to close this chat and do it on his own.',
  skill:'This is a skill he is building for a data analyst co-op interview at Delta Air Lines. Match his stage: at New or Learned, teach it step by step with a concrete example (airline data when natural) and check understanding after each step; at Experienced or Mastered, give realistic practice problems with a small schema or sample data and no solution, then check correctness and edge cases (NULLs, ties, duplicates) and ask him to explain his choices. When it fits, show how the skill applies to his IS classes or his airline pipeline project. Reveal a full solution only if he explicitly asks.',
  project:'This is a personal project where AI may write the code. Help freely, but always explain what the code does and why it was built that way, and check that he understands it.',
  pipeline:'This is a portfolio project he must build himself so he can explain every decision in an interview. Teach concepts, ask what he has tried, and give the smallest useful hint. Tiny generic syntax examples are fine, but never write his actual Lambda code, Glue config, SQL, or IAM policy. Push him to explain trade-offs.'
};
/* skill stages: 1 NEW · 2 LEARNED · 3 EXPERIENCED · 4 MASTERED */
const skillLevel=t=>{const n=+t.level;return n>=1?Math.min(4,Math.round(n)):(t.track==='practice'?2:1)};
// old sessions and drafts used four categories; practice + develop are now one Skills category
const mapOldCat=k=>k==='practice'||k==='develop'?'skill':k==='grind'?'class':k==='creative'?'project':k;

let db=null,sample=null;
let tasks=[],archived=[],sessions=[],current=null,settings={};
const loaded={tasks:false,sessions:false,state:false};
let draft={end:'',alloc:null,manualAlloc:false,order:null};
let tabs={left:'class'},view='plan',switching=false;
let coachTurns={},coachCtl=null,feedbackText='',confidence=0,wrapping=false;

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function store(k,v){try{SessionWorkspace.storage.setItem(k,JSON.stringify(v))}catch(e){}}
function recall(k,d){try{const v=SessionWorkspace.storage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}}
function toast(m){/* bottom pop-up messages are turned off */}
const reduce=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function fmtMin(m){m=Math.max(0,Math.round(m||0));const h=Math.floor(m/60),r=m%60;return h?(r?`${h}h ${String(r).padStart(2,'0')}m`:`${h}h`):`${r}m`}
const fmtClock=d=>d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
function parseDay(s){if(!s)return null;const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function today(){const d=new Date();d.setHours(0,0,0,0);return d}
function daysUntil(s){const d=parseDay(s);return d?Math.round((d-today())/864e5):null}
function fmtTime(hm){const [h,m]=hm.split(':').map(Number);const d=new Date();d.setHours(h,m,0,0);return fmtClock(d)}
function dueAt(t){const d=parseDay(t.due);if(!d)return null;const [h,m]=(t.dueTime||'23:59').split(':').map(Number);d.setHours(h,m,0,0);return d}
function dueLabel(t){
  const n=daysUntil(t.due);if(n==null)return {text:'No date',cls:''};
  const tm=t.dueTime?` · ${fmtTime(t.dueTime)}`:'';
  const d=parseDay(t.due).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
  const past=dueAt(t)<new Date();
  if(n<0||(n===0&&past&&t.dueTime))return {text:`${d}${tm} · late`,cls:'late'};
  if(n===0)return {text:`Today${tm}`,cls:'late'};
  if(n===1)return {text:`Tomorrow${tm}`,cls:'soon'};
  return {text:`${d}${tm}${n<7?` · ${n}d`:''}`,cls:n<=3?'soon':''};
}
function agoLabel(iso){if(!iso)return 'Not practiced yet';const d=Math.floor((Date.now()-new Date(iso).getTime())/864e5);return d<=0?'Practiced today':d===1?'Practiced yesterday':`Practiced ${d}d ago`}
const byOrder=(a,b)=>(a.order??999)-(b.order??999);
function byDue(a,b){const x=(a.due||'9999-12-31')+(a.dueTime||'23:59'),y=(b.due||'9999-12-31')+(b.dueTime||'23:59');return x<y?-1:x>y?1:byOrder(a,b)}
const T=id=>tasks.find(t=>t.id===id)||archived.find(t=>t.id===id);
// one main skill per area (SQL, AWS, Python for Data…). Older sub-skills were archived and point at their main skill.
const mainSkillName=t=>{if(!t||!isSkill(t))return null;if(t.mainId){const m=T(t.mainId);return m?m.title:(t.course||t.title)}return t.title};
const mainSkillTask=n=>tasks.find(t=>isSkill(t)&&t.title===n);
const typeOf=t=>t.track==='practice'||t.track==='develop'?'skill':TYPES[t.track]?t.track:'project';
const moodOf=t=>typeOf(t);
const isSkill=t=>t.track==='practice'||t.track==='develop';
const isPipe=t=>String(t.course||'').toLowerCase()==='airline pipeline';
const ruleOf=t=>isPipe(t)?PIPE_RULE:TYPES[typeOf(t)].rule;
const openTasks=()=>tasks.filter(t=>t.status!=='done');
const leadOf=t=>t.leadDays!=null&&t.leadDays!==''&&Number.isFinite(+t.leadDays)?+t.leadDays:1;
const isUrgent=t=>{if(t.track!=='class'||t.status==='done')return false;if(!t.due)return true;const n=daysUntil(t.due),L=leadOf(t);return n<=L||(n===L+1&&!!t.dueTime&&t.dueTime<'13:00')};
const icon=m=>''; // category icons removed
let tlHidden=(()=>{try{return SessionWorkspace.storage.getItem('sb.tlHidden')==='1'}catch(e){return false}})();
let tlOpenTimer=0;
function setTlHidden(v){tlHidden=v;clearTimeout(tlOpenTimer);
  // opening: keep the list invisible while the panel widens, then fade it in
  $('work-main').classList.toggle('tl-opening',!v&&!reduce());if(!v&&!reduce())tlOpenTimer=setTimeout(()=>$('work-main').classList.remove('tl-opening'),370);try{SessionWorkspace.storage.setItem('sb.tlHidden',v?'1':'0')}catch(e){}
  $('work-main').classList.toggle('tl-collapsed',v);$('tl-logo').setAttribute('aria-expanded',String(!v));renderWork();}
document.addEventListener('click',e=>{
  if(e.target.closest('#tl-hide'))setTlHidden(true);
  else if(tlHidden&&e.target.closest('#work-main > aside'))setTlHidden(false);
});
const r5=n=>Math.round(n/5)*5;

/* ---------- candidates per type ---------- */
function candidates(type){
  const open=openTasks().filter(t=>typeOf(t)===type);
  if(type==='class')return [...open.filter(isUrgent).sort(byDue),...open.filter(t=>!isUrgent(t)).sort(byDue)];
  if(type==='skill')return open.sort((a,b)=>{const x=a.lastPracticed||'',y=b.lastPracticed||'';return x<y?-1:x>y?1:(skillLevel(b)-skillLevel(a))||byOrder(a,b)});
  return open.sort((a,b)=>(isPipe(b)-isPipe(a))||byOrder(a,b));
}

/* ---------- time & allocation ---------- */
function defaultEnd(){const d=new Date(Date.now()+120*60000);d.setMinutes(Math.ceil(d.getMinutes()/15)*15,0,0);return d.toTimeString().slice(0,5)}
function endDate(){
  const [h,m]=(draft.end||'00:00').split(':').map(Number);const d=new Date();d.setHours(h,m,0,0);
  if(d<=new Date())d.setDate(d.getDate()+1);return d;
}
// count from the minute the clock shows (5:21:48 counts as 5:21), so 5:21 → 6:15 is exactly 54m
const nowMinute=()=>{const d=new Date();d.setSeconds(0,0);return d.getTime()};
function totalMinutes(){return Math.max(0,Math.round((endDate()-nowMinute())/60000))}
function hasItems(type){return openTasks().some(t=>typeOf(t)===type)}
function defaultAlloc(total){
  const a={class:0,skill:0,project:0};
  if(total<10)return a;
  const types=CATS.filter(hasItems);
  if(!types.length)return a;
  const withBreaks=false;
  let work=total-(withBreaks?10:0);
  const urgentCount=openTasks().filter(isUrgent).length;
  const share={class:urgentCount?Math.min(.45,.2+.04*urgentCount):.2,skill:.45,project:.35};
  const ws=types.reduce((x,k)=>x+share[k],0);
  const floor=Math.max(5,Math.min(20,Math.floor(work/types.length/5)*5));
  types.forEach(k=>a[k]=Math.max(floor,r5(work*share[k]/ws)));
  const over=types.reduce((x,k)=>x+a[k],0)-work;
  if(over>0){const big=types.slice().sort((x,y)=>a[y]-a[x])[0];a[big]=Math.max(floor,a[big]-over)}
  fixTotal(a,total);return a;
}
function fixTotal(a,total){
  const s=SEQ.reduce((x,k)=>x+(a[k]||0),0);let diff=total-s;if(!diff)return a;
  const vis=SEQ.filter(k=>!k.startsWith('break')&&a[k]>0);
  const last=vis[vis.length-1]||['skill','project','class'].sort((x,y)=>a[y]-a[x])[0];
  a[last]=Math.max(0,a[last]+diff);return a;
}
function scaleAlloc(a,total){
  const s=SEQ.reduce((x,k)=>x+(a[k]||0),0);if(!s)return defaultAlloc(total);
  const out={};SEQ.forEach(k=>out[k]=r5((a[k]||0)*total/s));
  return fixTotal(out,total);
}
function syncAlloc(){
  const total=totalMinutes();
  if(!draft.manualAlloc||!draft.alloc)draft.alloc=defaultAlloc(total);
  else if(SEQ.reduce((x,k)=>x+(draft.alloc[k]||0),0)!==total)draft.alloc=scaleAlloc(draft.alloc,total);
  fixBreaks(draft.alloc);
}
function saveDraft(){store('sb.draft2',draft)}
function segments(){
  const out=[];let t=nowMinute();
  SEQ.forEach(k=>{const m=draft.alloc[k]||0;if(m<=0)return;const start=new Date(t);t+=m*60000;out.push({key:k,type:k.startsWith('break')?'break':k,min:m,start,end:new Date(t)})});
  if(out.length)out[out.length-1].end=endDate();
  return out;
}
const levelOf=k=>k.startsWith('break')?LEVEL_BREAK:TYPES[k].level;
const labelOf=k=>k.startsWith('break')?'Break':TYPES[k].label;

/* ---------- render: side lists ---------- */
const LVL_COLORS=['','#F2706B','#EDCB45','#9AD657','#3FD18B'];
const LVL_NAMES=['','New','Learned','Experienced','Mastered'];
const LVL_TAG=n=>(LVL_NAMES[n]||'New').toUpperCase();
function lvlBox(t){const n=skillLevel(t);return `<span class="lvl-box" style="--lc:${LVL_COLORS[n]}" title="${LVL_NAMES[n]}" aria-label="${LVL_NAMES[n]}">${LVL_TAG(n)}</span>`}
function lvlCtl(t){
  const n=skillLevel(t);
  return `<span class="lvl"><button type="button" class="lvl-box" style="--lc:${LVL_COLORS[n]}" data-lvlopen="${esc(t.id)}" aria-haspopup="true" aria-expanded="false" title="${LVL_NAMES[n]}. Click to change" aria-label="Your stage on ${esc(t.title)}: ${LVL_NAMES[n]}. Change">${LVL_TAG(n)}</button>
    <span class="lvl-pop" role="radiogroup" aria-label="Pick your level" hidden>${[1,2,3,4].map(i=>`<button type="button" style="--lc:${LVL_COLORS[i]}" data-lvl="${esc(t.id)}" data-n="${i}" role="radio" aria-checked="${i===n}" title="${LVL_NAMES[i]}">${LVL_TAG(i)}</button>`).join('')}</span></span>`;
}
document.addEventListener('click',e=>{if(!e.target.closest('.lvl'))document.querySelectorAll('.lvl-pop:not([hidden])').forEach(x=>{x.hidden=true;x.previousElementSibling?.setAttribute('aria-expanded','false')})});
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.lvl-pop:not([hidden])').forEach(x=>x.hidden=true)});
// submitted work keeps a plain due date: no red/amber urgency and no "late"
function dueFor(t){const d=dueLabel(t);if(t.status!=='done')return d;return {cls:'',text:d.text.replace(/\s*·\s*(late|overdue)\b.*$/i,'').replace(/^(late|overdue)\s*·\s*/i,'')}}
const chkBtn=t=>{const done=t.status==='done';return `<button type="button" class="chk" role="checkbox" aria-checked="${done}" data-chk="${esc(t.id)}" aria-label="${done?'Mark not submitted':'Mark submitted'}: ${esc(t.title)}" title="${done?'Submitted. Click to undo':'Mark as submitted'}">✓</button>`};
let skillMetaAll=false; // in the All view each skill shows "Category · Subcategory"; in a category view, when it was last practiced
function itemRow(t){
  const type=typeOf(t),done=t.status==='done';
  let meta='',side='';
  if(type==='class'){const d=t.due?dueFor(t):null;
    meta=`<span>${esc(t.course||'')}</span>`+(d?`<span class="due ${d.cls}">${esc(d.text)}</span>`:'')}
  else if(type==='skill'){meta=skillMetaAll?`<span>${esc(catOf(t))} · ${esc(t.course||'Other')}</span>`:`<span>${esc(agoLabel(t.lastPracticed))}${t.reps?` · ${t.reps} rep${t.reps>1?'s':''}`:''}</span>`;side=lvlCtl(t)}
  else meta=(isPipe(t)&&t.phase?`<span>${esc(t.phase)}</span>`:'');
  const chk=type==='class'?chkBtn(t):'';
  return `<li class="item${chk?' has-chk':''}${done?' is-done':''}">${chk}<div class="t">${esc(t.title)}</div>
    <div class="side">${side}</div>
    <div class="meta">${meta}</div></li>`;
}
function bindRows(root){
  root.querySelectorAll('[data-chk]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleSubmitted(b.dataset.chk)});
  root.querySelectorAll('.item.has-chk').forEach(li=>{const id=li.querySelector('[data-chk]').dataset.chk;li.onclick=()=>openTask(id);li.tabIndex=0;li.setAttribute('role','button');li.setAttribute('aria-label','Details: '+T(id)?.title);li.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target===li){e.preventDefault();openTask(id)}}});
  root.querySelectorAll('[data-lvl]').forEach(b=>b.onclick=()=>setLevel(b.dataset.lvl,+b.dataset.n));
  root.querySelectorAll('[data-lvlopen]').forEach(b=>b.onclick=()=>{const pop=b.nextElementSibling,open=pop.hidden;document.querySelectorAll('.lvl-pop').forEach(x=>x.hidden=true);pop.hidden=!open;b.setAttribute('aria-expanded',String(open));if(open)pop.querySelector('[aria-checked="true"]')?.focus()});
}
/* assignment details popup, with an Edit form */
let tdId=null;
function fmtDue(t){if(!t.due)return 'No due date';const d=parseDay(t.due);return d.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})+(t.dueTime?' at '+fmtTime(t.dueTime):'')}
function openTask(id,edit){
  const t=T(id);if(!t)return;tdId=id;const done=t.status==='done',d=t.due?dueFor(t):null,lead=leadOf(t);
  let start='';if(t.due){const s=parseDay(t.due);s.setDate(s.getDate()-lead);start=s.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}
  $('td-view').innerHTML=`<div class="td-head"><h3 id="td-title">${esc(t.title)}</h3><button type="button" class="td-x" id="td-close" aria-label="Close">×</button></div>
    <dl class="td-rows">
      <dt>Course</dt><dd>${esc(t.course||'—')}</dd>
      <dt>Due</dt><dd>${esc(fmtDue(t))}${d&&!done&&d.cls?` <span class="due ${d.cls}">${esc(d.text)}</span>`:''}</dd>
      <dt>Start early</dt><dd>${lead} day${lead===1?'':'s'} ahead${start?` <span class="muted">(shows as due soon from ${esc(start)})</span>`:''}</dd>
      <dt>Status</dt><dd>${done?`<span style="color:var(--ok)">✓ Submitted</span>${t.doneAt?` <span class="muted">${esc(new Date(t.doneAt).toLocaleDateString(undefined,{month:'short',day:'numeric'}))}</span>`:''}`:'Not submitted'}</dd>
      ${t.goal?`<dt>Goal</dt><dd>By the end, you should be able to explain ${esc(t.goal)}</dd>`:''}
    </dl>
    <div class="dd-btns"><button type="button" class="btn ghost" id="td-edit">Edit</button><button type="button" class="btn primary" id="td-sub">${done?'Mark not submitted':'Mark submitted'}</button></div>`;
  if(TV.tdPast===id){const x=$('td-close');x.textContent='‹ Back';x.classList.add('td-back');x.setAttribute('aria-label','Back to past assignments');x.onclick=()=>{TV.tdPast=null;openPast()}}
  else $('td-close').onclick=()=>$('task-dlg').close();
  $('td-sub').onclick=()=>{toggleSubmitted(id);setTimeout(()=>openTask(id),50)};
  $('td-edit').onclick=()=>openTask(id,true);
  $('td-view').hidden=!!edit;$('td-form').hidden=!edit;
  if(edit){$('td-t').value=t.title||'';$('td-course').value=t.course||'';$('td-lead').value=lead;$('td-due').value=t.due||'';$('td-time').value=t.dueTime||'';$('td-goal').value=t.goal||''}
  if(!$('task-dlg').open)$('task-dlg').showModal();
  (edit?$('td-t'):$('td-sub')).focus();
}
$('task-dlg').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close()});
$('task-dlg').addEventListener('close',()=>{TV.tdPast=null});
$('td-cancel').onclick=()=>openTask(tdId);
$('td-form').onsubmit=async e=>{
  e.preventDefault();const id=tdId,t=T(id);if(!t)return;
  const lead=$('td-lead').value===''?1:Math.max(0,Math.min(21,Math.round(+$('td-lead').value)));
  const patch={title:$('td-t').value.trim()||t.title,course:$('td-course').value.trim(),goal:$('td-goal').value.trim(),due:$('td-due').value||null,dueTime:$('td-due').value?($('td-time').value||'23:59'):null,leadDays:lead};
  Object.assign(t,patch);refresh();openTask(id);
  await guard(()=>db.doc('tasks/'+id).update(patch),'Assignment updated');
};
async function toggleSubmitted(id){
  const t=T(id);if(!t)return;const done=t.status!=='done';
  const patch=done?{status:'done',doneAt:new Date().toISOString()}:{status:'todo',doneAt:null};
  Object.assign(t,patch);refresh(); // move it right away; the database snapshot confirms it
  await guard(()=>db.doc('tasks/'+id).update(patch),done?'Marked submitted':'Moved back to unsubmitted');
}
// "Submitted" heading: a dropdown that shows or hides checked-off work (remembered per browser)
let showSub=(()=>{try{return SessionWorkspace.storage.getItem('sb.showSub')!=='0'}catch(e){return true}})();
const subHead=pad=>`<button type="button" class="sub-toggle" data-subtoggle aria-expanded="${showSub}"${pad?' style="margin-left:10px"':''}><svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Submitted</button>`;
document.addEventListener('click',e=>{if(!e.target.closest('[data-subtoggle]'))return;showSub=!showSub;try{SessionWorkspace.storage.setItem('sb.showSub',showSub?'1':'0')}catch(_){}refresh()});
// checked-off classwork from the last two weeks, shown under the open assignments
function recentSubmitted(){const cut=Date.now()-14*864e5;return tasks.filter(t=>typeOf(t)==='class'&&t.status==='done'&&(t.doneAt?new Date(t.doneAt).getTime()>=cut:false)).sort((a,b)=>(b.doneAt||'').localeCompare(a.doneAt||''))}
async function setLevel(id,n){
  const t=T(id);if(!t||skillLevel(t)===n&&t.level!=null)return;
  t.level=n;refresh(); // show it right away; the database snapshot confirms it
  await guard(()=>db.doc('tasks/'+id).update({level:n}));
}
function grouped(list,keyFn){
  const g={};list.forEach(t=>{const k=keyFn(t)||'Other';(g[k]=g[k]||[]).push(t)});
  return Object.keys(g).map((k,i)=>`<div class="group-label" ${i?'style="margin-top:10px"':''}>${esc(k)}</div><ul class="list">${g[k].map(itemRow).join('')}</ul>`).join('');
}
let filters=recall('sb.filters',{});if(filters.skill==='Level')filters.skill='All';if(filters.skill==='Coding')filters.skill='Software';
let lvlSort=recall('sb.lvlSort','asc'); // skills by level: 'asc' = 1 → 5, 'desc' = 5 → 1
const SKILL_TAGS={Data:['SQL','Databases','Python','Data engineering','Visualization','BI'],AI:['Machine learning','Deep learning','Generative AI','Responsible AI','AI'],Software:['Python','JavaScript','Node.js','HTML/CSS'],Cloud:['AWS'],PM:['Scrum','Project management'],'Soft Skills':['Interview','Communication']};
// a skill's category: its own "cat" field when set (Python lives in both Data and Software), else the first category that lists its subcategory
const catOf=t=>t.cat&&SKILL_TAGS[t.cat]?t.cat:(Object.keys(SKILL_TAGS).find(k=>SKILL_TAGS[k].includes(t.course||''))||'Soft Skills');
const TAGGED=[...new Set(Object.values(SKILL_TAGS).flat())];
const matchFilter=(t,f)=>{const c=t.course||'Other';
  if(isSkill(t)){if(f==='All')return true;if(SKILL_TAGS[f])return catOf(t)===f;return true} // a filter that no longer exists shows everything
  return c===f};
// skills are always shown in groups: by subcategory (SQL, Databases…), or by level when the Level filter is on
function skillGroups(list,f,dir=lvlSort){
  if(f==='All'){const out=[];const ns=dir==='desc'?[4,3,2,1]:[1,2,3,4];for(const n of ns){const items=list.filter(t=>skillLevel(t)===n);if(items.length)out.push({label:LVL_NAMES[n],items})}return out}
  const g={};list.forEach(t=>{const k=f?t.course||'Other':`${catOf(t)} · ${t.course||'Other'}`;(g[k]=g[k]||[]).push(t)}); // no filter: "Data · Python" and "Software · Python" stay apart
  const keys=Object.keys(g);if(SKILL_TAGS[f])keys.sort((a,b)=>SKILL_TAGS[f].indexOf(a)-SKILL_TAGS[f].indexOf(b));
  const byLvl=(a,b)=>dir==='desc'?skillLevel(b)-skillLevel(a):skillLevel(a)-skillLevel(b);
  return keys.map(k=>({label:k,items:g[k].slice().sort(byLvl)}));
}
function filterOptions(type){
  if(type==='class')return ['Due Date','IS 401','IS 402','IS 403','IS 404'];
  if(type==='skill')return ['All',...Object.keys(SKILL_TAGS)];
  const seen=[];tasks.filter(t=>typeOf(t)===type&&t.status!=='done').sort(byOrder).forEach(t=>{const c=t.course||'Other';if(!seen.includes(c))seen.push(c)});
  return seen;
}
function renderSide(side){
  const type=side==='left'?tabs.left:'skill',listEl=$(side==='left'?'left-list':'skill-list'),fEl=$(side==='left'?'left-sum':'skill-sum');
  if(side==='left'){$('left-toggle').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===type)));$('left-title').textContent=TYPES[type].label;$('left-ic').innerHTML=icon(type)}
  if(!loaded.tasks)return;
  const opts=filterOptions(type);
  let f=filters[type]||(type==='class'?'Due Date':'');if(f&&!opts.includes(f))f=type==='class'?'Due Date':'';
  fEl.innerHTML=opts.map(o=>`<button type="button" aria-pressed="${o===f}" data-f="${esc(o)}">${esc(o)}</button>`).join('');
  fEl.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{const v=b.dataset.f;filters[type]=(type!=='class'&&filters[type]===v)?'':v;store('sb.filters',filters);renderSide(side)});
  let list=candidates(type);let h='';
  const empty=msg=>`<p class="muted small" style="margin:0">${msg}</p>`;
  if(type==='class'){
    const subm=recentSubmitted().filter(t=>f==='Due Date'||t.course===f);
    if(f==='Due Date'){
      const all=list.slice().sort(byDue);
      if(all.length)h=`<ul class="list">${all.map(itemRow).join('')}</ul>`;
      h=h||empty('Nothing open. Send a fresh Canvas screenshot in chat to add more.');
    } else {
      list=list.filter(t=>t.course===f);
      h=list.length?`<ul class="list">${list.map(itemRow).join('')}</ul>`:empty(`Nothing open in ${esc(f)}.`);
    }
    if(subm.length)h+=subHead(false)+(showSub?`<ul class="list">${subm.map(itemRow).join('')}</ul>`:'');
  } else {
    if(f)list=list.filter(t=>matchFilter(t,f));
    skillMetaAll=type==='skill'; // every filter shows "Category · Subcategory" under each skill
    if(type==='skill')h=skillGroups(list,f).map((g,i)=>`<div class="group-label" ${i?'style="margin-top:10px"':''}>${esc(g.label)}</div><ul class="list">${g.items.map(itemRow).join('')}</ul>`).join('')||empty(f&&f!=='All'?`No ${esc(f)} skills yet. Add one with Add item.`:'No skills yet. Add one with Add item.');
    else h=(f?`<ul class="list">${list.map(itemRow).join('')}</ul>`:grouped(list,t=>t.course||'Other'))||empty(type==='skill'?'No skills yet. Add one with Add item.':'No open project tasks. Add one with Add item.');
    if(f&&!list.length)h=empty('Nothing open here.');
  }
  listEl.innerHTML=h;bindRows(listEl);
}

/* ---------- render: middle ---------- */
function renderMiddle(){
  if(!loaded.tasks){$('flow').innerHTML='<div class="muted small">Loading your tasks…</div>';return}
  syncAlloc();
  $('end-time').value=draft.end;
  const total=totalMinutes(),segs=segments();
  $('avail').innerHTML=total?`Session time available: <b>${Math.floor(total/60)?`${Math.floor(total/60)}h ${String(total%60).padStart(2,'0')}m`:`${total%60}m`}</b>`:'Pick a finish time later than now';
  $('reset-plan').hidden=true;
  renderGraph(segs,total);
  // legend + add-back chips
  const ord=SEQ.filter(k=>!k.startsWith('break'));
  $('legend').innerHTML=`<span class="small hint">Drag a section to reorder · Drag the dots to resize · Hover a section to remove it</span>`;
  // why
  const urgent=openTasks().filter(isUrgent);
  $('why').innerHTML=urgent.length?`<b>${urgent.length} class ${urgent.length===1?'item is':'items are'} due in the next 2 days</b>, so Classwork gets a bigger block. Drag the labels to change the order.`
    :`Nothing in class is due in the next 2 days, so the time goes to skills and projects. The interview could come any day.`;
  // flow
  $('flow').innerHTML=segs.map(s=>{
    const tm=`${fmtClock(s.start)} – ${fmtClock(s.end)}`;
    if(s.type==='break')return `<div class="seg brk t-break"><span class="stripe"></span><div class="seg-head"><b class="muted" style="font-weight:600">Break · stand up, water, no screens</b><span class="tm">${tm} · ${fmtMin(s.min)}</span></div></div>`;
    const c=candidates(s.type),n=c.length,first=c[0];
    const note=s.type==='class'?`${c.filter(isUrgent).length} due soon · ${n} open`:s.type==='skill'?`${n} skills · least recently practiced first`:`${n} open tasks`;
    return `<div class="seg t-${s.type}"><span class="stripe"></span><div style="min-width:0"><div class="seg-head"><b>${icon(s.type)} ${TYPES[s.type].label}</b><span class="tm">${tm} · ${fmtMin(s.min)}</span></div>
      ${n?`<div class="empty">${esc(note)}${first?` · starts with <span style="color:var(--ink)">${esc(first.title)}</span>`:''}</div>`:`<div class="empty">Nothing open in this category yet.</div>`}</div></div>`;
  }).join('')||'<div class="muted small">Set a finish time to build your plan.</div>';
  const work=segs.filter(s=>s.type!=='break').reduce((a,s)=>a+s.min,0),brk=segs.filter(s=>s.type==='break').reduce((a,s)=>a+s.min,0);
  $('plan-total').textContent=total?`${fmtMin(work)} work${brk?` · ${fmtMin(brk)} breaks`:''} · done by ${fmtClock(endDate())}`:'';
  $('start-btn').textContent=current?'Resume session':'Quick Start';
  $('begin-btn').hidden=!!current;$('start-btn').classList.toggle('primary',!!current);
  $('start-btn').disabled=!current&&!segs.some(s=>s.type!=='break'&&candidates(s.type).length);
  $('begin-btn').disabled=$('start-btn').disabled;
}
const WORK=CATS;
function biggestWork(a,ex){return WORK.filter(k=>k!==ex).sort((x,y)=>a[y]-a[x])[0]}
function fixBreaks(a){ // breaks are no longer part of the plan: fold any leftover break time into the largest section
  const extra=(a.break1||0)+(a.break2||0);a.break1=0;a.break2=0;
  if(extra)a[biggestWork(a)]+=extra;delete a.break1;delete a.break2;
  return a;
}
function insertAtDefault(k){
  const o=SEQ.filter(x=>!x.startsWith('break')&&x!==k),di=DEFAULT_ORDER.indexOf(k);
  let at=o.findIndex(x=>DEFAULT_ORDER.indexOf(x)>di);if(at<0)at=o.length;o.splice(at,0,k);return o;
}
function addType(type){
  draft.order=setSeq(insertAtDefault(type));
  const big=biggestWork(draft.alloc,type);
  const take=Math.min(20,Math.max(0,draft.alloc[big]-10));if(!take){toast('Not enough time left to add another section.');return}
  draft.alloc[big]-=take;draft.alloc[type]+=take;fixBreaks(draft.alloc);draft.manualAlloc=true;saveDraft();renderPlan();
}
function removeType(type){
  const a=draft.alloc,m=a[type]||0;if(!m)return;
  const rest=WORK.filter(k=>k!==type&&a[k]>0);
  if(!rest.length){toast('Keep at least one section in the session.');return}
  a[type]=0;const tot=rest.reduce((x,k)=>x+a[k],0)||1;let given=0;
  rest.forEach((k,i)=>{const add=i===rest.length-1?m-given:r5(m*a[k]/tot);a[k]+=add;given+=add});
  fixBreaks(a);draft.manualAlloc=true;saveDraft();renderPlan();
}

let reorder=null,reorderMoved=false;
function applyOrder(o){
  const old=SEQ.join();draft.order=setSeq(o);if(SEQ.join()===old)return;
  // move break minutes so breaks stay between work blocks
  if(!draft.manualAlloc)draft.alloc=defaultAlloc(totalMinutes());else fixBreaks(draft.alloc);
  saveDraft();renderMiddle();
}
window.addEventListener('pointermove',e=>{if(!reorder)return;
  if(!reorder.active){if(Math.abs(e.clientX-reorder.x)+Math.abs(e.clientY-reorder.y)<6)return;reorder.active=true;reorderMoved=true;document.body.style.cursor='grabbing';renderMiddle()}
  e.preventDefault();
  const el=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('[data-sec]');
  if(!el||el.dataset.key===reorder.key)return;
  const o=SEQ.filter(k=>!k.startsWith('break')),from=o.indexOf(reorder.key),to=o.indexOf(el.dataset.key);
  o.splice(from,1);o.splice(to,0,reorder.key);applyOrder(o);
});
window.addEventListener('pointerup',()=>{if(!reorder)return;const was=reorder.active;reorder=null;document.body.style.cursor='';if(was){renderPlan();setTimeout(()=>reorderMoved=false,0)}});

/* ---------- graph ---------- */
let drag=null;
function renderGraph(segs,total){
  const svg=$('graph');const W=Math.max(260,svg.clientWidth||600),H=260,top=34,base=H-26,unit=(base-top)/4.6;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  if(!total||!segs.length){svg.innerHTML=`<text x="${W/2}" y="${H/2}" text-anchor="middle" class="lbl2">No time left before your finish time</text>`;return}
  const X=m=>m/total*W;
  let cum=0;const geo=segs.map(s=>{const x0=X(cum);cum+=s.min;const x1=X(cum);return {...s,x0,x1,w:x1-x0,y:base-levelOf(s.key)*unit}});
  // transitions: an even S-curve centered on each boundary, split at its midpoint so each section owns half
  const tr=geo.slice(0,-1).map((s,i)=>{const n=geo[i+1],xb=s.x1,h=Math.max(1,Math.min(26,s.w*.45,n.w*.45)),y1=s.y,y2=n.y,ym=(y1+y2)/2;
    return {xb,h,y1,y2,ym,
      left:`L${xb-h},${y1} C${xb-h/2},${y1} ${xb-h/4},${(3*y1+y2)/4} ${xb},${ym}`,
      right:`C${xb+h/4},${(y1+3*y2)/4} ${xb+h/2},${y2} ${xb+h},${y2}`}});
  let defs='',g='';
  const used=new Set(geo.map(s=>s.key.startsWith('break')?'break':s.key));
  used.forEach(k=>{const c=k==='break'?'var(--rest)':COLOR[k];
    defs+=`<linearGradient id="gf-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${c};stop-opacity:.42"/><stop offset="1" style="stop-color:${c};stop-opacity:.04"/></linearGradient>`});
  geo.forEach((s,i)=>{
    const c=s.type==='break'?'var(--rest)':COLOR[s.key],gid='gf-'+(s.type==='break'?'break':s.key);
    const L=tr[i-1],R=tr[i];
    const start=L?`M${L.xb},${L.ym} ${L.right}`:`M${s.x0},${s.y}`;
    const end=R?` ${R.left}`:` L${s.x1},${s.y}`;
    const topPath=start+end;
    const xEnd=R?R.xb:s.x1,xStart=L?L.xb:s.x0;
    if(s.type!=='break')g+=`<g class="secg">`;
    g+=`<path d="${topPath} L${xEnd},${base} L${xStart},${base} Z" fill="url(#${gid})" ${s.type==='break'?'':`class="sec${reorder&&reorder.active&&reorder.key===s.key?' lifted':''}" data-sec="1" data-key="${s.key}" tabindex="0" role="button" aria-label="${TYPES[s.key].label}, ${fmtMin(s.min)}. Drag or use arrow keys to reorder"`}/>`;
    g+=`<path d="${topPath}" fill="none" stroke="${c}" stroke-width="${s.type==='break'?2:3}" stroke-linecap="round" ${s.type==='break'?'stroke-dasharray="2 5"':''} style="filter:drop-shadow(0 0 6px ${c})"/>`;
    if(s.type!=='break'){const tx=xEnd-26,ty=base-26;
      g+=(s.w>=40?`<g class="trash" data-trash="${s.key}" tabindex="0" role="button" aria-label="Remove ${TYPES[s.key].label} from this session"><rect x="${tx}" y="${ty}" width="22" height="22" rx="7"/><path d="M${tx+6.5} ${ty+7.5}h9M${tx+9.5} ${ty+7.5}v-1.5h3v1.5M${tx+8} ${ty+9}l.6 7h4.8l.6-7" fill="none"/></g>`:'')+`</g>`}
  });
  // labels
  geo.forEach(s=>{
    if(s.type==='break')return;
    const cx=(s.x0+s.x1)/2;
    if(s.w>=70)g+=`<text x="${cx}" y="${s.y+22}" text-anchor="middle" class="lbl">${esc(TYPES[s.type].short)}</text><text x="${cx}" y="${s.y+37}" text-anchor="middle" class="lbl2">${fmtMin(s.min)}</text>`;
    else if(s.w>=30)g+=`<text x="${cx}" y="${s.y+22}" text-anchor="middle" class="lbl2">${fmtMin(s.min)}</text>`;
  });
  g+=`<text x="2" y="${H-6}" class="tick">${esc(fmtClock(geo[0].start))}</text><text x="${W-2}" y="${H-6}" text-anchor="end" class="tick">${esc(fmtClock(geo[geo.length-1].end))}</text>`;
  // handles
  geo.slice(0,-1).forEach((s,i)=>{const n=geo[i+1],t=tr[i];
    g+=`<g class="handle" tabindex="0" role="slider" aria-label="Boundary between ${esc(labelOf(s.key))} and ${esc(labelOf(n.key))}" aria-valuenow="${s.min}" aria-valuetext="${esc(labelOf(s.key))} ${fmtMin(s.min)}, ${esc(labelOf(n.key))} ${fmtMin(n.min)}" data-a="${s.key}" data-b="${n.key}">
      <rect x="${t.xb-10}" y="${top-8}" width="20" height="${base-top+8}" fill="transparent"/>
      <circle class="grip" cx="${t.xb}" cy="${t.ym}" r="5.5"/></g>`});
  // add-back buttons for categories not in the session, placed where they'd slot in by default order
  const missing=WORK.filter(k=>!(draft.alloc[k]>0)&&hasItems(k));
  const spots={};
  missing.forEach(k=>{const o=insertAtDefault(k),idx=o.indexOf(k);
    const lastBefore=o.slice(0,idx).reverse().find(b=>geo.some(s=>s.key===b));
    const x=lastBefore?geo.find(s=>s.key===lastBefore).x1:0;
    (spots[x]=spots[x]||[]).push(k)});
  Object.keys(spots).forEach(xs=>{const ks=spots[xs],gap=26,width=(ks.length-1)*gap;
    let start=+xs-width/2;start=Math.max(14,Math.min(W-14-width,start));
    ks.sort((p,q)=>DEFAULT_ORDER.indexOf(p)-DEFAULT_ORDER.indexOf(q)).forEach((k,i)=>{const x=start+i*gap;
      g+=`<g class="addbtn" data-add="${k}" tabindex="0" role="button" aria-label="Add ${TYPES[k].label} to this session" style="--c:${COLOR[k]}"><title>Add ${TYPES[k].label}</title><circle cx="${x}" cy="11" r="10"/><path d="M${x-4.5} 11h9M${x} ${11-4.5}v9"/></g>`})});
  svg.innerHTML=`<defs>${defs}</defs>`+g;
  svg.querySelectorAll('[data-trash]').forEach(t=>{t.addEventListener('pointerdown',e=>e.stopPropagation());t.addEventListener('click',e=>{e.stopPropagation();removeType(t.dataset.trash)});t.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();removeType(t.dataset.trash)}})});
  svg.querySelectorAll('[data-add]').forEach(t=>{t.addEventListener('click',()=>addType(t.dataset.add));t.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();addType(t.dataset.add)}})});
  svg.querySelectorAll('[data-sec]').forEach(p=>{p.addEventListener('pointerdown',e=>{if(e.button)return;e.preventDefault();reorder={key:p.dataset.key,x:e.clientX,y:e.clientY,active:false};reorderMoved=false});
    p.addEventListener('keydown',e=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();
      const o=SEQ.slice(),i=o.indexOf(p.dataset.key),j=i+(e.key==='ArrowRight'?1:-1);if(j<0||j>=o.length)return;
      o.splice(i,1);o.splice(j,0,p.dataset.key);applyOrder(o);$('graph').querySelector(`[data-key="${p.dataset.key}"]`)?.focus()})});
  svg.querySelectorAll('.handle').forEach(h=>{
    h.addEventListener('pointerdown',e=>{e.preventDefault();h.classList.add('drag');
      drag={a:h.dataset.a,b:h.dataset.b,x:e.clientX,A:draft.alloc[h.dataset.a],B:draft.alloc[h.dataset.b],perPx:total/W};
      document.body.style.cursor='ew-resize'});
    h.addEventListener('keydown',e=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();
      const dl=e.key==='ArrowRight'?5:-5,a=h.dataset.a,b=h.dataset.b;moveBoundary(a,b,draft.alloc[a]+dl,draft.alloc[a]+draft.alloc[b]);
      renderMiddle();const nh=[...$('graph').querySelectorAll('.handle')].find(x=>x.dataset.a===a&&x.dataset.b===b);nh?.focus()});
  });
}
function moveBoundary(a,b,newA,pair){
  newA=Math.max(0,Math.min(pair,r5(newA)));
  draft.alloc[a]=newA;draft.alloc[b]=pair-newA;draft.manualAlloc=true;
  saveDraft();
}
window.addEventListener('pointermove',e=>{if(!drag)return;
  const dm=(e.clientX-drag.x)*drag.perPx;const pair=drag.A+drag.B;
  const before=draft.alloc[drag.a];moveBoundary(drag.a,drag.b,drag.A+dm,pair);
  if(draft.alloc[drag.a]!==before){renderMiddle();const h=[...$('graph').querySelectorAll('.handle')].find(x=>x.dataset.a===drag.a&&x.dataset.b===drag.b);h?.classList.add('drag')}
});
window.addEventListener('pointerup',()=>{if(!drag)return;drag=null;document.body.style.cursor='';renderPlan()});
window.addEventListener('resize',()=>{if(view==='plan'||view==='log'){renderMiddle();if(sky.mode==='plan')skySize()}if(view==='work')sizeStars()});

function renderPlan(){renderSide('left');renderSide('skills');renderMiddle()}

/* ---------- work screen ---------- */
function accumulate(){
  if(!current)return;const now=Date.now();
  if(current.active&&current.activeSince){const d=Math.min(now-current.activeSince,150*60000);current.timeOn[current.active]=(current.timeOn[current.active]||0)+Math.max(0,d)}
  current.activeSince=now;
}
function spentIn(k){return spentInType(k)}
const isDoneNow=t=>t&&(isSkill(t)?(current.practiced||[]).includes(t.id):t.status==='done');
const allocOf=k=>(current?.alloc||{})[k]||0;
function queueFor(mood){return candidates(mood)}
function firstOpenIn(mood,skip){return queueFor(mood).find(t=>t.id!==skip&&!isDoneNow(t))?.id||null}
function spentInType(k){
  let ms=0;for(const id in current.timeOn){const t=T(id);if(t&&typeOf(t)===k)ms+=current.timeOn[id]}
  const a=T(current.active);if(a&&typeOf(a)===k&&current.activeSince)ms+=Math.min(Date.now()-current.activeSince,150*60000);
  return ms/60000;
}
function doneThisSession(){if(!current)return 0;const st=new Date(current.startedAt).getTime();return (current.practiced||[]).length+tasks.filter(t=>t.status==='done'&&t.doneAt&&new Date(t.doneAt).getTime()>=st).length}
function tlItem(t){
  const type=typeOf(t),d=type==='class'&&t.due?dueFor(t):null;
  const btn=`<button class="tl-item t-${type} ${isDoneNow(t)?'done':''}${type==='skill'?' has-lvl':''}" data-task="${esc(t.id)}" aria-current="${current.active===t.id}">
    <span class="dot"></span><span><span class="tt">${esc(t.title)}</span><span class="tm"><span>${t.course?esc(t.course):esc(TYPES[type].short)}</span>${d?`<span class="due ${d.cls}">${esc(d.text)}</span>`:''}</span></span>${type==='skill'?`<span class="tl-lvl">${lvlBox(t)}</span>`:''}</button>`;
  return type==='class'?`<div class="tl-row${t.status==='done'?' is-done':''}">${chkBtn(t)}${btn}</div>`:btn;
}
function renderWork(){
  if(!current)return;
  const m=current.mood;document.body.dataset.mood=m;
  $('w-mood-name').textContent=MOODS[m].label;
  document.querySelectorAll('.moodswitch button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.m===m)));
  // display-only preview of an Apple Music "now playing" strip (wired up later in the GitHub version)
  $('w-music').dataset.mood=m;
  $('w-music').innerHTML=`<div class="np-art" aria-hidden="true">${icon(m)}</div>
    <div class="np-text"><div class="np-title">Track name</div><div class="np-sub">Artist · ${MOODS[m].label} playlist</div><div class="np-bar"><i></i></div></div>
    <div class="np-ctrl" aria-hidden="true"><span>⏮</span><span class="np-play">▶</span><span>⏭</span></div>`;
  $('work-main').hidden=wrapping;$('wrapup').hidden=!wrapping;document.querySelector('.wbar').hidden=wrapping;
  if(wrapping){renderWrap();renderClock();return}
  $('tl-title').textContent=TYPES[m].label;
  $('tl-logo').innerHTML=icon(m);
  document.querySelector('.tl-rail').innerHTML='<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'.repeat(7);
  const aside=document.querySelector('#work-main > aside');if(tlHidden){aside.setAttribute('role','button');aside.setAttribute('aria-label','Show list');aside.title='Show list'}else{aside.removeAttribute('role');aside.removeAttribute('aria-label');aside.removeAttribute('title')}
  $('work-main').classList.toggle('tl-collapsed',tlHidden);
  $('tl-logo').setAttribute('aria-expanded',String(!tlHidden));
  $('tl-count').textContent=`${doneThisSession()} done this session`;
  // one list per page, with the same filter tags as the planning board
  const wt=m;
  const opts=filterOptions(wt);let fv=filters[wt]||(wt==='class'?'Due Date':'');if(fv&&!opts.includes(fv))fv=wt==='class'?'Due Date':'';
  $('tl-filters').innerHTML=opts.map(o=>`<button type="button" aria-pressed="${o===fv}" data-f="${esc(o)}">${esc(o)}</button>`).join('');
  $('tl-filters').querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{const v=b.dataset.f;filters[wt]=(wt!=='class'&&filters[wt]===v)?'':v;store('sb.filters',filters);renderWork()});
  let lst=candidates(wt);
  let subm=[];
  if(wt==='class'){lst=(fv==='Due Date'?lst.slice().sort(byDue):lst.filter(t=>t.course===fv)).filter(t=>t.status!=='done');
    subm=recentSubmitted().filter(t=>fv==='Due Date'||t.course===fv)}
  else if(fv)lst=lst.filter(t=>matchFilter(t,fv));
  $('tl').innerHTML=!lst.length?'<div class="small muted" style="padding:4px 10px">Nothing open here.</div>'
    :wt==='skill'?skillGroups(lst,fv,'asc').map((g,i)=>`<div class="group-label" style="padding:0 10px;margin-top:${i?10:0}px">${esc(g.label)}</div>${g.items.map(tlItem).join('')}`).join('')
    :lst.map(tlItem).join('');
  if(subm.length)$('tl').innerHTML+=subHead(true)+(showSub?subm.map(tlItem).join(''):'');
  $('tl').querySelectorAll('[data-chk]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleSubmitted(b.dataset.chk)});
  $('tl').querySelectorAll('[data-task]').forEach(b=>b.onclick=()=>selectTask(b.dataset.task));
  const t=T(current.active),f=$('focus');
  wsMount(t&&current.mood==='skill'?t:null);
  if(!t){f.innerHTML=`<div class="chat-title"><h2>Pick something from the list</h2></div>`;$('coach-log').innerHTML=`<div class="msg ai">Pick an item on the left to start, or switch pages at the top.</div>`;$('coach-quick').innerHTML='';renderClock();return}
  const type=typeOf(t),d=type==='class'&&t.due?dueLabel(t):null;
  const doneNow=isDoneNow(t);
  const doneBtn=doneNow?(isSkill(t)?`<span class="small" style="color:var(--ok)">Practiced ✓</span>`:`<button class="btn" id="undo-done">Mark not done</button>`)
    :isSkill(t)?(current.wrapUp?.[t.id]?`<button class="btn primary" id="done-btn" title="Save this conversation and move to the next skill">Next Skill</button>`:`<button class="btn primary" id="wrapup-btn" title="Stop practicing and teach back what you know">Wrap Up</button>`)
    :`<button class="btn primary" id="done-btn" title="Mark this assignment done and go back to the channel menu">Done</button>`;
  f.innerHTML=`<div class="chat-title"><h2 title="${esc(t.title)}">${esc(t.title)}</h2></div>
    <div class="row chat-actions">${type==='skill'?`<span class="lvl-wrap">${lvlCtl(t)}</span>`:''}${doneBtn}</div>`;
  if($('done-btn'))$('done-btn').onclick=()=>{if(isSkill(t)){saveSkillChat(t.id);markDone(t.id)}else doneToMenu(t.id)};
  if($('wrapup-btn'))$('wrapup-btn').onclick=()=>{current.wrapUp=Object.assign({},current.wrapUp,{[t.id]:true});saveState();renderWork();
    sendCoach('I\'m ready to wrap up this skill. Stop teaching and quizzing me, and ask me to teach it back to you.','Wrap up: I\'ll teach it back.')};
  if($('undo-done'))$('undo-done').onclick=()=>guard(()=>db.doc('tasks/'+t.id).update({status:'todo',doneAt:null}));
  bindRows(f);renderWsOpen();
  $('coach-wrap').hidden=false;$('coach-form').hidden=!sample;$('coach-quick').hidden=!sample;
  const qp=isPipe(t)?['Explain the concept first','I\'m stuck. Give me a hint','Why this over the alternative?']:COACH_PROMPTS[type];
  $('coach-quick').innerHTML=qp.map(q=>`<button type="button">${esc(q)}</button>`).join('');
  $('coach-quick').querySelectorAll('button').forEach(b=>b.onclick=()=>sendCoach(b.textContent));
  renderCoachLog();renderClock();
}
// the next planned category after k (in plan order) that still has time; wraps around if needed
function nextCategory(k){
  const ord=(current.order||DEFAULT_ORDER).filter(x=>allocOf(x)>0);
  const left=x=>allocOf(x)-spentInType(x)>0&&candidates(x).length;
  const i=ord.indexOf(k);const after=[...ord.slice(i+1),...ord.slice(0,Math.max(0,i))];
  return after.find(left)||null;
}
// the planned category you should be on right now: the block your session clock falls in, else the next one with time left
function whereShouldBe(){
  const ord=(current.order||DEFAULT_ORDER).filter(x=>allocOf(x)>0);
  const left=x=>allocOf(x)-spentInType(x)>0&&candidates(x).length;
  const el=(Date.now()-new Date(current.startedAt).getTime())/60000;let cum=0;
  for(const x of ord){cum+=allocOf(x);if(el<cum&&left(x))return x}
  return ord.find(left)||null;
}
function goToCategory(k){
  const mood=k,first=candidates(k).find(t=>!isDoneNow(t))?.id||null;
  if(mood===current.mood){if(first)selectTask(first);else renderWork()}
  else{current.cur[mood]=first;switchMood(mood)}
}
function renderClock(){
  if(!current)return;
  const el=Math.round((Date.now()-new Date(current.startedAt).getTime())/60000);
  const a=T(current.active),k=a?typeOf(a):null,planned=k?allocOf(k):0,spent=k?spentInType(k):0;
  const tot=current.endAt?Math.max(1,Math.round((new Date(current.endAt)-new Date(current.startedAt))/60000)):(current.minutes||1);
  $('wp-cat-lbl').textContent=k?TYPES[k].tag:'Category';
  $('wp-cat').style.width=Math.min(100,planned?spent/planned*100:0)+'%';$('wp-cat').style.background=k?COLOR[k]:'var(--accent)';
  const offPlan=!!k&&!(planned>0);
  $('wp-cat').parentElement.classList.toggle('off-plan',offPlan);
  if(offPlan)$('w-clock').title='This category isn\'t in today\'s plan';
  const nk=offPlan?whereShouldBe():(k&&planned-spent<=0?nextCategory(k):null);
  if(k&&planned-spent>0)$('wp-cat-val').textContent=`${fmtMin(planned-spent)} left`;
  else if(nk){$('wp-cat-val').innerHTML=`<button class="wp-next" id="wp-next" title="Go to ${esc(TYPES[nk].label)}" aria-label="Next: ${esc(TYPES[nk].label)}">Next →</button>`;$('wp-next').onclick=()=>goToCategory(nk)}
  else $('wp-cat-val').textContent=k?'Time\'s up':'';
  $('wp-ses').style.width=Math.min(100,el/tot*100)+'%';
  if(tot-el>0)$('wp-ses-val').textContent=`${fmtMin(tot-el)} left`;
  else if(!$('wp-end')){$('wp-ses-val').innerHTML='<button class="wp-next wp-end" id="wp-end" title="End session" aria-label="End session">End</button>';$('wp-end').onclick=()=>$('w-end').click()}
  $('w-clock').title=current.endAt?`Finish by ${fmtClock(new Date(current.endAt))}`:'';
  if($('meter-lbl')){$('meter-lbl').textContent=`${fmtMin(spent)} of ${fmtMin(planned)}`;$('meter-bar').style.width=Math.min(100,planned?spent/planned*100:0)+'%'}
}
setInterval(()=>{if(view==='work')renderClock()},30000);
// refresh the plan right as each new minute starts, so the numbers always match the clock
(function minuteTick(){setTimeout(()=>{if(view==='plan'&&!drag)renderMiddle();minuteTick()},60000-Date.now()%60000+50)})();

/* ---------- session actions ---------- */
let stateQ=Promise.resolve();
function saveState(){if(!db||!current)return;const snap=JSON.parse(JSON.stringify(current));stateQ=stateQ.then(()=>db.doc('state/current').set(snap)).catch(()=>toast('Couldn\'t save the session. Check your connection.'))}
const playlistUrl=m=>settings[m+'Url']||(m==='class'?settings.grindUrl:m==='project'?settings.creativeUrl:'')||'';
function openPlaylist(m){const u=playlistUrl(m);if(!settings.autoOpen||!u)return;const a=document.createElement('a');a.href=u;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove()}
function startWorking(quick){
  if(current){go('work');return}
  const a=draft.alloc;
  const segs=segments().filter(s=>s.type!=='break');
  let fm=segs.find(s=>candidates(s.type).length)?.type||CATS.find(k=>candidates(k).length)||'class';
  openPlaylist(fm);
  const now=Date.now();
  current={startedAt:new Date(now).toISOString(),endAt:endDate().toISOString(),minutes:totalMinutes(),alloc:{class:a.class||0,skill:a.skill||0,project:a.project||0},
    mood:fm,order:SEQ.slice(),active:null,activeSince:now,timeOn:{},practiced:[],cur:{class:null,skill:null,project:null}};
  current.active=firstOpenIn(fm);
  wrapping=false;feedbackText='';confidence=0;coachTurns={};
  saveState();
  if(quick){setScene(fm,false);go('work')}else warpTo(fm);
}
/* ---------- lightspeed transition: plan -> work ---------- */
let warpActive=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function warpTo(fm){
  if(reduce()){setScene(fm,false);go('work');return}
  warpActive=true;closeDrawers();
  document.body.classList.add('leaving');            // 1. boxes and text fade out, the rain keeps falling
  await sleep(650);
  await hyperspace(()=>{                             //    at full speed, swap to the work screen underneath (UI hidden)
    document.body.classList.add('arriving');
    setScene('class',false);go('work');
  });
  document.body.classList.remove('leaving');
  if(fm!=='class'){setScene(fm,true);await sleep(2300)}   // drop down to the sky or the beach if the session starts there
  await sleep(150);
  warpActive=false;
  document.body.classList.remove('arriving');        // 3. only now fade the work screen in
}

function selectTask(id){
  const t=T(id);if(!t||!current)return;accumulate();
  current.active=id;current.cur[current.mood]=id;
  saveState();renderWork();window.scrollTo({top:0,behavior:reduce()?'auto':'smooth'});
}
// keep the skill's conversation (including the teach-back) with the session; it's saved to the learning log at the end
function saveSkillChat(id){
  const turns=(coachTurns[id]||[]).slice(-30).map(x=>({role:x.role,content:String(x.show||x.content).slice(0,1500)}));
  if(!turns.length)return;current.skillChats=Object.assign({},current.skillChats,{[id]:{title:T(id)?.title||'',main:mainSkillName(T(id))||null,turns,at:new Date().toISOString()}});saveState();
}
async function markDone(id){
  accumulate();const t=T(id);
  if(isSkill(t)){current.practiced=[...new Set([...(current.practiced||[]),id])]}
  const k=typeOf(t);const next=candidates(k).find(x=>x.id!==id&&!isDoneNow(x))?.id||firstOpenIn(current.mood,id);
  if(next){current.active=next;current.cur[current.mood]=next}
  saveState();
  const msg=next?'Nice. On to the next one.':'Nothing left here. Switch pages or end the session.';
  if(isSkill(t))await guard(()=>db.doc('tasks/'+id).update({lastPracticed:new Date().toISOString(),reps:(t.reps||0)+1}),msg);
  else await guard(()=>db.doc('tasks/'+id).update({status:'done',doneAt:new Date().toISOString()}),msg);
  renderWork();
}
function setScene(m,animate){const s=$('scene');if(animate&&!reduce())s.classList.add('animate');else s.classList.remove('animate');s.dataset.pos=m}
function switchMood(to){
  if(!current||switching||to===current.mood)return;
  openPlaylist(to);accumulate();current.cur[current.mood]=current.active;
  const c=current.cur[to];
  const nextTask=(c&&T(c)&&!isDoneNow(T(c)))?c:firstOpenIn(to);
  const apply=()=>{current.mood=to;current.active=nextTask;current.activeSince=Date.now();saveState();renderWork()};
  if(reduce()){setScene(to,false);apply();return}
  switching=true;document.body.classList.add('panning');setScene(to,true);
  setTimeout(apply,500);setTimeout(()=>{document.body.classList.remove('panning');switching=false},1750);
}
document.querySelectorAll('.moodswitch button').forEach(b=>b.onclick=()=>switchMood(b.dataset.m));

/* ---------- coach ---------- */
// one chat per project: every task in a project shares the project's conversation
const chatKey=t=>t?(typeOf(t)==='project'?'proj:'+(t.course||'Other'):t.id):null;
const CLAUDE_MARK='<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="#D97757" d="M12 2l1.6 6.2L20 6.6l-4.6 4.6L22 12l-6.6.8 4.6 4.6-6.4-1.6L12 22l-1.6-6.2L4 17.4l4.6-4.6L2 12l6.6-.8L4 6.6l6.4 1.6z"/></svg>';
function renderCoachLog(){
  const t=T(current?.active),turns=coachTurns[chatKey(t)]||[];
  const intro=t&&typeOf(t)==='project'?projectIntro(t):t?`<div class="msg ai intro"><div class="ai-name">${CLAUDE_MARK} AI coach</div>${t.goal?`By the end of this one, you should be able to explain <b>${esc(t.goal)}</b>.<br><br>`:''}${esc(ruleOf(t))}${sample?' Ask for a hint, a practice problem, or explain your thinking and I\'ll push back.':'<br><br><span class="muted">AI coaching is optional. See Settings → AI Connections for connection status.</span>'}</div>`:'';
  $('coach-log').innerHTML=intro+turns.map(x=>x.role==='user'?`<div class="msg me">${fmtMsg(x.show||x.content,false)}</div>`:`<div class="msg ai"><div class="ai-name">${CLAUDE_MARK} AI coach</div>${fmtMsg(x.content,true)}${x.lines&&x.lines.length?`<br><button type="button" class="flag-chip" data-flags="${x.lines.join(',')}">Marked line${x.lines.length>1?'s':''} ${fmtLines(x.lines)} in your editor</button>`:''}</div>`).join('');
  $('coach-log').querySelectorAll('[data-usecode]').forEach(b=>b.onclick=()=>{if(!WS.ed)return;WS.ed.set(b.nextElementSibling.textContent);wsSave();WS.ed.focus()});
  $('coach-log').querySelectorAll('[data-flags]').forEach(b=>b.onclick=()=>{if(WS.ed)wsFlag(b.dataset.flags.split(',').map(Number))});
  $('coach-log').scrollTop=$('coach-log').scrollHeight;
}
// plain text with fenced code blocks; AI coach's code blocks get a "Put in editor" button when the editor is open
function fmtMsg(text,ai){
  return String(text).split(/```[\w+-]*\n?([\s\S]*?)```/g).map((part,i)=>i%2?`${ai&&WS.ed?'<button type="button" class="use-code" data-usecode>Put in editor ↗</button>':''}<pre class="code">${esc(part.replace(/\n$/,''))}</pre>`:esc(part)).join('');
}
async function sendCoach(text,show){
  text=(text||'').trim();const t=T(current?.active);if(!text||!sample||!t)return;
  coachCtl?.abort();const ctl=coachCtl=new AbortController();
  const ck=chatKey(t),turns=coachTurns[ck]=coachTurns[ck]||[];
  turns.push(show?{role:'user',content:text,show}:{role:'user',content:text});if(!show){$('coach-input').value='';$('coach-input').style.height='auto'}renderCoachLog();
  const wrapEl=document.createElement('div');wrapEl.className='msg ai';wrapEl.innerHTML=`<div class="ai-name">${CLAUDE_MARK} AI coach</div><span></span>`;const el=wrapEl.lastChild;el.textContent='Thinking…';$('coach-log').appendChild(wrapEl);$('coach-send').disabled=true;
  const type=typeOf(t),wrapUp=type==='skill'&&current.wrapUp?.[t.id];
  const rules=`You are a tutor for Tanner, a BYU Information Systems student preparing for a data analyst co-op interview at Delta (SQL, Python, AWS data pipelines). He learns best by explaining things back. ${type==='project'?COACH_RULES['proj_'+projMode(t)]:COACH_RULES[isPipe(t)?'pipeline':type]}${type==='project'?projectCtx(t):`\nCurrent item (${TYPES[type].label}): ${t.title}${t.course?` (${t.course})`:''}`}${type==='skill'?`\nHis self-rated stage on this skill: ${LVL_NAMES[skillLevel(t)]} (stages: New, Learned, Experienced, Mastered).`:''}${t.goal&&type!=='project'?`\nGoal: he should be able to explain ${t.goal}`:''}\n\nKeep replies under 200 words unless a problem needs a schema. Plain text, no markdown headings. End with a question that makes him think when it fits.${wsRulesFor(t)}${wrapUp?`\n\nTEACH-BACK MODE: He clicked Wrap Up for this skill. Stop teaching, quizzing and giving new problems. Ask him to teach you the skill in his own words, as if explaining it to an interviewer: what it is, when to use it, a concrete example (ideally from what he did today), and a common mistake. Then respond to his explanation: say what he got right, name any gaps or errors in one or two sentences, and ask him to fill just those gaps. Keep it to a short back-and-forth, and when his explanation is solid, tell him he can click Next Skill.`:''}`;
  try{
    const {text:out}=await sample([{role:'user',content:rules},...turns.slice(-12).map(x=>({role:x.role,content:x.content}))],{cache:false,signal:ctl.signal,onText:({text})=>{el.textContent=text.replace(/\n?\s*LINES:[^\n]*$/i,'');$('coach-log').scrollTop=$('coach-log').scrollHeight}});
    const lm=out.match(/\n?\s*LINES:\s*([^\n]*)\s*$/i),lines=lm?parseLines(lm[1]):[];
    turns.push({role:'assistant',content:lm?out.slice(0,lm.index).trim():out,lines});
    if(lines.length&&WS.ed&&WS.id===t.id)wsFlag(lines);
    renderCoachLog();
  }catch(e){
    if(e.code==='cancelled'){el.textContent=e.text||'(stopped)'}
    else if(['not_granted','sampling_disabled','not_declared','capability_disabled','capability_removed'].includes(e.code)){el.textContent='AI coach isn\'t available on this board right now.'}
    else{el.textContent=(e.text?e.text+'\n\n':'')+(e.code==='rate_limited'?'Too many requests. Wait a bit and try again.':'That didn\'t go through. Try again.');turns.pop()}
  }finally{$('coach-send').disabled=false}
}
$('coach-form').onsubmit=e=>{e.preventDefault();sendCoach($('coach-input').value)};
$('coach-input').addEventListener('input',e=>{const t=e.target;t.style.height='auto';t.style.height=Math.min(160,t.scrollHeight)+'px'});
$('coach-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendCoach($('coach-input').value)}});

/* ---------- workspace: a hands-on editor beside the chat for skills you practice in code ---------- */
const CDN='https://cdnjs.cloudflare.com/ajax/libs/';
const WS_KINDS={
  sql:{label:'SQL editor',lang:'sql',mode:'text/x-sql',run:'Run query',file:'query.sql',
    starter:'-- Practice against the airline sample database. Click Tables to see what\'s in it.\nSELECT origin, COUNT(*) AS flights\nFROM flights\nGROUP BY origin\nORDER BY flights DESC;\n'},
  python:{label:'Python editor',lang:'python',mode:'python',run:'Run',file:'main.py',
    starter:'# The airline sample data is here too: flights.csv, airports.csv, airlines.csv, bookings.csv\nimport csv\n\nwith open("flights.csv") as f:\n    rows = list(csv.DictReader(f))\nprint(len(rows), "flights")\n'},
  js:{label:'JavaScript editor',lang:'javascript',mode:'javascript',run:'Run',file:'main.js',
    starter:'// console.log() output shows below\nconst delays = [12, null, 45, 0, 7];\nconst valid = delays.filter(d => d !== null);\nconsole.log(valid.reduce((a, b) => a + b, 0) / valid.length);\n'},
  html:{label:'HTML/CSS editor',lang:'html',mode:'htmlmixed',run:'Preview',file:'index.html',
    starter:'<!doctype html>\n<html>\n<head>\n\n</head>\n<body>\n  <h1>Hello</h1>\n</body>\n</html>\n'}
};
const WS_BY_COURSE={SQL:'sql',Databases:'sql',Python:'python',JavaScript:'js','Node.js':'js','HTML/CSS':'html'};
const wsKindOf=t=>t&&typeOf(t)==='skill'?WS_BY_COURSE[t.course]||null:null;

/* sample airline data (same rows in SQL and as CSV files for Python), seeded so it never changes */
const AIR=(()=>{
  let seed=42;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648};const pick=a=>a[Math.floor(rnd()*a.length)];
  const airlines=[['DL','Delta Air Lines'],['AA','American Airlines'],['UA','United Airlines'],['WN','Southwest Airlines']];
  const airports=[['ATL','Atlanta','GA',1],['SLC','Salt Lake City','UT',1],['MSP','Minneapolis','MN',1],['DTW','Detroit','MI',1],['JFK','New York','NY',1],['LAX','Los Angeles','CA',0],['SEA','Seattle','WA',0],['DEN','Denver','CO',0],['ORD','Chicago','IL',0],['BOS','Boston','MA',0]];
  const aircraft=[['N101DL','A321',191],['N102DL','B737-900',180],['N103DL','A220-300',130],['N201AA','A321',190],['N202AA','B737-800',172],['N301UA','B737-900',179],['N302UA','A320',150],['N401WN','B737-800',175],['N402WN','B737 MAX 8',175]];
  const dist={};const mi=(a,b)=>{const k=[a,b].sort().join();return dist[k]=dist[k]||300+Math.floor(rnd()*2200)};
  const flights=[],bookings=[];let bid=1;
  for(let i=1;i<=240;i++){
    const al=pick(airlines)[0],o=pick(airports)[0];let d=pick(airports)[0];while(d===o)d=pick(airports)[0];
    const day=1+Math.floor(rnd()*31),hr=5+Math.floor(rnd()*17),mn=pick([0,10,15,25,30,40,45,55]);
    const canc=rnd()<.04?1:0,missing=!canc&&rnd()<.05;
    const dep=canc||missing?null:Math.max(-12,Math.round((rnd()<.62?rnd()*12-6:rnd()*95)));
    const arr=dep==null?null:dep+Math.round(rnd()*16-9);
    const ac=pick(aircraft.filter(a=>a[0].endsWith(al)))||pick(aircraft);
    flights.push([i,al,al+(100+Math.floor(rnd()*2800)),o,d,`2026-10-${String(day).padStart(2,'0')} ${String(hr).padStart(2,'0')}:${String(mn).padStart(2,'0')}`,dep,arr,canc,mi(o,d),ac[0]]);
    if(!canc){const n=2+Math.floor(rnd()*4);for(let k=0;k<n;k++){const fc=pick(['Main','Main','Main','Comfort+','First']);bookings.push([bid++,i,fc,Math.round((fc==='First'?420:fc==='Comfort+'?260:140)*(0.7+rnd()*.8)),Math.floor(rnd()*3)])}}
  }
  return {
    tables:{
      airlines:{cols:['code TEXT PRIMARY KEY','name TEXT'],rows:airlines},
      airports:{cols:['code TEXT PRIMARY KEY','city TEXT','state TEXT','is_hub INTEGER'],rows:airports},
      aircraft:{cols:['tail_number TEXT PRIMARY KEY','model TEXT','seats INTEGER'],rows:aircraft},
      flights:{cols:['flight_id INTEGER PRIMARY KEY','airline TEXT','flight_no TEXT','origin TEXT','dest TEXT','sched_dep TEXT','dep_delay_min INTEGER','arr_delay_min INTEGER','cancelled INTEGER','distance_mi INTEGER','tail_number TEXT'],rows:flights},
      bookings:{cols:['booking_id INTEGER PRIMARY KEY','flight_id INTEGER','fare_class TEXT','fare_usd INTEGER','checked_bags INTEGER'],rows:bookings}
    }
  };
})();
const AIR_SCHEMA=Object.entries(AIR.tables).map(([n,t])=>`${n}(${t.cols.join(', ')}) -- ${t.rows.length} rows`).join('\n')+
  '\nNotes: sched_dep is "YYYY-MM-DD HH:MM" in Oct 2026; dep_delay_min/arr_delay_min are NULL for cancelled flights and a few with missing data; negative delay = early.';
const csvOf=name=>{const t=AIR.tables[name];const head=t.cols.map(c=>c.split(' ')[0]).join(',');return head+'\n'+t.rows.map(r=>r.map(v=>v==null?'':/[",\n]/.test(String(v))?`"${String(v).replace(/"/g,'""')}"`:v).join(',')).join('\n')+'\n'};

/* script loading */
const loaded$={};
function loadScript(src){return loaded$[src]=loaded$[src]||new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>{delete loaded$[src];no(new Error('load failed: '+src))};document.head.appendChild(s)})}
async function loadCM(kind){
  await loadScript(CDN+'codemirror/5.65.16/codemirror.min.js');
  const modes={sql:['sql'],python:['python'],js:['javascript'],html:['xml','javascript','css','htmlmixed']}[kind];
  for(const m of modes)await loadScript(`${CDN}codemirror/5.65.16/mode/${m}/${m}.min.js`);
}
let SQLdb=null;
const withTimeout=(pr,ms,what)=>Promise.race([pr,new Promise((_,no)=>setTimeout(()=>no(new Error('timeout: '+what)),ms))]);
let SQLinit=null;
const wsStatus=t=>{const o=$('ws-out');if(o&&WS.busy)o.innerHTML=`<div class="ws-hint">${t}</div>`};
// can this page compile WebAssembly at all? (a strict sandbox throws right away)
const wasmAllowed=(()=>{try{return typeof WebAssembly==='object'&&!!new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]))}catch(e){return false}})();
async function sqlEngine(){
  if(wasmAllowed){
    try{
      wsStatus('Loading the SQL engine…');
      await withTimeout(loadScript(CDN+'sql.js/1.8.0/sql-wasm.js'),8000,'sql-wasm.js');
      // fetch the engine ourselves so a blocked download fails fast instead of hanging
      const bin=await withTimeout(fetch(CDN+'sql.js/1.8.0/sql-wasm.wasm').then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.arrayBuffer()}),8000,'sql-wasm.wasm');
      return await withTimeout(window.initSqlJs({wasmBinary:bin}),8000,'sql-wasm start');
    }catch(e){console.warn('[ws] WebAssembly SQL engine failed, using the JavaScript build',e)}
  }
  wsStatus('Loading the SQL engine (JavaScript version, first run takes a few seconds)…');
  try{delete window.initSqlJs}catch(_){window.initSqlJs=undefined}
  await withTimeout(loadScript(CDN+'sql.js/1.8.0/sql-asm.js'),20000,'sql-asm.js');
  return await withTimeout(window.initSqlJs(),15000,'sql-asm start');
}
async function sqlDb(){
  if(SQLdb)return SQLdb;
  const SQL=await (SQLinit=SQLinit||sqlEngine().catch(e=>{SQLinit=null;throw e}));
  const db=new SQL.Database();
  for(const [n,t] of Object.entries(AIR.tables)){
    db.run(`CREATE TABLE ${n} (${t.cols.join(', ')})`);
    const st=db.prepare(`INSERT INTO ${n} VALUES (${t.cols.map(()=>'?').join(',')})`);t.rows.forEach(r=>st.run(r));st.free();
  }
  return SQLdb=db;
}
let PY=null;
async function pyodide(){
  if(PY)return PY;
  await loadScript('https://cdn.jsdelivr.net/npm/pyodide@0.26.4/pyodide.js');
  PY=await window.loadPyodide({indexURL:'https://cdn.jsdelivr.net/npm/pyodide@0.26.4/'});
  for(const n of Object.keys(AIR.tables))PY.FS.writeFile(n+'.csv',csvOf(n));
  return PY;
}

/* the editor: CodeMirror when it loads, a plain text box otherwise */
const WS={kind:null,id:null,ed:null,flags:[],out:'',busy:false};
const wsKey=id=>'sb.ws.'+id;
function wsMakeEditor(host,kind,text){
  host.innerHTML='';
  if(window.CodeMirror){
    const cm=window.CodeMirror(host,{value:text,mode:WS_KINDS[kind].mode,lineNumbers:true,indentUnit:kind==='python'?4:2,tabSize:4,lineWrapping:false,
      extraKeys:{'Ctrl-Enter':()=>wsRun(),'Cmd-Enter':()=>wsRun(),Tab:c=>c.somethingSelected()?c.indentSelection('add'):c.replaceSelection(kind==='python'?'    ':'  ')}});
    cm.on('change',()=>{wsSave();if(WS.flags.length)wsClearFlags()});
    // CodeMirror measures the line-number gutter once; re-measure whenever the panel resizes or the code font finishes loading,
    // so the code never slides under the line numbers
    setTimeout(()=>cm.refresh(),30);
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>cm.refresh());
    if(window.ResizeObserver){let raf=0;new ResizeObserver(()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>cm.refresh())}).observe(host)}
    return {get:()=>cm.getValue(),set:v=>cm.setValue(v),focus:()=>cm.focus(),
      flag:ls=>{ls.forEach(n=>{if(n>=1&&n<=cm.lineCount())cm.addLineClass(n-1,'wrap','ws-flag')});if(ls.length)cm.scrollIntoView({line:ls[0]-1,ch:0},60)},
      clear:()=>{for(let i=0;i<cm.lineCount();i++)cm.removeLineClass(i,'wrap','ws-flag')},refresh:()=>cm.refresh()};
  }
  const ta=document.createElement('textarea');ta.className='ws-plain';ta.spellcheck=false;ta.value=text;ta.setAttribute('aria-label','Code editor');host.appendChild(ta);
  ta.addEventListener('input',()=>{wsSave();if(WS.flags.length)wsClearFlags()});
  ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();wsRun()}else if(e.key==='Tab'){e.preventDefault();const s=ta.selectionStart;ta.setRangeText(kind==='python'?'    ':'  ',s,ta.selectionEnd,'end');wsSave()}});
  return {get:()=>ta.value,set:v=>{ta.value=v},focus:()=>ta.focus(),flag:()=>{},clear:()=>{},refresh:()=>{}};
}
function wsSave(){if(!WS.id||!WS.ed)return;try{SessionWorkspace.storage.setItem(wsKey(WS.id),WS.ed.get())}catch(e){}}
function wsClearFlags(){WS.flags=[];WS.ed&&WS.ed.clear();$('ws-flagnote').hidden=true}
function wsFlag(lines){WS.flags=lines;WS.ed.clear();WS.ed.flag(lines);const n=$('ws-flagnote');n.hidden=!lines.length;n.textContent=`AI coach marked line${lines.length>1?'s':''} ${fmtLines(lines)}`}
const fmtLines=ls=>{const out=[];let a=null,b=null;ls.forEach(n=>{if(a==null){a=b=n}else if(n===b+1)b=n;else{out.push(a===b?a:a+'–'+b);a=b=n}});if(a!=null)out.push(a===b?a:a+'–'+b);return out.join(', ')};
const parseLines=s=>{const set=new Set();s.split(/[,\s]+/).forEach(p=>{const m=p.match(/^(\d+)(?:[-–](\d+))?$/);if(m){const a=+m[1],b=+(m[2]||m[1]);for(let i=a;i<=Math.min(b,a+60);i++)set.add(i)}});return [...set].sort((x,y)=>x-y)};

async function wsMount(t){
  const kind=wsKindOf(t),main=$('work-main');
  main.classList.toggle('has-ws',!!kind);$('ws').hidden=!kind;$('ws-split').hidden=!kind;
  $('work-mid').classList.toggle('split',!!kind);wsApplyWidth();
  if(!kind){WS.kind=WS.id=null;return}
  if(WS.id===t.id&&WS.kind===kind&&WS.ed){WS.ed.refresh();return}
  wsSave();
  const K=WS_KINDS[kind];WS.kind=kind;WS.id=t.id;WS.flags=[];WS.out='';
  $('ws-title').textContent=K.label;$('ws-file').textContent=K.file;$('ws-run').innerHTML='<svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true" style="margin-right:5px;vertical-align:-1px"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/></svg>Run';$('ws-run').setAttribute('aria-label',K.run);
  $('ws-tables').hidden=kind!=='sql';$('ws-flagnote').hidden=true;
  $('ws-out').innerHTML=`<div class="ws-hint">${kind==='sql'?'Results show here. <b>Ctrl/⌘ + Enter</b> runs the query.':kind==='html'?'Your page previews here.':kind==='python'?'Output shows here. The first run loads Python, which takes a few seconds.':'console.log output shows here.'}</div>`;
  let text;try{text=SessionWorkspace.storage.getItem(wsKey(t.id))}catch(e){}
  const host=$('ws-ed');host.innerHTML='<div class="ws-hint" style="padding:14px">Loading editor…</div>';
  try{await loadCM(kind)}catch(e){}
  if(WS.id!==t.id)return;
  WS.ed=wsMakeEditor(host,kind,text??K.starter);
}
async function wsRun(){
  if(!WS.ed||WS.busy)return;const code=WS.ed.get(),out=$('ws-out'),kind=WS.kind;
  WS.busy=true;$('ws-run').disabled=true;out.innerHTML='<div class="ws-hint">Running…</div>';
  try{
    if(kind==='sql'){
      const db=await sqlDb();const res=db.exec(code);
      if(!res.length){out.innerHTML='<div class="ws-hint">Ran fine. No rows returned.</div>';WS.out='Ran with no rows returned.'}
      else{const r=res[res.length-1],rows=r.values.slice(0,200);
        out.innerHTML=`<div class="ws-meta">${r.values.length} row${r.values.length===1?'':'s'}${r.values.length>200?' · showing 200':''}</div><div class="ws-table-wrap"><table class="ws-table"><thead><tr>${r.columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(v=>`<tr>${v.map(x=>`<td${x==null?' class="null"':''}>${x==null?'NULL':esc(typeof x==='number'&&!Number.isInteger(x)?String(+x.toFixed(4)):String(x))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
        WS.out=`${r.values.length} rows. Columns: ${r.columns.join(', ')}\n`+r.values.slice(0,8).map(v=>v.map(x=>x==null?'NULL':x).join(' | ')).join('\n')}
    } else if(kind==='js'){
      const logs=await runJs(code);out.innerHTML=`<pre class="ws-console">${esc(logs.text)||'<span class="muted">(no output)</span>'}</pre>`;WS.out=logs.text.slice(0,1500);
      if(logs.error)out.querySelector('pre').classList.add('err');
    } else if(kind==='html'){
      out.innerHTML='<iframe class="ws-preview" sandbox="allow-scripts" title="Preview of your page"></iframe>';out.querySelector('iframe').srcdoc=code;WS.out='(rendered preview)';
    } else if(kind==='python'){
      let py;try{py=await pyodide()}catch(e){out.innerHTML='<div class="ws-err">Python couldn\'t load here. You can still send your code to AI coach to review.</div>';WS.out='';return}
      let buf='';py.setStdout({batched:s=>buf+=s+'\n'});py.setStderr({batched:s=>buf+=s+'\n'});
      try{await py.loadPackagesFromImports(code)}catch(e){buf+='(Some packages, like pandas, may not be available here.)\n'}
      try{const r=await py.runPythonAsync(code);if(r!==undefined&&r!==null)buf+=String(r)+'\n';out.innerHTML=`<pre class="ws-console">${esc(buf)||'<span class="muted">(no output)</span>'}</pre>`}
      catch(e){buf+=String(e.message||e);out.innerHTML=`<pre class="ws-console err">${esc(buf)}</pre>`}
      WS.out=buf.slice(-1500);
    }
  }catch(e){
    const msg=String(e.message||e),infra=/^(load failed|timeout:)/.test(msg);
    out.innerHTML=`<div class="ws-err">${esc(infra?`The ${kind==='sql'?'SQL engine':'runner'} couldn't load in this view (${msg.replace(/^(load failed|timeout): /,'')}). You can still send your code to AI coach to review.`:msg)}</div>`;WS.out=infra?'':'Error: '+msg;
  }finally{WS.busy=false;$('ws-run').disabled=false}
}
function runJs(code){
  return new Promise(res=>{
    const src=`const out=[];const fmt=a=>a.map(x=>typeof x==='string'?x:(()=>{try{return JSON.stringify(x)}catch(e){return String(x)}})()).join(' ');
      console.log=(...a)=>{out.push(fmt(a))};console.error=console.warn=console.info=console.log;
      onmessage=e=>{try{const r=(0,eval)(e.data);if(r!==undefined)out.push('← '+fmt([r]));postMessage({text:out.join('\\n')})}catch(err){out.push(String(err));postMessage({text:out.join('\\n'),error:true})}}`;
    const url=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));let w;
    try{w=new Worker(url)}catch(e){res({text:'Running JavaScript isn\'t available here.',error:true});return}
    const done=r=>{clearTimeout(tm);w.terminate();URL.revokeObjectURL(url);res(r)};
    const tm=setTimeout(()=>done({text:'Stopped after 3 seconds (infinite loop?).',error:true}),3000);
    w.onmessage=e=>done(e.data);w.onerror=e=>{e.preventDefault();done({text:String(e.message||'Error'),error:true})};
    w.postMessage(code);
  });
}
function wsSend(){
  if(!WS.ed)return;const code=WS.ed.get().replace(/\s+$/,'');if(!code)return;
  const K=WS_KINDS[WS.kind],numbered=code.split('\n').map((l,i)=>`${String(i+1).padStart(3)}| ${l}`).join('\n');
  const show=`Here's my ${K.lang==='sql'?'SQL':K.lang==='javascript'?'JavaScript':K.lang==='html'?'HTML/CSS':'Python'}:\n\`\`\`${K.lang}\n${code}\n\`\`\``+(WS.out?`\n\nOutput:\n${WS.out.split('\n').slice(0,5).join('\n')}${WS.out.split('\n').length>5?'\n…':''}`:'');
  const model=`Here is my ${K.label.replace(' editor','')} code (line numbers on the left are not part of the code):\n${numbered}`+(WS.out?`\n\nWhen I ran it:\n${WS.out}`:'\n\n(I have not run it yet.)')+'\n\nReview it.';
  wsClearFlags();sendCoach(model,show);
}
function wsRulesFor(t){
  const kind=wsKindOf(t);if(!kind)return '';
  const K=WS_KINDS[kind];
  return `\n\nHe has a ${K.label} open beside this chat${kind==='sql'?` connected to a SQLite sample airline database. Write practice problems against these tables only:\n${AIR_SCHEMA}`:kind==='python'?` that runs Python in the browser with flights.csv, airports.csv, airlines.csv and bookings.csv in the working folder (same columns as the airline database: ${Object.entries(AIR.tables).map(([n,t])=>`${n}: ${t.cols.map(c=>c.split(' ')[0]).join(', ')}`).join('; ')}). pandas may not be available, so prefer the csv module unless the skill is about pandas`:kind==='js'?' that runs plain JavaScript and shows console.log output (no Node modules)':' with a live preview'}.\nWhen you give him a problem, have him write the answer in the editor. When he sends code, review it like an interviewer would: say what works, point out bugs, edge cases and style issues, and ask him to fix them himself rather than rewriting it for him. If specific lines need attention, end your reply with one final line exactly like "LINES: 3, 7-9" using his line numbers. If you give starter code or a sample schema, put it in one fenced code block.`;
}
/* draggable divider: the chat stops at a usable width; the editor stops at its smallest useful width,
   and a further push tucks it away completely (bring it back with the panel button in the chat header) */
const WS_MIN=330,CHAT_MIN=360,SNAP=70;
let wsW=(()=>{try{return +SessionWorkspace.storage.getItem('sb.wsW')||0}catch(e){return 0}})(),wsGone=false; // the editor can be resized but never slid away
function wsApplyWidth(){
  const mid=$('work-mid');if(!mid.classList.contains('split'))return;
  mid.classList.toggle('ws-gone',wsGone);
  const total=mid.clientWidth;if(!total)return;
  let w=wsW||Math.round(total*.52);w=Math.max(WS_MIN,Math.min(total-CHAT_MIN-9,w));
  mid.style.setProperty('--wsw',w+'px');
  const btn=$('ws-open-btn');if(btn)btn.hidden=!wsGone;
}
function wsSetGone(g){
  wsGone=g;try{SessionWorkspace.storage.setItem('sb.wsGone',g?'1':'0')}catch(e){}
  const mid=$('work-mid');mid.classList.add('anim');wsApplyWidth();setTimeout(()=>{mid.classList.remove('anim');WS.ed&&WS.ed.refresh()},320);
  renderWsOpen();
}
function renderWsOpen(){
  const acts=document.querySelector('#focus .chat-actions');if(!acts)return;
  let b=$('ws-open-btn');
  if(!(WS.kind&&wsGone)||true){b&&b.remove();return}
  if(!b){b=document.createElement('button');b.type='button';b.id='ws-open-btn';b.className='ws-open';
    b.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 4v16" stroke="currentColor" stroke-width="2"/><path d="M17 9.5l-1.5 2.5 1.5 2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    b.onclick=()=>{const t=$('work-mid').clientWidth;if(wsW<t*.45)wsW=Math.round(t*.48);wsSetGone(false)}}
  b.title=b.ariaLabel=`Open the ${WS_KINDS[WS.kind].label}`;b.setAttribute('aria-label',b.title);
  acts.appendChild(b);
}
(function(){
  const sp=$('ws-split');let start=null;
  sp.addEventListener('pointerdown',e=>{if(e.button!==0)return;const mid=$('work-mid');
    start={x:e.clientX,w:$('ws').getBoundingClientRect().width,total:mid.clientWidth};sp.setPointerCapture(e.pointerId);sp.classList.add('drag');document.body.classList.add('ws-dragging')});
  sp.addEventListener('pointermove',e=>{if(!start)return;
    const want=start.w-(e.clientX-start.x),max=start.total-CHAT_MIN-9;
    const w=Math.max(WS_MIN,Math.min(max,want));
    wsW=w;$('work-mid').style.setProperty('--wsw',w+'px');WS.ed&&WS.ed.refresh()});
  const end=e=>{if(!start)return;start=null;sp.classList.remove('drag');document.body.classList.remove('ws-dragging');$('ws').style.opacity='';
    try{SessionWorkspace.storage.setItem('sb.wsW',String(wsW))}catch(_){}
    WS.ed&&WS.ed.refresh()};
  sp.addEventListener('pointerup',end);sp.addEventListener('pointercancel',end);
  sp.addEventListener('keydown',e=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();
    const mid=$('work-mid'),cur=$('ws').getBoundingClientRect().width,next=cur+(e.key==='ArrowLeft'?40:-40);
    wsW=Math.max(WS_MIN,Math.min(mid.clientWidth-CHAT_MIN-9,next));try{SessionWorkspace.storage.setItem('sb.wsW',String(wsW))}catch(_){}wsApplyWidth();WS.ed&&WS.ed.refresh()});
  window.addEventListener('resize',()=>wsApplyWidth());
})();
(function(){
  const hs=$('ws-hsplit'),ED_MIN=110,OUT_MIN=70;let st=null;
  const apply=h=>{const ws=$('ws'),avail=$('ws-ed').getBoundingClientRect().height+$('ws-out').getBoundingClientRect().height;
    h=Math.max(OUT_MIN,Math.min(avail-ED_MIN,h));ws.style.setProperty('--wsout',h+'px');WS.ed&&WS.ed.refresh();return h};
  try{const h=+SessionWorkspace.storage.getItem('sb.wsOutH');if(h)$('ws').style.setProperty('--wsout',h+'px')}catch(e){}
  hs.addEventListener('pointerdown',e=>{if(e.button!==0)return;st={y:e.clientY,h:$('ws-out').getBoundingClientRect().height};hs.setPointerCapture(e.pointerId);document.body.classList.add('ws-vdrag')});
  hs.addEventListener('pointermove',e=>{if(st)st.last=apply(st.h-(e.clientY-st.y))});
  const end=()=>{if(!st)return;document.body.classList.remove('ws-vdrag');if(st.last)try{SessionWorkspace.storage.setItem('sb.wsOutH',String(Math.round(st.last)))}catch(e){}st=null};
  hs.addEventListener('pointerup',end);hs.addEventListener('pointercancel',end);
  hs.addEventListener('keydown',e=>{if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;e.preventDefault();const h=apply($('ws-out').getBoundingClientRect().height+(e.key==='ArrowUp'?30:-30));try{SessionWorkspace.storage.setItem('sb.wsOutH',String(Math.round(h)))}catch(_){}});
})();
$('ws-run').onclick=wsRun;
$('ws-send').onclick=wsSend;
$('ws-reset').onclick=()=>{if(!WS.ed)return;WS.ed.set(WS_KINDS[WS.kind].starter);wsSave();wsClearFlags()};
/* ERD of the airline sample database (crow's foot: bar = one, fork = many) */
const ERD={W:200,H:26,R:20,
  boxes:{bookings:[20,24],airlines:[20,190],flights:[300,24],airports:[580,84],aircraft:[580,214]},
  rels:[['flights','airline','airlines','code',272],['bookings','flight_id','flights','flight_id',248],['flights','origin','airports','code',540],['flights','dest','airports','code',540],['flights','tail_number','aircraft','tail_number',540]]}; // last value = the lane each connector runs in
function erdSvg(){
  const {W,H,R,boxes,rels}=ERD,fk={};rels.forEach(([t,c])=>fk[t+'.'+c]=1);
  const cols=n=>AIR.tables[n].cols.map(c=>{const [nm,...ty]=c.split(' ');return {nm,ty:ty.join(' ').replace(' PRIMARY KEY','').toLowerCase(),pk:/PRIMARY KEY/.test(c)}});
  const rowY=(n,c)=>boxes[n][1]+H+cols(n).findIndex(x=>x.nm===c)*R+R/2;
  let g='',lines='';
  for(const [n,[x,y]] of Object.entries(boxes)){
    const cs=cols(n),h=H+cs.length*R;
    g+=`<g><rect x="${x}" y="${y}" width="${W}" height="${h}" rx="8" fill="#fff" stroke="#9FB8D2"/><path d="M${x} ${y+8}a8 8 0 0 1 8-8h${W-16}a8 8 0 0 1 8 8v${H-8}h-${W}z" fill="#2569C9"/>
      <text x="${x+10}" y="${y+17}" fill="#fff" font-weight="700" font-size="12.5">${n}</text><text x="${x+W-10}" y="${y+17}" fill="#D6E6FA" font-size="10.5" text-anchor="end">${AIR.tables[n].rows.length} rows</text>`+
      cs.map((c,i)=>{const ry=y+H+i*R,isfk=fk[n+'.'+c.nm];return `${i?`<line x1="${x}" x2="${x+W}" y1="${ry}" y2="${ry}" stroke="#E3ECF5"/>`:''}
        <text x="${x+10}" y="${ry+14}" font-size="11.5" fill="#13304D" font-weight="${c.pk?700:400}">${c.nm}</text>
        <text x="${x+W-10}" y="${ry+14}" font-size="10" text-anchor="end" fill="${c.pk?'#B4520A':isfk?'#2569C9':'#7D8E9E'}" font-weight="${c.pk||isfk?700:400}">${c.pk?'PK':isfk?'FK':''}${c.pk||isfk?' · ':''}${c.ty}</text>`}).join('')+`</g>`;
  }
  const off={};
  rels.forEach(([ft,fc,pt,pc,lane])=>{
    const fy=rowY(ft,fc),py0=rowY(pt,pc),k=pt+pc;off[k]=(off[k]||0)+1;const n=rels.filter(r=>r[2]+r[3]===k).length,py=py0+(n>1?(off[k]-1)*8-4:0);
    const fx0=boxes[ft][0],px0=boxes[pt][0],leftOfPk=fx0<px0;
    const fx=leftOfPk?fx0+W:fx0,px=leftOfPk?px0:px0+W,dir=leftOfPk?1:-1,mx=lane;
    lines+=`<path d="M${fx} ${fy}H${mx}V${py}H${px}" fill="none" stroke="#5E7FA3" stroke-width="1.4"/>`;
    // many (crow's foot) at the FK end, one (double bar) at the PK end
    lines+=`<path d="M${fx+dir*12} ${fy}L${fx} ${fy-6}M${fx+dir*12} ${fy}L${fx} ${fy+6}M${fx+dir*12} ${fy}L${fx} ${fy}" stroke="#5E7FA3" stroke-width="1.4" fill="none"/>`;
    lines+=`<path d="M${px-dir*7} ${py-6}V${py+6}M${px-dir*11} ${py-6}V${py+6}" stroke="#5E7FA3" stroke-width="1.4"/>`;
  });
  const maxY=Math.max(...Object.entries(boxes).map(([n,[x,y]])=>y+H+cols(n).length*R))+16;
  return `<svg class="erd" viewBox="0 0 800 ${maxY}" width="800" height="${maxY}" role="img" aria-label="Diagram of the airline database: flights links to airlines, aircraft and airports (origin and destination); bookings links to flights" font-family="ui-monospace,SFMono-Regular,Menlo,monospace">${lines}${g}</svg>`;
}
$('ws-tables').onclick=()=>{
  $('ws-out').innerHTML=`<div class="ws-meta" style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span>Airline sample database · each line runs from a foreign key (fork = many) to the key it points at (bar = one)</span><button type="button" class="btn ghost" id="erd-big" style="padding:3px 10px;font-size:12px;flex:none">Open larger</button></div><div class="erd-wrap">${erdSvg()}</div>`;
  $('erd-big').onclick=()=>{$('erd-dlg-body').innerHTML=erdSvg();$('erd-dlg').showModal()};
};
$('ws-flagnote').onclick=()=>{if(WS.flags.length)WS.ed.flag(WS.flags)};


/* ---------- wrap up ---------- */
function touched(){
  if(!current)return [];const start=new Date(current.startedAt).getTime();
  return tasks.filter(t=>(current.timeOn[t.id]||0)>=60000||(current.practiced||[]).includes(t.id)||(t.status==='done'&&t.doneAt&&new Date(t.doneAt).getTime()>=start)).sort((x,y)=>CATS.indexOf(typeOf(x))-CATS.indexOf(typeOf(y)));
}
/* skills to teach back: only main skills (SQL, AWS…), each checked once in a short chat with AI coach */
let wrapCtl=null,extracting=false,wrapBusy=false;
function wrapState(){
  const list=touched();current.wrap=current.wrap||{};const W=current.wrap;
  if(W.v!==2){W.v=2;W.ms={};W.sel=null;W.extracted=false}
  list.forEach(t=>{const n=mainSkillName(t);if(n){const m=W.ms[n]||(W.ms[n]={s:'todo',turns:[],from:[]});if(!m.from.includes(t.id))m.from.push(t.id)}});
  if(!W.sel||!W.ms[W.sel])W.sel=Object.keys(W.ms)[0]||null;
  return W;
}
async function extractSkills(){
  const W=current.wrap,list=touched().filter(t=>!isSkill(t)),names=tasks.filter(isSkill).map(t=>t.title);
  if(W.extracted||extracting)return;if(!sample||!list.length||!names.length){W.extracted=true;return}
  extracting=true;renderWrap();
  const lines=list.map(t=>{const turns=(coachTurns[chatKey(t)]||current.skillChats?.[t.id]?.turns||[]).slice(-6).map(x=>`${x.role==='user'?'Tanner':'AI coach'}: ${x.content.slice(0,300)}`).join('\n');
    return `id ${t.id} | ${TYPES[typeOf(t)].label} | ${t.title}${t.course?` | ${t.course}`:''}${t.goal?` | goal: explain ${t.goal}`:''}${turns?`\nChat during the session:\n${turns}`:''}`}).join('\n\n');
  const prompt=`Tanner just finished a work session. His skill list is exactly: ${names.map(n=>`"${n}"`).join(', ')}.\nFor each item below, pick which of those skills he actually used or practiced in it (0 to 3, only names from the list, spelled exactly). Pick none if no skill on the list really applies.\n\n${lines}\n\nReply with only a JSON object mapping each id to an array of skill names.`;
  try{
    const {text}=await sample(prompt,{cache:true});
    const obj=JSON.parse(text.slice(text.indexOf('{'),text.lastIndexOf('}')+1));
    for(const id in obj){if(!Array.isArray(obj[id]))continue;
      obj[id].map(String).filter(n=>names.includes(n)).slice(0,3).forEach(n=>{const m=W.ms[n]||(W.ms[n]={s:'todo',turns:[],from:[]});if(!m.from.includes(id))m.from.push(id)})}
    W.extracted=true;if(!W.sel)W.sel=Object.keys(W.ms)[0]||null;saveState();
  }catch(e){W.extracted=e.code!=='rate_limited'&&e.code!=='network'?true:false}
  finally{extracting=false;renderWrap()}
}
function renderWrap(){
  const list=touched(),W=wrapState(),names=Object.keys(W.ms);
  const nSk=k=>names.filter(n=>W.ms[n].from.some(id=>{const t=T(id);return t&&typeOf(t)===k})).length;
  $('wrap-summary').innerHTML=`<div class="wrap-tot">${CATS.map(k=>{const n=nSk(k);return `<div><span>${icon(k)} ${MOODS[k].label}</span><b>${fmtMin(spentIn(k))}</b><small class="wt-sk">${n} skill${n===1?'':'s'}</small></div>`}).join('')}</div>`+
    (extracting?`<div class="wrap-prog" style="margin-top:12px">Finding the skills you used…</div>`:'')+
    (names.length?`<div class="wrap-skills">`+names.map(n=>{const m=W.ms[n],from=m.from.map(id=>T(id)).filter(t=>t&&!(isSkill(t)&&mainSkillName(t)===n&&t.title===n)).map(t=>t.title);
      const mins=m.from.reduce((s,id)=>s+(current.timeOn[id]||0),0)/60000;
      return `<button class="skill-btn" data-n="${esc(n)}" data-s="${m.s}" aria-current="${W.sel===n}"><span class="sk-dot" aria-hidden="true">${m.s==='solid'?'✓':m.s==='review'?'↺':''}</span><span class="sk-txt"><b>${esc(n)}</b>${from.length?`<small>${esc(from.join(' · '))}</small>`:''}</span><span class="wt-m">${mins>=1?fmtMin(mins):''}</span></button>`}).join('')+`</div>`
    :(list.length&&!extracting?'<p class="muted" style="margin:12px 0 0">No skills from your list came up this session.</p>':!list.length?'<p class="muted" style="margin:12px 0 0">Nothing logged yet.</p>':''));
  $('wrap-summary').querySelectorAll('.skill-btn').forEach(b=>b.onclick=()=>{W.sel=b.dataset.n;saveState();renderWrap()});
  $('conf').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.c===confidence)));
  renderWrapChat();
  if(!W.extracted&&!extracting)extractSkills();
}
function curSkill(){const W=current?.wrap;if(!W||!W.sel||!W.ms?.[W.sel])return {};return {n:W.sel,sk:W.ms[W.sel],from:W.ms[W.sel].from.map(id=>T(id)).filter(Boolean)}}
function nextSkill(){
  const W=current.wrap,names=Object.keys(W.ms||{}),at=names.indexOf(W.sel);
  return [...names.slice(at+1),...names.slice(0,Math.max(0,at))].find(n=>W.ms[n].s==='todo')||null;
}
let wrapRenderedKey='';
function renderWrapChat(){
  const {n,sk,from}=curSkill();
  $('wc-acts-slot').innerHTML='';$('wc-head').hidden=!sk;
  if(!sk){$('wc-head').innerHTML='';$('wc-log').innerHTML=extracting?`<div class="msg ai"><div class="ai-name">${CLAUDE_MARK} AI coach</div>Looking through what you worked on to find the skills you used…</div>`:'<div class="msg ai intro muted">Nothing to check from this session. You can still save it to your log.</div>';$('wc-form').hidden=true;return}
  $('wc-form').hidden=false;
  if(!wrapBusy)$('wc-send').disabled=false;
  const key=n+':'+sk.turns.length;
  if(wrapBusy&&key===wrapRenderedKey)return;
  wrapRenderedKey=key;
  const used=from.filter(t=>t.title!==n).map(t=>t.title);
  const intro=sample?'':`<div class="msg ai intro"><div class="ai-name">${CLAUDE_MARK} AI coach</div>Explain what you did with <b>${esc(n)}</b> this session${used.length?` (${esc(used.join(', '))})`:''}, the way you would to an interviewer: what you used, why, and what you'd do differently.<br><br><span class="muted">AI coaching is optional. See Settings → AI Connections for connection status. What you write is still saved with this session.</span></div>`;
  $('wc-log').innerHTML=intro+sk.turns.map(x=>x.role==='user'?`<div class="msg me">${esc(x.content)}</div>`:`<div class="msg ai"><div class="ai-name">${CLAUDE_MARK} AI coach</div>${esc(x.content)}</div>`).join('');
  $('wc-log').scrollTop=$('wc-log').scrollHeight;
  if(sample&&!sk.turns.length&&!wrapBusy)askSkill('');
}
async function askSkill(text){
  const {n,sk,from}=curSkill();if(!sk)return;text=(text||'').trim();
  if(text){sk.turns.push({role:'user',content:text});$('wc-input').value='';$('wc-input').style.height='auto';saveState()}
  if(!sample){renderWrapChat();return}
  wrapCtl?.abort();const ctl=wrapCtl=new AbortController();
  wrapBusy=true;wrapRenderedKey='';renderWrapChat();
  const el=document.createElement('div');el.className='msg ai';el.innerHTML=`<div class="ai-name">${CLAUDE_MARK} AI coach</div><span>Thinking…</span>`;$('wc-log').appendChild(el);const span=el.lastChild;$('wc-send').disabled=true;
  const answers=sk.turns.filter(x=>x.role==='user').length;
  const work=from.map(t=>{const turns=(coachTurns[chatKey(t)]||current.skillChats?.[t.id]?.turns||[]).slice(-6).map(x=>`  ${x.role==='user'?'Tanner':'AI coach'}: ${String(x.show||x.content).slice(0,240)}`).join('\n');return `- ${t.title} (${TYPES[typeOf(t)].label}${t.course?`, ${t.course}`:''})${turns?`\n${turns}`:''}`}).join('\n');
  const rules=`You are checking whether Tanner, a BYU Information Systems student preparing for a data analyst co-op interview, can teach back one skill from the work session he just finished. He learns by explaining things back.\nSkill: ${n}\nWhere he used it this session:\n${work||'- (no details)'}\n\nKeep it a quick conversation: no more than 3 questions in total. Start by asking him to explain what he did with ${n} this session in his own words, tied to the concrete work above. After each answer, say briefly what was right, correct anything wrong or vague directly, then ask one sharper follow-up like an interviewer would, about a specific concept within ${n} that came up. Once he has shown he understands it, or after his third answer, finish with a one-sentence takeaway and put exactly "VERDICT: solid" or "VERDICT: review" on the last line. Never answer your own question for him. Plain text, under 90 words per reply.${answers>=3?'\n\nHe has answered three times. Wrap up now with the takeaway and the verdict line.':''}`;
  try{
    const {text:out}=await sample([{role:'user',content:rules},...sk.turns.slice(-10)],{cache:false,signal:ctl.signal,onText:({text})=>{span.textContent=text.replace(/\n?\s*VERDICT:\s*\w*\s*$/i,'');$('wc-log').scrollTop=$('wc-log').scrollHeight}});
    const m=out.match(/VERDICT:\s*(solid|review)/i);
    sk.turns.push({role:'assistant',content:out.replace(/\n?\s*VERDICT:\s*\w+\s*$/i,'').trim()});
    if(m&&sk.s==='todo')sk.s=m[1].toLowerCase();
    saveState();
  }catch(e){
    if(e.code==='cancelled')return;
    span.textContent=['not_granted','sampling_disabled','not_declared','capability_disabled','capability_removed'].includes(e.code)?'AI coach isn\'t available on this board right now.':e.code==='rate_limited'?'Too many requests. Wait a bit and try again.':'That didn\'t go through. Try again.';
    if(text)sk.turns.pop();
  }finally{if(wrapCtl===ctl){wrapBusy=false;$('wc-send').disabled=false;wrapRenderedKey='';renderWrap()}}
}
$('wc-form').onsubmit=e=>{e.preventDefault();askSkill($('wc-input').value)};
$('wc-input').addEventListener('input',e=>{const t=e.target;t.style.height='auto';t.style.height=Math.min(140,t.scrollHeight)+'px'});
$('wc-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();askSkill($('wc-input').value)}});
function wrapRecap(){
  const W=current?.wrap;if(!W||!W.ms)return {recap:'',feedback:'',skills:[]};
  const rows=Object.keys(W.ms).map(n=>{const m=W.ms[n];return {n,s:m.s,turns:m.turns,from:m.from.map(id=>T(id)?.title).filter(x=>x&&x!==n)}});
  const lab={solid:'solid',review:'review later',todo:'not checked'};
  return {skills:rows.map(r=>({skill:r.n,status:r.s,from:r.from,said:r.turns.filter(x=>x.role==='user').map(x=>x.content),turns:r.turns})),
    recap:rows.map(r=>{const mine=r.turns.filter(x=>x.role==='user').map(x=>'  '+x.content).join('\n');return `${r.n} (${lab[r.s]})${r.from.length?`, from ${r.from.join(', ')}`:''}${mine?'\n'+mine:''}`}).join('\n\n'),
    feedback:rows.filter(r=>r.turns.length).map(r=>`${r.n}\n`+r.turns.map(x=>`${x.role==='user'?'You':'AI coach'}: ${x.content}`).join('\n')).join('\n\n')};
}
$('w-end').onclick=()=>{accumulate();saveState();wrapping=true;renderWork();window.scrollTo({top:0})};
$('back-to-work').onclick=()=>{wrapCtl?.abort();wrapBusy=false;current.activeSince=Date.now();current.tbStarted=null;wrapping=false;saveState();renderWork()};
$('conf').querySelectorAll('button').forEach(b=>b.onclick=()=>{confidence=+b.dataset.c;renderWrap()});
$('finish-btn').onclick=async()=>{
  if(!current)return;
  const list=touched(),byTrack={class:0,skill:0,project:0};
  const rc=wrapRecap();
  let total=0;for(const id in current.timeOn){const t=T(id);const m=current.timeOn[id]/60000;total+=m;if(t)byTrack[typeOf(t)]+=m}
  for(const k in byTrack)byTrack[k]=Math.round(byTrack[k]);
  const dom=Object.keys(byTrack).sort((a,b)=>byTrack[b]-byTrack[a])[0];
  await guard(async()=>{
    const live=touched().filter(t=>isSkill(t)&&coachTurns[t.id]?.length&&!current.skillChats?.[t.id]);live.forEach(t=>saveSkillChat(t.id));
    await db.collection('sessions').add({date:new Date().toISOString(),minutes:Math.round(total),byTrack,track:dom,skillChats:current.skillChats||{},
      tasks:list.map(t=>({id:t.id,title:t.title,done:isDoneNow(t)})),recap:rc.recap,feedback:rc.feedback,skills:rc.skills,confidence});
    await db.doc('state/current').delete();
  },'Saved to your learning log');
  current=null;wrapping=false;feedbackText='';confidence=0;
  draft.manualAlloc=false;draft.end=defaultEnd();saveDraft();go('plan');
};
$('discard-btn').onclick=async e=>{
  $('discard-dlg').showModal();
};
$('dd-cancel').onclick=()=>$('discard-dlg').close();
// Finish: one prompt that says how many skills are still untaught, then save or discard (discard asks again)
$('wrap-finish').onclick=()=>{
  if(!current)return;const W=current.wrap||{},all=Object.values(W.ms||{});
  const left=all.filter(sk=>!(sk.turns||[]).some(x=>x.role==='user')).length,n=all.length,s=k=>k===1?'':'s';
  $('fd-msg').innerHTML=!n?'There were no skills to teach back this session.'
    :left?`You still have <b>${left}</b> of ${n} skill${s(n)} you haven't taught back yet. You can keep going and explain ${left===1?'it':'them'}, or finish now.`
    :`You taught back all ${n} skill${s(n)} from this session.`;
  $('finish-dlg').showModal();
};
$('fd-cancel').onclick=()=>$('finish-dlg').close();
$('fd-save').onclick=()=>{$('finish-dlg').close();$('finish-btn').click()};
$('fd-discard').onclick=()=>{$('finish-dlg').close();$('discard-dlg').showModal()};
$('discard-dlg').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close()});
$('dd-ok').onclick=async()=>{
  $('discard-dlg').close();
  await guard(()=>db.doc('state/current').delete(),'Session discarded');current=null;wrapping=false;go('plan');
};

/* ---------- log ---------- */
function recentByType(){
  const cut=Date.now()-14*864e5,out={class:0,skill:0,project:0};
  for(const s of sessions){if(new Date(s.date).getTime()<cut)continue;for(const k in (s.byTrack||{})){const c=mapOldCat(k);if(out[c]!=null)out[c]+=s.byTrack[k]}}
  return out;
}
// every time a main skill came up: teach-backs after sessions and practice chats during them
function skillHistory(){
  const H={},add=(n,e)=>{if(!n)return;(H[n]=H[n]||[]).push(e)};
  for(const s of sessions){
    const date=s.date;
    (s.skills||[]).forEach(k=>{
      if(k.said||k.from){add(k.skill,{date,kind:'Teach-back',status:k.status,said:k.said||[],turns:k.turns||[],from:k.from||[]})}
      else{const t=tasks.concat(archived).find(x=>x.title===k.task);const n=mainSkillName(t);if(n)add(n,{date,kind:'Teach-back',status:k.status,said:[],turns:[],from:[k.task],topic:k.skill})}
    });
    for(const id in (s.skillChats||{})){const c=s.skillChats[id];const n=c.main||mainSkillName(T(id));
      add(n,{date:c.at||date,kind:'Practice chat',said:(c.turns||[]).filter(x=>x.role==='user').map(x=>x.content),turns:c.turns||[],from:c.title&&c.title!==n?[c.title]:[]})}
  }
  for(const n in H)H[n].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  return H;
}
function renderLogSkills(){
  const box=$('log-skills');if(!box)return;
  if(!loaded.sessions){box.innerHTML='';return}
  const H=skillHistory(),mains=tasks.filter(isSkill).sort((a,b)=>skillLevel(b)-skillLevel(a)||a.title.localeCompare(b.title));
  const names=[...mains.map(t=>t.title),...Object.keys(H).filter(n=>!mains.some(t=>t.title===n))];
  const lab={solid:'✓ Solid',review:'↺ Review',todo:'Not checked'};
  const fmtD=d=>new Date(d).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  box.innerHTML=`<h2 class="log-h">Skills</h2><div class="ls-list">`+names.map(n=>{const t=mainSkillTask(n),E=H[n]||[];
    return `<details class="ls"><summary><b>${esc(n)}</b><span class="ls-m">${t?`${LVL_TAG(skillLevel(t))} · `:''}${E.length?`${E.length} time${E.length===1?'':'s'} · last ${fmtD(E[0].date)}`:'not talked about yet'}</span></summary>`+
      (E.length?E.map(e=>`<div class="ls-e"><div class="ls-h">${fmtD(e.date)} · ${e.kind}${e.status?` · ${lab[e.status]||e.status}`:''}${e.from.length?` · ${esc(e.from.join(', '))}`:''}</div>${e.topic?`<div class="small muted">${esc(e.topic)}</div>`:''}${e.said.length?e.said.map(x=>`<p class="ls-said">${esc(x)}</p>`).join(''):'<div class="small muted">Nothing written.</div>'}${e.turns.length?`<details class="ls-full"><summary>Full conversation</summary><div class="feedback">${e.turns.map(x=>`${x.role==='user'?'You':'AI coach'}: ${esc(x.content||x.show||'')}`).join('\n\n')}</div></details>`:''}</div>`).join('')
        :'<div class="small muted ls-e">Once you teach this back after a session or practice it in a chat, what you said shows up here.</div>')+`</details>`}).join('')+`</div>`;
}
function renderLog(){
  renderLogSkills();
  const m=recentByType(),tot=Object.values(m).reduce((a,b)=>a+b,0);
  $('bal').innerHTML=CATS.map(k=>{const p=tot?m[k]/tot:0;return `<div style="display:flex;flex-direction:column;gap:4px"><div class="bal-top"><span>${TYPES[k].label}</span><span>${fmtMin(m[k])} · ${Math.round(p*100)}%</span></div><div class="hbar"><i style="width:${Math.min(100,p*100)}%;background:${COLOR[k]}"></i></div></div>`}).join('');
  if(!loaded.sessions){$('log').innerHTML='<div class="muted small">Loading…</div>';return}
  $('log').innerHTML=sessions.length?sessions.map(s=>{
    const d=new Date(s.date).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
    const bt={};for(const k in (s.byTrack||{})){const c=mapOldCat(k);bt[c]=(bt[c]||0)+s.byTrack[k]}
    const moods=CATS.filter(k=>bt[k]>0).map(k=>` · ${fmtMin(bt[k])} ${MOODS[k].label.toLowerCase()}`).join('');
    return `<div class="entry"><span class="due">${esc(d)} · ${fmtMin(s.minutes)}${moods}${s.confidence?` · confidence ${s.confidence}/5`:''}</span>
      <div style="font-weight:600">${esc((s.tasks||[]).map(t=>t.title).join(' · ')||'Session')}</div>
      ${s.recap?`<div class="recap-text">${esc(s.recap)}</div>`:'<div class="muted small">No teach-back written.</div>'}
      ${s.feedback?`<details><summary>Skill checks with AI coach</summary><div class="feedback" style="margin-top:6px">${esc(s.feedback)}</div></details>`:''}
      ${s.skillChats&&Object.keys(s.skillChats).length?`<details><summary>Skill practice chats (${Object.keys(s.skillChats).length})</summary>${Object.values(s.skillChats).map(c=>`<div class="feedback" style="margin-top:6px"><b>${esc(c.title)}</b>\n${c.turns.map(x=>`${x.role==='user'?'You':'AI coach'}: ${esc(x.content)}`).join('\n\n')}</div>`).join('')}</details>`:''}</div>`;
  }).join(''):'<p class="muted" style="margin:0">Your first teach-back shows up here after you finish a session.</p>';
}

/* ---------- misc ---------- */
async function guard(fn,ok){
  if(!db){toast('Saving is unavailable in this view.');return}
  try{await fn();if(ok)toast(ok)}catch(e){toast(e?.code==='invalid_argument'?'You can view this board but not change it.':'Couldn\'t save. Try again in a moment.')}
}
function closeDrawers(){['add-drawer','music-drawer'].forEach(d=>$(d).classList.remove('open'));$('backdrop').hidden=true}
function openDrawer(id){closeDrawers();$(id).classList.add('open');$('backdrop').hidden=false;
  if(id==='music-drawer'){CATS.forEach(k=>$('m-'+k).value=playlistUrl(k));$('m-auto').checked=settings.autoOpen!==false}
  if(id==='add-drawer'){$('f-track').value=tabs.left;syncAddForm()}
  setTimeout(()=>$(id).querySelector('select,input')?.focus(),30)}
$('backdrop').onclick=closeDrawers;
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeDrawers);
$('view-log').addEventListener('click',e=>{if(e.target===$('view-log'))go('plan')});
window.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(document.activeElement&&document.activeElement.id==='timer-in')return;if(!$('backdrop').hidden)closeDrawers();else if(view==='log')go('plan')});
$('open-add').onclick=()=>openDrawer('add-drawer');
$('open-music').onclick=()=>openDrawer('music-drawer');
$('go-log').onclick=()=>go('log');$('log-back').onclick=()=>go('plan');
function syncAddForm(){const v=$('f-track').value;document.querySelectorAll('[data-class-only]').forEach(el=>el.hidden=v!=='class');document.querySelectorAll('[data-skill-only]').forEach(el=>el.hidden=v!=='skill')}
$('f-track').onchange=syncAddForm;
$('add-form').onsubmit=async e=>{
  e.preventDefault();const pick=$('f-track').value,title=$('f-title').value.trim();if(!title)return;
  const level=+$('f-level').value||1,track=pick==='skill'?(level>=3?'practice':'develop'):pick;
  const order=Math.max(0,...tasks.filter(t=>typeOf(t)===pick).map(t=>t.order||0))+1;
  const doc={track,title,course:$('f-course').value.trim(),goal:$('f-goal').value.trim(),status:'todo',order};
  if(pick==='skill')doc.level=level;
  if(track==='class'){doc.due=$('f-due').value||null;if(doc.due)doc.dueTime=$('f-time').value||'23:59';const lead=$('f-lead').value;if(lead!==''&&+lead!==1)doc.leadDays=+lead}
  if(String(doc.course).toLowerCase()==='airline pipeline')doc.phase='Other';
  await guard(()=>db.collection('tasks').add(doc),'Added');
  $('f-title').value='';$('f-goal').value='';$('f-due').value='';
};
$('music-form').onsubmit=async e=>{
  e.preventDefault();const u={};CATS.forEach(k=>u[k]=$('m-'+k).value.trim());
  const ok=x=>!x||/^https:\/\//i.test(x);if(!CATS.every(k=>ok(u[k]))){toast('Use the full https:// link from Share → Copy Link.');return}
  await guard(()=>db.doc('settings/main').set({classUrl:u.class,skillUrl:u.skill,projectUrl:u.project,autoOpen:$('m-auto').checked}),'Playlists saved');closeDrawers();
};
$('end-time').addEventListener('change',()=>{const v=$('end-time').value;if(!v)return;draft.end=v;saveDraft();renderPlan()});
$('reset-plan').onclick=()=>{draft.manualAlloc=false;draft.order=setSeq(DEFAULT_ORDER);saveDraft();renderPlan()};
function renderLvlSort(){const b=$('lvl-sort'),up=lvlSort==='asc';b.innerHTML=`Level <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style="transform:rotate(${up?180:0}deg)"><path d="M12 20V5M5.5 11.5L12 5l6.5 6.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;b.title=up?'Lowest level first. Click for highest first':'Highest level first. Click for lowest first';b.setAttribute('aria-label',`Sort skills by level, ${up?'low to high':'high to low'}`)}
renderLvlSort();
$('lvl-sort').onclick=()=>{lvlSort=lvlSort==='asc'?'desc':'asc';store('sb.lvlSort',lvlSort);renderLvlSort();refresh()};
$('left-toggle').querySelectorAll('button').forEach(b=>b.onclick=()=>{tabs.left=b.dataset.v;store('sb.tabs2',tabs);renderSide('left')});
$('start-btn').onclick=()=>startWorking(true);
$('begin-btn').onclick=()=>startWorking(false);

/* ---------- routing ---------- */
function go(v){const h=v==='plan'?'':v;if(location.hash.replace('#','')!==h)location.hash=h;else route()}
function route(){
  let v=location.hash.replace('#','')||'plan';
  if(v==='work'&&!current&&loaded.state)v='plan';
  if(!['plan','work','log'].includes(v))v='plan';
  view=v;document.body.dataset.view=v;
  $('view-plan').hidden=!(v==='plan'||v==='log');$('view-work').hidden=v!=='work';$('view-log').hidden=v!=='log';if(v!=='plan')closeDrawers();
  if(v==='work'){
    if(!current){document.body.dataset.mood='class';$('focus').innerHTML='<div class="muted">Loading your session…</div>';return}
    if(!warpActive&&!switching&&$('scene').dataset.pos!==current.mood)setScene(current.mood,false);
    sizeStars();renderWork();
  } else {delete document.body.dataset.mood;renderPlan();if(v==='log')renderLog();if(sky.mode!=='plan'&&sky.mode!=='warp')skyPlan()}
  if(v==='work'&&sky.mode==='plan')skyStop();
}
window.addEventListener('hashchange',route);

/* ---------- stars ---------- */
let starsDrawn='',starPts=[];
let warpStars=(()=>{try{return JSON.parse(SessionWorkspace.storage.getItem('sb.warpStars')||'[]')}catch(e){return []}})();
function sizeStars(force){
  const w=window.innerWidth,h=Math.round(window.innerHeight),vh=window.innerHeight;
  const key=w+'x'+h+':'+warpStars.length;if(!w||(!force&&starsDrawn===key))return;starsDrawn=key;starPts=[];
  const dpr=Math.min(2,window.devicePixelRatio||1);
  [['stars',1],['twinkle',0]].forEach(([id,base])=>{
    const c=$(id);c.width=w*dpr;c.height=h*dpr;const x=c.getContext('2d');x.scale(dpr,dpr);
    let seed=base?7:13;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
    // the top screen of sky is made of the stars you arrived with; the seeded field fills the rest below
    const startY=base&&warpStars.length?vh:0;
    const n=Math.round(w*(h-startY)/(base?2600:16000));
    for(let i=0;i<n;i++){const px=rnd()*w,py=startY+rnd()*(h-startY),r=base?(rnd()<.92?rnd()*.9+.25:rnd()*1.2+.9):rnd()*1.1+.8;
      const a=base?(.35+rnd()*.6)*(1-py/h*.5):.9;const col=base&&rnd()<.15?'200,215,255':'255,250,240';
      x.beginPath();x.arc(px,py,r,0,Math.PI*2);x.fillStyle=`rgba(${col},${a})`;x.fill();
      if(!base){const g=x.createRadialGradient(px,py,0,px,py,r*5);g.addColorStop(0,'rgba(200,215,255,.35)');g.addColorStop(1,'rgba(200,215,255,0)');x.fillStyle=g;x.beginPath();x.arc(px,py,r*5,0,Math.PI*2);x.fill()}}
    if(base){
      for(const st of warpStars){const px=st.fx*w,py=st.fy*vh;x.globalAlpha=st.a;x.fillStyle=`rgb(${st.col})`;x.beginPath();x.arc(px,py,st.r,0,Math.PI*2);x.fill()}
      x.globalAlpha=1;
      const g=x.createLinearGradient(0,h*.15,w,h*.55);g.addColorStop(0,'rgba(140,150,255,0)');g.addColorStop(.5,'rgba(160,140,255,.07)');g.addColorStop(1,'rgba(140,150,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h)}
  });
}

/* ---------- sky: one canvas for the plan rain, the lightspeed jump, and the landing on the star field ---------- */
const sky={mode:'idle',parts:[],raf:0,last:0,W:0,H:0,ctx:null};
function skySize(){const cv=$('warp'),dpr=Math.min(2,window.devicePixelRatio||1);sky.W=window.innerWidth;sky.H=window.innerHeight;cv.width=sky.W*dpr;cv.height=sky.H*dpr;sky.ctx=cv.getContext('2d');sky.ctx.setTransform(dpr,0,0,dpr,0,0)}
// rain on the planning board: thin drops at three depths, falling at a slight slant
const RAIN={slant:.16};
function newDrop(first){
  const W=sky.W,H=sky.H,d=Math.random(),depth=d<.55?0:d<.88?1:2; // far, mid, near
  const sp=[.55,.9,1.35][depth]*(0.9+Math.random()*.25),len=[10,18,30][depth]*(0.8+Math.random()*.5);
  return {x:Math.random()*(W+H*RAIN.slant)-H*RAIN.slant*.5,y:first?Math.random()*H:-len-Math.random()*H*.3,ux:RAIN.slant,uy:1,speed:sp,len,w:[.7,1,1.4][depth],a:[.3,.45,.62][depth],plan:true};
}
function skyPlan(){
  if(reduce()){skyStop();return}
  skySize();sky.mode='plan';sky.splash=[];
  const n=Math.max(90,Math.min(320,Math.round(sky.W*sky.H/7000)));
  sky.parts=Array.from({length:n},()=>newDrop(true));skyRun();
}
function skyStop(){cancelAnimationFrame(sky.raf);sky.raf=0;sky.mode='idle';sky.ctx&&sky.ctx.clearRect(0,0,sky.W,sky.H)}
function skyRun(){if(sky.raf)return;sky.last=performance.now();const tick=ts=>{const dt=Math.min(50,ts-sky.last);sky.last=ts;skyFrame(dt,ts);if(sky.mode!=='idle')sky.raf=requestAnimationFrame(tick);else sky.raf=0};sky.raf=requestAnimationFrame(tick)}
function drawStreak(x,P){
  const tx=P.x-P.ux*P.len,ty=P.y-P.uy*P.len;
  x.strokeStyle=`rgba(200,210,224,${P.a})`;x.lineCap='round';x.globalAlpha=1;x.lineWidth=P.w;
  x.beginPath();x.moveTo(tx,ty);x.lineTo(P.x,P.y);x.stroke();
}
function skyFrame(dt,ts){
  const x=sky.ctx,W=sky.W,H=sky.H;if(!x)return;
  if(sky.mode==='plan'){
    x.clearRect(0,0,W,H);
    for(let i=0;i<sky.parts.length;i++){const P=sky.parts[i];
      P.x+=P.ux*P.speed*dt;P.y+=P.uy*P.speed*dt;
      if(P.y>H){if(P.w>=1&&Math.random()<.5)sky.splash.push({x:P.x,y:H-2-Math.random()*6,t:0,a:P.a});sky.parts[i]=newDrop(false);continue}
      drawStreak(x,P)}
    // tiny splashes where near drops hit the bottom edge
    x.lineWidth=1;
    sky.splash=sky.splash.filter(S=>{S.t+=dt;const k=S.t/380;if(k>=1)return false;
      x.strokeStyle=`rgba(200,210,224,${S.a*(1-k)})`;x.beginPath();x.ellipse(S.x,S.y,2+k*9,.8+k*2,0,0,Math.PI*2);x.stroke();return true});
    return;
  }
  if(sky.mode==='warp')warpFrame(dt,ts);
}

/* the jump: plan streaks fade away while lightspeed lines fade in, stretch to full speed, then shrink back into the stars you land on */
const WARP={T:3000,peak:.5,pop:.5,stop:.515,end:.545}; // no hold: the instant the lines reach full stretch, pop onto the star field
function warpFrame(dt,ts){
  const x=sky.ctx,W=sky.W,H=sky.H,cx=W/2,cy=H/2,R=Math.hypot(W,H)/2,w=sky.warp;
  const p=Math.min(1,(ts-w.t0)/WARP.T);
  x.clearRect(0,0,W,H);
  const bg=p<WARP.stop?1:Math.max(0,1-(p-WARP.stop)/(WARP.end-WARP.stop));
  x.globalAlpha=1;x.fillStyle=`rgba(0,0,0,${bg})`;x.fillRect(0,0,W,H);
  // 1. the planning streaks keep their course and fade out
  const planA=Math.max(0,1-p/.22);
  if(planA>0)for(const P of sky.parts){P.x+=P.ux*P.speed*dt;P.y+=P.uy*P.speed*dt;const a0=P.a;P.a=a0*planA;drawStreak(x,P);P.a=a0}
  // 2. lightspeed: speed ramps up, peaks, and drops back to zero
  const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  // ramp up, hold at full lightspeed, then pop out almost instantly
  const sp=p<WARP.peak?ease(p/WARP.peak):p<WARP.pop?1:p<WARP.stop?Math.pow(1-(p-WARP.pop)/(WARP.stop-WARP.pop),3):0;
  const fin=Math.min(1,p/.2);                    // lightspeed lines fade in as the streaks fade out
  const settle=p<WARP.pop?0:Math.min(1,(p-WARP.pop)/(WARP.stop-WARP.pop));
  const len=sp*R*.95;
  x.lineCap='round';
  for(const s of w.stars){
    const r1=s.r*(1+sp*.35),r0=Math.max(0,r1-len*(s.r/R)-1);
    const ca=Math.cos(s.a),sa=Math.sin(s.a),hx=cx+ca*r1,hy=cy+sa*r1;
    if(sp>.02){
      const g=x.createLinearGradient(cx+ca*r0,cy+sa*r0,hx,hy);
      const c=s.hue?'205,228,255':'120,170,255';
      const la=(.35+.65*Math.min(1,sp*1.4))*fin*(1-settle*.4);
      g.addColorStop(0,`rgba(${c},0)`);g.addColorStop(1,`rgba(${c},${la})`);
      x.strokeStyle=g;x.lineWidth=s.w*(1+sp*1.6);
      x.beginPath();x.moveTo(cx+ca*r0,cy+sa*r0);x.lineTo(hx+ca*.5,hy+sa*.5);x.stroke();
    }
    // the head becomes a star as you slow down
    if(settle>0||p<.25){
      const k=settle,rad=s.w*.6*(1-k)+s.sr*k,al=(p<.25?fin*.6:1)*((1-k)*.8+s.sa*k);
      const col=k>.5?s.col:(s.hue?'205,228,255':'150,190,255');
      x.globalAlpha=al;x.fillStyle=`rgb(${col})`;x.beginPath();x.arc(hx,hy,rad,0,Math.PI*2);x.fill();x.globalAlpha=1;
    }
  }
  // flash at the jump
  const fl=p<WARP.pop?Math.max(0,1-(WARP.pop-p)/.03):Math.max(0,1-(p-WARP.pop)/.045);
  if(fl>0){const rg=x.createRadialGradient(cx,cy,0,cx,cy,R);rg.addColorStop(0,`rgba(210,230,255,${.55*fl})`);rg.addColorStop(.4,`rgba(90,150,255,${.25*fl})`);rg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=rg;x.fillRect(0,0,W,H)}
  if(!w.fired&&p>=WARP.peak){w.fired=true;
    // the stars you land on become the work screen's sky
    warpStars=w.stars.map(s=>({fx:(cx+Math.cos(s.a)*s.r)/W,fy:(cy+Math.sin(s.a)*s.r)/H,r:s.sr,a:s.sa,col:s.col})).filter(s=>s.fx>=0&&s.fx<=1&&s.fy>=0&&s.fy<=1);
    try{SessionWorkspace.storage.setItem('sb.warpStars',JSON.stringify(warpStars.map(s=>({fx:+s.fx.toFixed(4),fy:+s.fy.toFixed(4),r:+s.r.toFixed(2),a:+s.a.toFixed(2),col:s.col}))))}catch(e){}
    w.onPeak&&w.onPeak();sizeStars(true);
  }
  if(p>=WARP.end){const done=w.resolve;sky.mode='idle';$('warp').classList.remove('on');x.clearRect(0,0,W,H);done&&done()}
}
function hyperspace(onPeak){
  return new Promise(resolve=>{
    if(sky.mode!=='plan'||!sky.ctx){skySize();sky.parts=[]}
    const W=sky.W,H=sky.H,R=Math.hypot(W,H)/2,N=Math.round(Math.min(900,W*H/1300));
    const stars=Array.from({length:N},()=>{const big=Math.random()<.08;return {a:Math.random()*Math.PI*2,r:Math.pow(Math.random(),.6)*R*1.05+4,hue:Math.random()<.25?1:0,w:Math.random()*1.2+.4,
      sr:big?Math.random()*1.1+.9:Math.random()*.85+.25,sa:.4+Math.random()*.6,col:Math.random()<.15?'200,215,255':'255,250,240'}});
    $('warp').classList.add('on');
    sky.warp={t0:performance.now(),stars,onPeak,resolve,fired:false};
    sky.mode='warp';skyRun();
  });
}
/* ================= original animated scenes for the channel cutscenes =================
   Each theme: {id, name, song (label only, music comes later), pal (ambient colors), init(W,H) -> state, draw(ctx,W,H,t,state)} */
const SC=(()=>{
  const mk=s=>()=>{s=(s*16807)%2147483647;return s/2147483647};
  const lerp=(a,b,k)=>a+(b-a)*k,TAU=Math.PI*2;
  const grad=(x,W,H,stops,y0=0,y1=H)=>{const g=x.createLinearGradient(0,y0,0,y1);stops.forEach(([o,c])=>g.addColorStop(o,c));x.fillStyle=g;x.fillRect(0,y0,W,y1-y0)};
  const glow=(x,cx,cy,r,col,a=1)=>{const g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');x.globalAlpha=a;x.fillStyle=g;x.fillRect(cx-r,cy-r,r*2,r*2);x.globalAlpha=1};
  const starsInit=(r,n)=>Array.from({length:n},()=>({x:r(),y:r(),s:r()*1.4+.3,p:r()*TAU,k:.5+r()*2}));
  const drawStars=(x,st,W,H,t,maxY=1,a=1)=>{for(const s of st){if(s.y>maxY)continue;x.globalAlpha=a*(.45+.55*Math.abs(Math.sin(t*s.k+s.p)));x.fillStyle='#fff';x.fillRect(s.x*W,s.y*H,s.s*W/900,s.s*W/900)}x.globalAlpha=1};
  const ridge=(x,W,H,base,amp,f,ph,col,seed=1)=>{x.fillStyle=col;x.beginPath();x.moveTo(0,H);for(let i=0;i<=60;i++){const u=i/60;const y=H*(base-amp*(.55*Math.sin(u*f*TAU+ph)+.3*Math.sin(u*f*2.7*TAU+ph*1.7+seed)+.15*Math.sin(u*f*6.1*TAU+seed)));x.lineTo(u*W,y)}x.lineTo(W,H);x.closePath();x.fill()};
  const rainInit=(r,n)=>Array.from({length:n},()=>({x:r(),y:r(),l:.02+r()*.04,v:.9+r()*.8}));
  const drawRain=(x,rn,W,H,t,col='rgba(200,215,235,.45)',slant=.12)=>{x.strokeStyle=col;x.lineWidth=Math.max(1,W/1200);x.beginPath();for(const d of rn){const y=((d.y+t*d.v*.9)%1.1)-.05,xx=((d.x+y*slant)%1)*W;x.moveTo(xx,y*H);x.lineTo(xx+d.l*slant*H,(y+d.l)*H)}x.stroke()};
  const puff=(x,cx,cy,s,col,shade)=>{const b=[[-.9,.15,.55],[-.4,-.15,.75],[.25,-.25,.85],[.85,.1,.6],[0,.2,.7]];if(shade){x.fillStyle=shade;b.forEach(([dx,dy,r])=>{x.beginPath();x.arc(cx+dx*s,cy+dy*s+s*.12,r*s,0,TAU);x.fill()})}x.fillStyle=col;b.forEach(([dx,dy,r])=>{x.beginPath();x.arc(cx+dx*s,cy+dy*s,r*s,0,TAU);x.fill()})};
  const windows=(x,bx,by,bw,bh,r,lit,col)=>{const cw=Math.max(3,bw/7),ch=Math.max(4,cw*1.3);for(let yy=by+ch;yy<by+bh-ch;yy+=ch*1.7)for(let xx=bx+cw*.8;xx<bx+bw-cw;xx+=cw*1.7){if(r()<lit){x.fillStyle=col;x.fillRect(xx,yy,cw,ch)}}};
  const fadeIn=(x,W,H,t,d=1.2)=>{if(t<d){x.fillStyle=`rgba(0,0,0,${1-t/d})`;x.fillRect(0,0,W,H)}};
  const vignette=(x,W,H,a=.45)=>{const g=x.createRadialGradient(W/2,H/2,Math.min(W,H)*.35,W/2,H/2,Math.max(W,H)*.75);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,`rgba(0,0,0,${a})`);x.fillStyle=g;x.fillRect(0,0,W,H)};
  return {mk,lerp,TAU,grad,glow,starsInit,drawStars,ridge,rainInit,drawRain,puff,windows,fadeIn,vignette};
})();

const THEMES={class:[],skill:[],project:[]};
const addTheme=(k,o)=>THEMES[k].push(o);

/* ===== CLASS · chill, relaxing, romance ===== */
addTheme('class',{id:'paris',name:'Paris at Night',song:'Ratatouille soundtrack',pal:['#141a3a','#2a1f45','#f2b36b','#5a4a9a','#ffd68a'],
  init(W,H){const r=SC.mk(11);return {st:SC.starsInit(r,140),roofs:Array.from({length:26},(_,i)=>({x:i/25,h:.12+r()*.1,w:.05+r()*.04,ch:r()<.6})),r}},
  draw(x,W,H,t,S){const {grad,glow,drawStars,TAU}=SC;const pan=t*W*.006;
    grad(x,W,H,[[0,'#0d1230'],[.55,'#2b2150'],[.8,'#57385e'],[1,'#1a1630']]);drawStars(x,S.st,W,H,t,.55);
    glow(x,W*.8,H*.17,H*.18,'rgba(255,240,210,.35)');x.fillStyle='#fff6e0';x.beginPath();x.arc(W*.8,H*.17,H*.045,0,TAU);x.fill();
    // the tower: a lattice silhouette with twinkling lights
    const tx=W*.42-pan*.4,base=H*.78,top=H*.12,tw=H*.26;x.save();x.strokeStyle='#1a1426';x.fillStyle='#1a1426';x.lineWidth=Math.max(1,W/700);
    x.beginPath();x.moveTo(tx-tw/2,base);x.quadraticCurveTo(tx-tw*.12,H*.5,tx-tw*.03,top);x.lineTo(tx+tw*.03,top);x.quadraticCurveTo(tx+tw*.12,H*.5,tx+tw/2,base);x.lineTo(tx+tw*.3,base);x.quadraticCurveTo(tx,H*.62,tx-tw*.3,base);x.closePath();x.fill();
    x.fillRect(tx-tw*.2,H*.6,tw*.4,H*.012);x.fillRect(tx-tw*.11,H*.42,tw*.22,H*.01);x.fillRect(tx-1,top-H*.04,2,H*.04);
    const sparkle=(t%6)<2.2;for(let i=0;i<70;i++){const u=i/70,yy=lerpY(u),half=(tw/2)*Math.pow(1-u,1.9)*(u<.02?1:1);const xx=tx+(i%2?1:-1)*half*((i*37)%10)/10;
      x.globalAlpha=sparkle?(Math.random()<.5?1:.15):.55;x.fillStyle=sparkle?'#fff':'#ffcf7a';x.fillRect(xx,yy,W/600,W/600)}x.globalAlpha=1;x.restore();
    function lerpY(u){return base-(base-top)*u}
    glow(x,tx,top+H*.02,H*.06,'rgba(255,220,150,.5)');
    // rooftops with chimneys and warm windows
    const r2=SC.mk(5);x.fillStyle='#120f1d';for(const rf of S.roofs){const bx=((rf.x*W*1.1-pan)%(W*1.1)+W*1.1)%(W*1.1)-W*.05,bw=rf.w*W,by=H*(1-rf.h)-H*.06;
      x.beginPath();x.moveTo(bx,H);x.lineTo(bx,by);x.lineTo(bx+bw*.15,by-H*.03);x.lineTo(bx+bw*.85,by-H*.03);x.lineTo(bx+bw,by);x.lineTo(bx+bw,H);x.fill();if(rf.ch)x.fillRect(bx+bw*.6,by-H*.06,bw*.09,H*.04);
      SC.windows(x,bx,by,bw,H-by-H*.06,r2,.35,'rgba(255,200,110,.85)');x.fillStyle='#120f1d'}
    // the river with light reflections
    grad(x,W,H,[[0,'#1b1838'],[1,'#0a0a18']],H*.9,H);x.fillStyle='#0d0c1c';x.fillRect(0,H*.9,W,H*.1);
    for(let i=0;i<40;i++){const xx=(i/40)*W+Math.sin(t*2+i)*W*.004;x.fillStyle=`rgba(255,200,120,${.25+.2*Math.sin(t*3+i*1.7)})`;x.fillRect(xx,H*(.92+(i%5)*.015),W*.02,H*.003)}
    SC.vignette(x,W,H);SC.fadeIn(x,W,H,t)}});

addTheme('class',{id:'rainstreet',name:'Rainy City Street',song:'La La Land soundtrack',pal:['#0b1022','#2a1c46','#e0a35c','#3d5aa8','#a06bd0'],
  init(W,H){const r=SC.mk(23);return {rn:SC.rainInit(r,420),b:Array.from({length:14},(_,i)=>({h:.35+r()*.4,w:.07+r()*.05})),r}},
  draw(x,W,H,t,S){const {grad,glow}=SC;grad(x,W,H,[[0,'#0b0f26'],[.5,'#2a1d48'],[.62,'#3b2650'],[1,'#0b0d1a']]);
    const hz=H*.6;let bx=0;S.b.forEach((b,i)=>{const bw=b.w*W;x.fillStyle=i%2?'#151431':'#1b1838';x.fillRect(bx,hz-b.h*H*.6,bw,b.h*H*.6);SC.windows(x,bx,hz-b.h*H*.6,bw,b.h*H*.6,SC.mk(i+3),.3,'rgba(255,210,140,.6)');bx+=bw+W*.005});
    // street in perspective and wet reflections
    x.fillStyle='#0e0d1c';x.beginPath();x.moveTo(0,H);x.lineTo(W*.45,hz);x.lineTo(W*.55,hz);x.lineTo(W,H);x.fill();
    x.fillStyle='#17152a';x.fillRect(0,hz,W*.45,H-hz);x.fillRect(W*.55,hz,W*.45,H-hz);
    for(let i=0;i<7;i++){const k=i/6,z=Math.pow(k,1.6);const lx=SC.lerp(W*.44,W*.06,z),ly=SC.lerp(hz,H*.95,z),lh=SC.lerp(H*.05,H*.55,z);
      x.fillStyle='#0a0a14';x.fillRect(lx-1,ly-lh,Math.max(2,W/500*(1+z*3)),lh);glow(x,lx,ly-lh,H*(.03+z*.08),'rgba(255,205,120,.75)');
      const g=x.createLinearGradient(0,ly,0,ly+H*.25*z);g.addColorStop(0,'rgba(255,200,110,.45)');g.addColorStop(1,'rgba(255,200,110,0)');x.fillStyle=g;x.fillRect(lx-W*.006*(1+z*2),ly,W*.012*(1+z*2),H*.25*z);
      const rx=W-lx;x.fillStyle='#0a0a14';x.fillRect(rx-1,ly-lh,Math.max(2,W/500*(1+z*3)),lh);glow(x,rx,ly-lh,H*(.03+z*.08),'rgba(200,160,255,.65)')}
    // passing car lights
    const c=(t*.13)%1.4;if(c<1){const z=Math.pow(c,2),cx=SC.lerp(W*.5,W*.62,z),cy=SC.lerp(hz,H*.98,z),s=H*(.01+z*.06);glow(x,cx-s,cy,s*3,'rgba(255,250,230,.9)');glow(x,cx+s,cy,s*3,'rgba(255,250,230,.9)')}
    SC.drawRain(x,S.rn,W,H,t*1.6,'rgba(190,200,240,.35)',.08);SC.vignette(x,W,H,.55);SC.fadeIn(x,W,H,t)}});

addTheme('class',{id:'studydesk',name:'Late-Night Study Desk',song:'Love themes (slow piano)',pal:['#151018','#2a1d22','#f0a85a','#3b4e7a','#ffcf8a'],
  init(W,H){const r=SC.mk(31);return {drops:Array.from({length:40},()=>({x:r(),y:r(),v:.03+r()*.08,s:.003+r()*.006})),bok:Array.from({length:45},()=>({x:r(),y:r(),r:.01+r()*.03,c:r()})),r}},
  draw(x,W,H,t,S){const {glow,TAU}=SC;x.fillStyle='#1a1418';x.fillRect(0,0,W,H);
    // window with a blurred rainy city
    const wx=W*.18,wy=H*.08,ww=W*.5,wh=H*.5;x.fillStyle='#0f1630';x.fillRect(wx,wy,ww,wh);
    x.save();x.beginPath();x.rect(wx,wy,ww,wh);x.clip();for(const b of S.bok){x.globalAlpha=.35+.25*Math.sin(t+b.c*9);x.fillStyle=b.c<.5?'#ffc070':b.c<.8?'#7aa0ff':'#ff8fa8';x.beginPath();x.arc(wx+b.x*ww,wy+b.y*wh,b.r*W,0,TAU);x.fill()}x.globalAlpha=1;
    for(const d of S.drops){const yy=((d.y+t*d.v)%1);x.fillStyle='rgba(220,230,255,.5)';x.beginPath();x.ellipse(wx+d.x*ww,wy+yy*wh,d.s*W*.6,d.s*W,0,0,TAU);x.fill();x.fillStyle='rgba(220,230,255,.12)';x.fillRect(wx+d.x*ww-1,wy+(yy-.08)*wh,2,.08*wh)}x.restore();
    x.strokeStyle='#3a2a22';x.lineWidth=W*.008;x.strokeRect(wx,wy,ww,wh);x.beginPath();x.moveTo(wx+ww/2,wy);x.lineTo(wx+ww/2,wy+wh);x.moveTo(wx,wy+wh/2);x.lineTo(wx+ww,wy+wh/2);x.stroke();
    // desk, lamp light, books, mug with steam, glowing laptop
    x.fillStyle='#3a2618';x.fillRect(0,H*.66,W,H*.34);x.fillStyle='#2b1b10';x.fillRect(0,H*.66,W,H*.02);
    const lx=W*.78,ly=H*.3;glow(x,lx,H*.7,H*.55,'rgba(255,190,110,.42)');
    x.strokeStyle='#1b1410';x.lineWidth=W*.006;x.beginPath();x.moveTo(lx+W*.06,H*.68);x.lineTo(lx+W*.08,H*.45);x.lineTo(lx,ly);x.stroke();
    x.fillStyle='#2a1f19';x.beginPath();x.moveTo(lx-W*.05,ly+H*.05);x.lineTo(lx+W*.03,ly-H*.04);x.lineTo(lx+W*.06,ly+H*.02);x.closePath();x.fill();glow(x,lx-W*.01,ly+H*.05,H*.08,'rgba(255,230,170,.9)');
    [['#6b2f2f',.08],['#2f4f6b',.06],['#6b5a2f',.07]].forEach(([c,h],i)=>{x.fillStyle=c;x.fillRect(W*(.08+i*.035),H*(.66-h),W*.03,H*h)});
    x.fillStyle='#d9d1c4';x.fillRect(W*.6,H*.6,W*.045,H*.07);x.strokeStyle='#d9d1c4';x.lineWidth=W*.005;x.beginPath();x.arc(W*.648,H*.635,H*.02,-1.2,1.2);x.stroke();
    for(let i=0;i<3;i++){x.strokeStyle=`rgba(255,255,255,${.12+.05*i})`;x.lineWidth=W*.003;x.beginPath();for(let k=0;k<20;k++){const yy=H*(.59-k*.008),xx=W*(.62+i*.008)+Math.sin(t*1.5+k*.5+i)*W*.006;k?x.lineTo(xx,yy):x.moveTo(xx,yy)}x.stroke()}
    x.fillStyle='#1d2230';x.beginPath();x.moveTo(W*.3,H*.68);x.lineTo(W*.52,H*.68);x.lineTo(W*.5,H*.5);x.lineTo(W*.32,H*.5);x.fill();glow(x,W*.41,H*.6,H*.18,'rgba(120,170,255,.35)');x.fillStyle='rgba(150,190,255,.55)';x.fillRect(W*.335,H*.515,W*.16,H*.15);
    SC.vignette(x,W,H,.55);SC.fadeIn(x,W,H,t)}});

addTheme('class',{id:'lanterns',name:'Lanterns Over the Lake',song:'Up soundtrack',pal:['#2b1b3d','#d07a4a','#ffcf7a','#7a3d6b','#ff9a5a'],
  init(W,H){const r=SC.mk(41);return {L:Array.from({length:70},()=>({x:r(),y:1+r()*.9,v:.02+r()*.035,s:.5+r(),p:r()*6})),st:SC.starsInit(r,80)}},
  draw(x,W,H,t,S){const {grad,glow,ridge}=SC;grad(x,W,H,[[0,'#1d1433'],[.45,'#5b2d57'],[.7,'#d0704a'],[.78,'#f0a560'],[1,'#3a1f2c']]);SC.drawStars(x,S.st,W,H,t,.35,.7);
    ridge(x,W,H,.74,.06,1.3,1,'#3a1f3d',2);ridge(x,W,H,.8,.05,2,3,'#25142a',5);
    grad(x,W,H,[[0,'#6b3a4a'],[1,'#1a0f1c']],H*.8,H);x.fillRect(0,H*.8,W,H*.2);
    for(const l of S.L){const y=l.y-t*l.v,yy=y*H*.85,xx=(l.x+Math.sin(t*.3+l.p)*.01)*W;if(y<-.1||y>1.1)continue;const s=W*.007*l.s*(1-y*.3);
      glow(x,xx,yy,s*4,'rgba(255,180,90,.45)');x.fillStyle='#ffcf7a';x.fillRect(xx-s/2,yy-s*.7,s,s*1.3);x.fillStyle='#fff1c4';x.fillRect(xx-s/4,yy+s*.2,s/2,s*.3);
      if(y>.0&&y<.95){x.globalAlpha=.25;x.fillStyle='#ffcf7a';x.fillRect(xx-s/2,H*.8+(H*.8-yy)*.12,s,s*.5);x.globalAlpha=1}}
    SC.vignette(x,W,H,.45);SC.fadeIn(x,W,H,t)}});

addTheme('class',{id:'reef',name:'Coral Reef',song:'Finding Nemo soundtrack',pal:['#0b3b63','#06213b','#2fb4c9','#ff8a6a','#7ae0d0'],
  init(W,H){const r=SC.mk(53);return {fish:Array.from({length:26},(_,i)=>({y:.25+r()*.45,v:.03+r()*.05,s:.6+r(),c:['#ffd36b','#7ad0ff','#ff9ec4','#b7ff8a','#c9a0ff'][i%5],o:r()})),bub:Array.from({length:40},()=>({x:r(),y:r(),v:.03+r()*.05,s:r()})),cor:Array.from({length:16},(_,i)=>({x:i/15+r()*.03,h:.12+r()*.16,c:['#ff7f6a','#ffb36a','#e86ab8','#8a7cff'][i%4]}))}},
  draw(x,W,H,t,S){const {grad,TAU}=SC;grad(x,W,H,[[0,'#2aa7c9'],[.4,'#0f6a97'],[1,'#062641']]);
    for(let i=0;i<6;i++){x.globalAlpha=.07+.04*Math.sin(t*.6+i);x.fillStyle='#e8ffff';x.beginPath();const bx=W*(.1+i*.17)+Math.sin(t*.2+i)*W*.03;x.moveTo(bx,0);x.lineTo(bx+W*.05,0);x.lineTo(bx+W*.2,H);x.lineTo(bx+W*.1,H);x.fill()}x.globalAlpha=1;
    x.fillStyle='#d9c08a';x.beginPath();x.moveTo(0,H);x.lineTo(0,H*.88);for(let i=0;i<=20;i++)x.lineTo(i/20*W,H*(.87+.02*Math.sin(i*1.3)));x.lineTo(W,H);x.fill();
    for(const c of S.cor){const bx=c.x*W,by=H*.9;x.strokeStyle=c.c;x.lineCap='round';x.lineWidth=W*.008;
      const br=(px,py,a,len,d)=>{if(d>3)return;const ex=px+Math.cos(a)*len,ey=py+Math.sin(a)*len;x.beginPath();x.moveTo(px,py);x.lineTo(ex,ey);x.stroke();br(ex,ey,a-.45+Math.sin(t*.8+bx)*.05,len*.7,d+1);br(ex,ey,a+.45,len*.7,d+1)};br(bx,by,-Math.PI/2,c.h*H*.5,0)}
    for(let i=0;i<10;i++){const bx=W*(.05+i*.1),by=H*.9;x.strokeStyle='rgba(120,255,200,.6)';x.lineWidth=W*.004;for(let k=0;k<7;k++){x.beginPath();x.moveTo(bx+k*W*.004,by);x.quadraticCurveTo(bx+k*W*.004+Math.sin(t*1.5+k+i)*W*.012,by-H*.05,bx+k*W*.004+Math.sin(t*1.5+k+i)*W*.02,by-H*.09);x.stroke()}}
    for(const f of S.fish){const xx=((f.o+t*f.v)%1.2-.1)*W,yy=(f.y+Math.sin(t+f.o*9)*.02)*H,s=W*.018*f.s;x.fillStyle=f.c;x.beginPath();x.ellipse(xx,yy,s,s*.45,0,0,TAU);x.fill();x.beginPath();x.moveTo(xx-s*.8,yy);x.lineTo(xx-s*1.5,yy-s*.45*(1+.3*Math.sin(t*8+f.o*5)));x.lineTo(xx-s*1.5,yy+s*.45);x.fill();x.fillStyle='#012';x.beginPath();x.arc(xx+s*.55,yy-s*.1,s*.09,0,TAU);x.fill()}
    for(const b of S.bub){const yy=1-((b.y+t*b.v)%1);x.strokeStyle='rgba(230,255,255,.5)';x.lineWidth=1;x.beginPath();x.arc(b.x*W+Math.sin(t*2+b.s*9)*W*.004,yy*H,W*.003*(1+b.s*2),0,TAU);x.stroke()}
    SC.vignette(x,W,H,.4);SC.fadeIn(x,W,H,t)}});

addTheme('class',{id:'aurora',name:'Northern Lights Cabin',song:'Inside Out soundtrack',pal:['#081428','#0c2a3a','#3cf0b0','#7a6cff','#1f8a8a'],
  init(W,H){const r=SC.mk(67);return {st:SC.starsInit(r,170),snow:Array.from({length:120},()=>({x:r(),y:r(),v:.02+r()*.04,s:r()})),trees:Array.from({length:22},()=>({x:r(),h:.08+r()*.12}))}},
  draw(x,W,H,t,S){const {grad,glow,ridge,TAU}=SC;grad(x,W,H,[[0,'#050b1c'],[.6,'#0d2238'],[1,'#13304a']]);SC.drawStars(x,S.st,W,H,t,.6);
    x.globalCompositeOperation='lighter';for(let b=0;b<3;b++){const c=['rgba(60,240,170,','rgba(120,110,255,','rgba(60,200,220,'][b];
      for(let i=0;i<=80;i++){const u=i/80,yy=H*(.18+b*.07+.07*Math.sin(u*5+t*.35+b)+.03*Math.sin(u*13-t*.5)),h=H*(.16+.06*Math.sin(u*7+t*.4+b));const g=x.createLinearGradient(0,yy,0,yy+h);g.addColorStop(0,c+'0)');g.addColorStop(.3,c+'.22)');g.addColorStop(1,c+'0)');x.fillStyle=g;x.fillRect(u*W,yy,W/80+1,h)}}
    x.globalCompositeOperation='source-over';
    ridge(x,W,H,.72,.08,1,2,'#16324a',3);ridge(x,W,H,.84,.05,1.6,4,'#dfe9f2',6);x.fillStyle='#eaf1f7';x.fillRect(0,H*.88,W,H*.12);
    for(const tr of S.trees){const bx=tr.x*W,by=H*.86,h=tr.h*H;x.fillStyle='#0b1a24';x.beginPath();x.moveTo(bx,by-h);x.lineTo(bx+h*.28,by);x.lineTo(bx-h*.28,by);x.fill()}
    const cx=W*.6,cy=H*.86;x.fillStyle='#3a2416';x.fillRect(cx,cy-H*.09,W*.1,H*.09);x.fillStyle='#24140c';x.beginPath();x.moveTo(cx-W*.01,cy-H*.09);x.lineTo(cx+W*.05,cy-H*.15);x.lineTo(cx+W*.11,cy-H*.09);x.fill();
    x.fillStyle='#ffc773';x.fillRect(cx+W*.02,cy-H*.06,W*.022,H*.03);glow(x,cx+W*.03,cy-H*.045,H*.07,'rgba(255,190,100,.5)');x.fillStyle='#eaf1f7';x.fillRect(cx-W*.01,cy-H*.093,W*.12,H*.008);
    for(let i=0;i<6;i++){const k=((t*.15+i/6)%1);x.globalAlpha=.25*(1-k);x.fillStyle='#cfd8e0';x.beginPath();x.arc(cx+W*.085+Math.sin(k*6)*W*.01,cy-H*(.15+k*.2),W*.008*(1+k*3),0,TAU);x.fill()}x.globalAlpha=1;
    for(const s of S.snow){x.fillStyle='rgba(255,255,255,.8)';x.fillRect(((s.x+Math.sin(t+s.s*9)*.01)%1)*W,((s.y+t*s.v)%1)*H,W/600*(1+s.s),W/600*(1+s.s))}
    SC.vignette(x,W,H,.45);SC.fadeIn(x,W,H,t)}});

/* ===== SKILLS · creative fun ===== */
addTheme('skill',{id:'bluesky',name:'Blue Sky & Clouds',song:'Toy Story soundtrack',pal:['#7cc4f2','#cfeeff','#ffffff','#9ed6ff','#fff3c4'],
  init(W,H){const r=SC.mk(71);return {c:Array.from({length:12},()=>({x:r()*1.3,y:.1+r()*.7,s:.04+r()*.07,v:.006+r()*.012}))}},
  draw(x,W,H,t,S){const {grad,glow,puff,TAU}=SC;grad(x,W,H,[[0,'#5fb2ef'],[.7,'#a9dcfb'],[1,'#d8f1ff']]);glow(x,W*.85,H*.15,H*.4,'rgba(255,255,240,.6)');
    S.c.slice().sort((a,b)=>a.s-b.s).forEach(c=>{const xx=((c.x+t*c.v)%1.3-.15)*W;puff(x,xx,c.y*H,c.s*W,'#ffffff','rgba(170,205,235,.8)')});
    const px=((t*.07)%1.3-.15)*W,py=H*(.45+.08*Math.sin(t*.8));x.save();x.translate(px,py);x.rotate(.08*Math.sin(t*.8+1));const s=W*.03;x.fillStyle='#fff';x.strokeStyle='#8aa';x.lineWidth=1;
    x.beginPath();x.moveTo(s,0);x.lineTo(-s,-s*.45);x.lineTo(-s*.6,0);x.closePath();x.fill();x.stroke();x.fillStyle='#e3ecf2';x.beginPath();x.moveTo(s,0);x.lineTo(-s,s*.25);x.lineTo(-s*.6,0);x.closePath();x.fill();x.stroke();x.restore();
    SC.fadeIn(x,W,H,t)}});

addTheme('skill',{id:'bayou',name:'Bayou at Dusk',song:'The Princess and the Frog soundtrack',pal:['#1b2a3a','#2a3b2a','#f2d06b','#4a6a4a','#c58ad0'],
  init(W,H){const r=SC.mk(83);return {ff:Array.from({length:60},()=>({x:r(),y:.3+r()*.5,p:r()*6,k:.5+r()})),st:SC.starsInit(r,60),pads:Array.from({length:14},()=>({x:r(),y:.82+r()*.14,s:r()}))}},
  draw(x,W,H,t,S){const {grad,glow,TAU}=SC;grad(x,W,H,[[0,'#1d1f3a'],[.45,'#3d3a5a'],[.62,'#a0708a'],[.66,'#2b3a32'],[1,'#0e1a16']]);SC.drawStars(x,S.st,W,H,t,.4,.6);
    x.fillStyle='#fff3c8';x.beginPath();x.arc(W*.28,H*.24,H*.06,0,TAU);x.fill();glow(x,W*.28,H*.24,H*.2,'rgba(255,240,200,.35)');
    for(let i=0;i<7;i++){const bx=W*(.05+i*.15),h=H*(.45+(i%3)*.1),top=H*.66-h;x.fillStyle='#0f1813';x.beginPath();x.moveTo(bx-W*.02,H*.7);x.lineTo(bx-W*.006,top+h*.3);x.lineTo(bx+W*.006,top+h*.3);x.lineTo(bx+W*.02,H*.7);x.fill();
      x.beginPath();x.ellipse(bx,top+h*.2,W*.06,H*.07,0,0,TAU);x.fill();x.strokeStyle='rgba(90,110,80,.7)';x.lineWidth=W*.002;
      for(let k=0;k<9;k++){const mx=bx-W*.05+k*W*.012;x.beginPath();x.moveTo(mx,top+h*.22);x.quadraticCurveTo(mx+Math.sin(t*.8+k)*W*.004,top+h*.3,mx+Math.sin(t*.8+k)*W*.006,top+h*(.35+(k%3)*.05));x.stroke()}}
    grad(x,W,H,[[0,'#2a3540'],[1,'#0b1412']],H*.7,H);x.fillRect(0,H*.7,W,H*.3);
    x.globalAlpha=.3;x.fillStyle='#fff3c8';x.beginPath();x.ellipse(W*.28,H*.78,H*.05,H*.012,0,0,TAU);x.fill();for(let i=0;i<6;i++){x.fillRect(W*.25+Math.sin(t*2+i)*W*.01,H*(.8+i*.02),W*.06,H*.003)}x.globalAlpha=1;
    for(const p of S.pads){x.fillStyle='#2f5a36';x.beginPath();x.ellipse(p.x*W,p.y*H+Math.sin(t+p.s*6)*H*.003,W*.025*(.6+p.s),H*.008*(.6+p.s),0,.3,TAU);x.fill()}
    x.globalCompositeOperation='lighter';for(const f of S.ff){const a=Math.max(0,Math.sin(t*f.k*2+f.p));const xx=(f.x+Math.sin(t*.3+f.p)*.02)*W,yy=(f.y+Math.cos(t*.25+f.p)*.03)*H;glow(x,xx,yy,W*.012,`rgba(240,255,140,${.8*a})`)}x.globalCompositeOperation='source-over';
    SC.vignette(x,W,H,.5);SC.fadeIn(x,W,H,t)}});

addTheme('skill',{id:'workshop',name:'Clockwork Workshop',song:'Monsters, Inc. soundtrack',pal:['#2a1a10','#4a2e18','#e0a040','#8a5a2a','#ffd27a'],
  init(W,H){const r=SC.mk(97);return {g:[[.25,.4,.16,14,1],[.46,.62,.11,10,-1.4],[.62,.32,.13,12,1.1],[.8,.6,.09,9,-1.6],[.12,.75,.08,8,1.8],[.88,.22,.07,8,-2]],sp:Array.from({length:30},()=>({x:r(),y:r(),v:r()}))}},
  draw(x,W,H,t,S){const {grad,glow,TAU}=SC;grad(x,W,H,[[0,'#24150c'],[1,'#120a06']]);glow(x,W*.5,H*.45,H*.7,'rgba(255,170,70,.25)');
    const gear=(cx,cy,r,n,a,c1,c2)=>{x.save();x.translate(cx,cy);x.rotate(a);x.fillStyle=c1;x.beginPath();for(let i=0;i<n*2;i++){const rr=i%2?r*.82:r;const a0=i/(n*2)*TAU,a1=(i+1)/(n*2)*TAU;x.lineTo(Math.cos(a0)*rr,Math.sin(a0)*rr);x.lineTo(Math.cos(a1)*rr,Math.sin(a1)*rr)}x.closePath();x.fill();
      x.fillStyle=c2;x.beginPath();x.arc(0,0,r*.62,0,TAU);x.fill();x.fillStyle=c1;for(let k=0;k<5;k++){x.save();x.rotate(k/5*TAU);x.fillRect(-r*.06,0,r*.12,r*.62);x.restore()}x.beginPath();x.arc(0,0,r*.16,0,TAU);x.fill();x.fillStyle='#2a1a10';x.beginPath();x.arc(0,0,r*.07,0,TAU);x.fill();x.restore()};
    S.g.forEach(([gx,gy,r,n,sp],i)=>gear(gx*W,gy*H,r*H,n,t*sp*.5,i%2?'#b8823a':'#d9a24a','#3a2414'));
    const px=W*.5,py=H*.05,len=H*.55,a=.35*Math.sin(t*1.8);x.strokeStyle='#c89a4a';x.lineWidth=W*.004;x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.sin(a)*len,py+Math.cos(a)*len);x.stroke();x.fillStyle='#e7bb5a';x.beginPath();x.arc(px+Math.sin(a)*len,py+Math.cos(a)*len,H*.04,0,TAU);x.fill();
    for(const s of S.sp){const k=(t*.5+s.v)%1;if(k<.25){x.fillStyle=`rgba(255,220,120,${1-k*4})`;x.fillRect(W*.46+k*W*.2*(s.x-.5)*4,H*.62-k*H*.3*s.y,W/400,W/400)}}
    for(let i=0;i<4;i++){const k=(t*.12+i/4)%1;x.globalAlpha=.18*(1-k);x.fillStyle='#e8ded0';x.beginPath();x.arc(W*.9,H*(.95-k*.6),W*.02*(1+k*2),0,TAU);x.fill()}x.globalAlpha=1;
    SC.vignette(x,W,H,.55);SC.fadeIn(x,W,H,t)}});

addTheme('skill',{id:'kelp',name:'Kelp Forest',song:'The Little Mermaid soundtrack',pal:['#0b4a55','#06232b','#3fd0b0','#2f7a9a','#f0e08a'],
  init(W,H){const r=SC.mk(109);return {k:Array.from({length:22},()=>({x:r(),h:.5+r()*.45,w:.6+r(),p:r()*6})),j:Array.from({length:5},()=>({x:r(),y:r(),p:r()*6})),b:Array.from({length:30},()=>({x:r(),y:r(),v:.03+r()*.04})),f:Array.from({length:30},()=>({o:r(),y:.3+r()*.3}))}},
  draw(x,W,H,t,S){const {grad,glow,TAU}=SC;grad(x,W,H,[[0,'#3fb4b8'],[.35,'#126b78'],[1,'#03161c']]);
    for(let i=0;i<5;i++){x.globalAlpha=.08;x.fillStyle='#f0ffe0';x.beginPath();const bx=W*(.15+i*.18)+Math.sin(t*.3+i)*W*.02;x.moveTo(bx,0);x.lineTo(bx+W*.04,0);x.lineTo(bx+W*.16,H);x.lineTo(bx+W*.07,H);x.fill()}x.globalAlpha=1;
    for(const f of S.f){const xx=((f.o+t*.02)%1)*W,yy=(f.y+.03*Math.sin(t*.8+f.o*20))*H;x.fillStyle='rgba(200,240,255,.6)';x.beginPath();x.ellipse(xx,yy,W*.006,W*.0025,0,0,TAU);x.fill()}
    for(const k of S.k){const bx=k.x*W;x.strokeStyle=`rgba(${60+k.w*40|0},${140+k.w*30|0},70,.9)`;x.lineWidth=W*.006*k.w;x.beginPath();x.moveTo(bx,H);for(let i=1;i<=24;i++){const u=i/24;x.lineTo(bx+Math.sin(t*.9+k.p+u*3)*W*.025*u,H-u*k.h*H)}x.stroke();
      for(let i=3;i<24;i+=3){const u=i/24,xx=bx+Math.sin(t*.9+k.p+u*3)*W*.025*u,yy=H-u*k.h*H;x.fillStyle='rgba(110,170,70,.8)';x.beginPath();x.ellipse(xx+W*.008,yy,W*.01,W*.003,.6,0,TAU);x.fill()}}
    for(const j of S.j){const pulse=.85+.15*Math.sin(t*2.5+j.p),xx=(j.x+.02*Math.sin(t*.4+j.p))*W,yy=((j.y-t*.02)%1+1)%1*H*.8+H*.05;x.fillStyle='rgba(255,170,220,.55)';x.beginPath();x.ellipse(xx,yy,W*.025*pulse,W*.018,0,Math.PI,TAU);x.fill();
      x.strokeStyle='rgba(255,190,230,.45)';x.lineWidth=1;for(let k=0;k<6;k++){x.beginPath();x.moveTo(xx-W*.02+k*W*.008,yy);x.quadraticCurveTo(xx-W*.02+k*W*.008+Math.sin(t*3+k)*W*.006,yy+W*.03,xx-W*.02+k*W*.008,yy+W*.05);x.stroke()}}
    for(const b of S.b){const yy=1-((b.y+t*b.v)%1);x.strokeStyle='rgba(220,255,255,.45)';x.beginPath();x.arc(b.x*W,yy*H,W*.003,0,TAU);x.stroke()}
    SC.vignette(x,W,H,.5);SC.fadeIn(x,W,H,t)}});

addTheme('skill',{id:'beach',name:'Sunny Beach',song:'Moana & Rio soundtracks',pal:['#7fd0ef','#f3dfb4','#ffd34a','#2fa8c0','#ffffff'],
  init(W,H){const r=SC.mk(121);return {gulls:Array.from({length:5},()=>({o:r(),y:.15+r()*.2,s:.6+r()*.6})),gl:Array.from({length:40},()=>({x:r(),y:r(),p:r()*6}))}},
  draw(x,W,H,t,S){const {grad,glow,TAU}=SC;grad(x,W,H,[[0,'#56b8ea'],[.5,'#bfe8f6'],[.55,'#bfe8f6']]);glow(x,W*.75,H*.2,H*.35,'rgba(255,240,180,.8)');x.fillStyle='#fff7d6';x.beginPath();x.arc(W*.75,H*.2,H*.07,0,TAU);x.fill();
    grad(x,W,H,[[0,'#3aa9c4'],[1,'#2a8fb0']],H*.52,H*.75);x.fillRect(0,H*.52,W,H*.23);
    for(const g of S.gl){x.fillStyle=`rgba(255,255,255,${.6*Math.max(0,Math.sin(t*2+g.p))})`;x.fillRect(g.x*W,H*(.53+g.y*.2),W*.01,H*.003)}
    for(let i=0;i<4;i++){const yy=H*(.6+i*.04),off=Math.sin(t*1.2+i)*W*.02;x.strokeStyle='rgba(255,255,255,.5)';x.lineWidth=W*.003;x.beginPath();for(let k=0;k<=20;k++){const xx=k/20*W;const y2=yy+Math.sin(k*1.1+t*2+i)*H*.005;k?x.lineTo(xx+off,y2):x.moveTo(xx+off,y2)}x.stroke()}
    const sw=Math.sin(t*1.1)*H*.012;x.fillStyle='rgba(255,255,255,.85)';x.beginPath();x.moveTo(0,H*.74+sw);for(let k=0;k<=30;k++)x.lineTo(k/30*W,H*(.74+.008*Math.sin(k*.8+t*2))+sw);x.lineTo(W,H*.78+sw);x.lineTo(0,H*.78+sw);x.fill();
    grad(x,W,H,[[0,'#f3dfb4'],[1,'#e4c48a']],H*.76,H);x.beginPath();x.moveTo(0,H);x.lineTo(0,H*.77+sw);for(let k=0;k<=30;k++)x.lineTo(k/30*W,H*(.77+.008*Math.sin(k*.8+t*2))+sw);x.lineTo(W,H);x.fill();
    const px=W*.12,py=H*.95;x.strokeStyle='#5a3a1e';x.lineWidth=W*.012;x.beginPath();x.moveTo(px,py);x.quadraticCurveTo(px+W*.04,H*.6,px+W*.08,H*.32);x.stroke();
    for(let i=0;i<6;i++){const a=-2.6+i*.55+Math.sin(t*1.3+i)*.06;x.strokeStyle='#2f7a3a';x.lineWidth=W*.007;x.beginPath();x.moveTo(px+W*.08,H*.32);x.quadraticCurveTo(px+W*.08+Math.cos(a)*W*.06,H*.32+Math.sin(a)*W*.03-W*.02,px+W*.08+Math.cos(a)*W*.11,H*.32+Math.sin(a)*W*.05+W*.03);x.stroke()}
    for(const g of S.gulls){const xx=((g.o+t*.035)%1.2-.1)*W,yy=g.y*H+Math.sin(t*1.5+g.o*9)*H*.01,s=W*.015*g.s,f=Math.sin(t*6+g.o*20)*.6;x.strokeStyle='#33424a';x.lineWidth=Math.max(1.5,W/800);x.beginPath();x.moveTo(xx-s,yy-s*f*.5);x.quadraticCurveTo(xx-s*.4,yy-s*.5,xx,yy);x.quadraticCurveTo(xx+s*.4,yy-s*.5,xx+s,yy-s*f*.5);x.stroke()}
    SC.fadeIn(x,W,H,t)}});

addTheme('skill',{id:'desertdiner',name:'Desert Highway Diner',song:'Cars soundtrack',pal:['#3a1f3a','#f0805a','#ffd06a','#a04a3a','#4ad0d0'],
  init(W,H){const r=SC.mk(131);return {cac:Array.from({length:8},()=>({x:r(),s:.5+r()*.6})),st:SC.starsInit(r,50)}},
  draw(x,W,H,t,S){const {grad,glow,TAU}=SC;grad(x,W,H,[[0,'#2a1b42'],[.35,'#a0466a'],[.55,'#f08a5a'],[.62,'#ffc66a'],[.64,'#c0603a'],[1,'#5a2a1c']]);SC.drawStars(x,S.st,W,H,t,.25,.6);
    glow(x,W*.5,H*.6,H*.3,'rgba(255,200,110,.6)');x.fillStyle='#ffdf8a';x.beginPath();x.arc(W*.5,H*.62,H*.08,Math.PI,TAU);x.fill();
    x.fillStyle='#7a3328';[[.05,.12,.42],[.22,.2,.48],[.7,.18,.44],[.86,.14,.4]].forEach(([mx,mw,mh])=>{x.beginPath();x.moveTo(W*mx,H*.63);x.lineTo(W*(mx+.01),H*mh);x.lineTo(W*(mx+mw-.01),H*mh);x.lineTo(W*(mx+mw),H*.63);x.fill()});
    x.fillStyle='#8a4a2c';x.fillRect(0,H*.62,W,H*.38);x.fillStyle='#2a2226';x.beginPath();x.moveTo(W*.47,H*.62);x.lineTo(W*.53,H*.62);x.lineTo(W*.95,H);x.lineTo(W*.05,H);x.fill();
    for(let i=0;i<10;i++){const k=((i/10+t*.15)%1),z=k*k,y=H*(.62+z*.38),w=W*(.002+z*.012),h=H*(.004+z*.05);x.fillStyle='#ffd36a';x.fillRect(W*.5-w/2,y,w,h)}
    for(const c of S.cac){const bx=c.x<.5?c.x*W*.8:W*.2+c.x*W*.8,by=H*(.7+c.s*.25),h=H*.12*c.s;x.fillStyle='#2a3a24';x.fillRect(bx-W*.005*c.s,by-h,W*.01*c.s,h);x.fillRect(bx-W*.02*c.s,by-h*.65,W*.015*c.s,W*.006*c.s);x.fillRect(bx-W*.02*c.s,by-h*.9,W*.006*c.s,h*.3);x.fillRect(bx+W*.005*c.s,by-h*.5,W*.015*c.s,W*.006*c.s);x.fillRect(bx+W*.014*c.s,by-h*.75,W*.006*c.s,h*.28)}
    const dx=W*.72,dy=H*.66;x.fillStyle='#d8d0c0';x.fillRect(dx,dy-H*.08,W*.16,H*.08);x.fillStyle='#4ad0d0';x.fillRect(dx,dy-H*.085,W*.16,H*.01);x.fillStyle='#ffe0a0';for(let i=0;i<4;i++)x.fillRect(dx+W*(.01+i*.038),dy-H*.06,W*.028,H*.03);
    const on=(Math.floor(t*2)%5)!==0;x.font=`700 ${Math.round(H*.05)}px "Limelight",Georgia,serif`;x.textAlign='center';x.fillStyle=on?'#ff5a8a':'#5a2a3a';if(on){x.shadowColor='#ff5a8a';x.shadowBlur=H*.03}x.fillText('DINER',dx+W*.08,dy-H*.12);x.shadowBlur=0;
    const ck=(t*.09)%1.3;if(ck<1.1){const z=ck,cx=W*(.53+z*.25),cy=H*(.63+z*z*.33),s=W*(.01+z*.05);x.fillStyle='#d9483a';x.beginPath();x.roundRect?x.roundRect(cx-s,cy-s*.5,s*2,s*.6,s*.2):x.rect(cx-s,cy-s*.5,s*2,s*.6);x.fill();x.fillStyle='#1a1416';x.beginPath();x.arc(cx-s*.6,cy+s*.1,s*.2,0,TAU);x.arc(cx+s*.6,cy+s*.1,s*.2,0,TAU);x.fill()}
    SC.vignette(x,W,H,.45);SC.fadeIn(x,W,H,t)}});

/* ===== PROJECTS · fast adventure ===== */
addTheme('project',{id:'retrocity',name:'Retro City Skyline',song:'The Incredibles soundtrack',pal:['#1a1030','#e0703a','#ffb84a','#3a2a6a','#ff5a3a'],
  init(W,H){const r=SC.mk(151);return {b:Array.from({length:22},()=>({w:.03+r()*.05,h:.25+r()*.45,sp:r()<.4,t:r()})),r}},
  draw(x,W,H,t,S){const {grad,glow}=SC;grad(x,W,H,[[0,'#1a1236'],[.5,'#6a2f4a'],[.78,'#f0803a'],[1,'#2a1224']]);
    for(let i=0;i<3;i++){const a=-.9+Math.sin(t*.6+i*2)*.5,bx=W*(.2+i*.3),by=H*.85;x.save();x.globalAlpha=.18;x.fillStyle='#ffe6b0';x.translate(bx,by);x.rotate(a);x.beginPath();x.moveTo(-W*.01,0);x.lineTo(W*.01,0);x.lineTo(W*.07,-H*1.2);x.lineTo(-W*.07,-H*1.2);x.fill();x.restore()}
    let bx=-W*.02;S.b.forEach((b,i)=>{const bw=b.w*W,bh=b.h*H,by=H*.9-bh;x.fillStyle=i%3?'#24183a':'#1b1230';
      x.beginPath();x.moveTo(bx,H);x.lineTo(bx,by+bw*.3);x.lineTo(bx+bw*.5,by);x.lineTo(bx+bw,by+bw*.3);x.lineTo(bx+bw,H);x.fill();if(b.sp){x.fillRect(bx+bw*.47,by-H*.08,bw*.06,H*.08)}
      SC.windows(x,bx,by+bw*.3,bw,bh,SC.mk(i*7+Math.floor(t*2)%2),.45,'rgba(255,190,90,.8)');bx+=bw+W*.004});
    x.fillStyle='#120a1c';x.fillRect(0,H*.9,W,H*.1);
    const k=(t*.25)%1.6;if(k<1){const sx=W*(-.1+k*1.2),sy=H*(.3+.1*Math.sin(k*3));const g=x.createLinearGradient(sx-W*.25,sy,sx,sy);g.addColorStop(0,'rgba(255,90,58,0)');g.addColorStop(1,'rgba(255,140,80,.9)');x.strokeStyle=g;x.lineWidth=H*.01;x.beginPath();x.moveTo(sx-W*.25,sy+H*.03);x.lineTo(sx,sy);x.stroke();glow(x,sx,sy,H*.05,'rgba(255,220,160,.9)')}
    SC.vignette(x,W,H,.45);SC.fadeIn(x,W,H,t)}});

addTheme('project',{id:'jungle',name:'Prehistoric Jungle',song:'Jurassic Park soundtrack',pal:['#0f2a1a','#3a5a2a','#c8e07a','#2a4a3a','#ff8a3a'],
  init(W,H){const r=SC.mk(163);return {fern:Array.from({length:18},()=>({x:r(),s:.6+r()*.7,p:r()*6})),birds:Array.from({length:3},()=>({o:r(),y:.15+r()*.15}))}},
  draw(x,W,H,t,S){const {grad,glow,ridge,TAU}=SC;grad(x,W,H,[[0,'#bcd8a8'],[.45,'#6f9a6a'],[1,'#1a3020']]);
    x.fillStyle='#4a5a4a';x.beginPath();x.moveTo(W*.55,H*.6);x.lineTo(W*.68,H*.25);x.lineTo(W*.73,H*.25);x.lineTo(W*.9,H*.6);x.fill();glow(x,W*.705,H*.25,H*.06,'rgba(255,120,50,.7)');
    for(let i=0;i<8;i++){const k=(t*.06+i/8)%1;x.globalAlpha=.35*(1-k);x.fillStyle='#6a6a6a';x.beginPath();x.arc(W*(.705+k*.08),H*(.22-k*.2),W*.02*(1+k*2),0,TAU);x.fill()}x.globalAlpha=1;
    ridge(x,W,H,.62,.06,1.5,1,'#3e6a48',2);
    const dk=(t*.025)%1.4-.2,dx=W*dk,dy=H*.6,s=H*.11,step=Math.sin(t*2.4);x.fillStyle='#2e4a38';
    x.beginPath();x.ellipse(dx,dy,s*1.1,s*.42,0,0,TAU);x.fill();x.beginPath();x.moveTo(dx+s*.8,dy-s*.1);x.quadraticCurveTo(dx+s*1.6,dy-s*1.2,dx+s*1.9,dy-s*1.6);x.lineTo(dx+s*2.05,dy-s*1.55);x.quadraticCurveTo(dx+s*1.7,dy-s*.9,dx+s*1.05,dy+s*.1);x.fill();
    x.beginPath();x.ellipse(dx+s*2.05,dy-s*1.62,s*.22,s*.11,.2,0,TAU);x.fill();x.beginPath();x.moveTo(dx-s*.9,dy);x.quadraticCurveTo(dx-s*1.8,dy-s*.1,dx-s*2.6,dy+s*.25);x.lineTo(dx-s*.9,dy+s*.25);x.fill();
    [[-.55,step],[-.2,-step],[.35,-step],[.7,step]].forEach(([o,st])=>{x.fillRect(dx+s*o+st*s*.06,dy+s*.2,s*.18,s*.62)});
    for(const b of S.birds){const xx=((b.o+t*.05)%1.3-.15)*W,yy=b.y*H,f=Math.sin(t*4+b.o*9);x.fillStyle='#2a3a30';x.beginPath();x.moveTo(xx,yy);x.lineTo(xx-W*.03,yy-H*.03*f);x.lineTo(xx-W*.012,yy+H*.004);x.lineTo(xx+W*.012,yy+H*.004);x.lineTo(xx+W*.03,yy-H*.03*f);x.closePath();x.fill();x.beginPath();x.moveTo(xx+W*.004,yy);x.lineTo(xx+W*.014,yy-H*.006);x.lineTo(xx+W*.004,yy-H*.004);x.fill()}
    x.fillStyle='rgba(220,240,210,.18)';x.fillRect(0,H*.55,W,H*.08);
    for(const f of S.fern){const bx=f.x*W,by=H,len=H*.32*f.s;for(let k=-3;k<=3;k++){const a=-Math.PI/2+k*.32+Math.sin(t*1.2+f.p)*.05;x.strokeStyle='#183a20';x.lineWidth=W*.004;x.beginPath();x.moveTo(bx,by);x.quadraticCurveTo(bx+Math.cos(a)*len*.5,by+Math.sin(a)*len*.7,bx+Math.cos(a)*len,by+Math.sin(a)*len*.9);x.stroke()}}
    SC.vignette(x,W,H,.45);SC.fadeIn(x,W,H,t)}});

addTheme('project',{id:'fjord',name:'Viking Fjord Village',song:'How to Train Your Dragon soundtrack',pal:['#1a2a3a','#3a5a6a','#ffb06a','#2a4a5a','#e0f0ff'],
  init(W,H){const r=SC.mk(177);return {st:SC.starsInit(r,60),h:Array.from({length:7},(_,i)=>({x:.08+i*.11+r()*.03,s:.7+r()*.5}))}},
  draw(x,W,H,t,S){const {grad,glow,TAU}=SC;grad(x,W,H,[[0,'#1d2a44'],[.4,'#5a6a8a'],[.6,'#e0a070'],[.62,'#2c3e4c'],[1,'#0e1a22']]);SC.drawStars(x,S.st,W,H,t,.3,.6);
    x.fillStyle='#2a3646';x.beginPath();x.moveTo(0,H*.62);x.lineTo(W*.1,H*.25);x.lineTo(W*.25,H*.4);x.lineTo(W*.33,H*.62);x.fill();x.beginPath();x.moveTo(W*.6,H*.62);x.lineTo(W*.75,H*.2);x.lineTo(W*.86,H*.34);x.lineTo(W,H*.3);x.lineTo(W,H*.62);x.fill();
    x.fillStyle='#dfe8f0';x.beginPath();x.moveTo(W*.085,H*.29);x.lineTo(W*.1,H*.25);x.lineTo(W*.12,H*.29);x.fill();x.beginPath();x.moveTo(W*.73,H*.25);x.lineTo(W*.75,H*.2);x.lineTo(W*.775,H*.26);x.fill();
    grad(x,W,H,[[0,'#3a5060'],[1,'#0e1a24']],H*.62,H);x.fillRect(0,H*.62,W,H*.38);for(let i=0;i<12;i++){x.fillStyle='rgba(255,200,140,.18)';x.fillRect(W*.4+Math.sin(t+i)*W*.03,H*(.64+i*.02),W*.12,H*.003)}
    x.fillStyle='#1f2a24';x.beginPath();x.moveTo(0,H*.82);x.quadraticCurveTo(W*.3,H*.7,W*.6,H*.8);x.lineTo(W*.6,H);x.lineTo(0,H);x.fill();
    for(const hs of S.h){if(hs.x>.55)continue;const bx=hs.x*W,by=H*(.78-hs.x*.06),w=W*.07*hs.s,h=H*.06*hs.s;x.fillStyle='#4a3020';x.fillRect(bx,by-h,w,h);x.fillStyle='#2a1a12';x.beginPath();x.moveTo(bx-w*.1,by-h);x.lineTo(bx+w/2,by-h*1.9);x.lineTo(bx+w*1.1,by-h);x.fill();
      x.fillStyle='#ffb46a';x.fillRect(bx+w*.4,by-h*.55,w*.18,h*.4);glow(x,bx+w*.5,by-h*.4,h*.9,'rgba(255,170,90,.45)');
      const k=(t*.2+hs.x*3)%1;x.globalAlpha=.25*(1-k);x.fillStyle='#ccd';x.beginPath();x.arc(bx+w*.5+Math.sin(k*5)*w*.1,by-h*(1.9+k*2.5),w*.08*(1+k*2),0,TAU);x.fill();x.globalAlpha=1}
    const bt=W*(.65+.05*Math.sin(t*.2)),by2=H*.74+Math.sin(t*1.2)*H*.004;x.fillStyle='#2a1a10';x.beginPath();x.moveTo(bt-W*.06,by2);x.quadraticCurveTo(bt,by2+H*.03,bt+W*.06,by2);x.lineTo(bt+W*.07,by2-H*.03);x.lineTo(bt+W*.05,by2-H*.005);x.lineTo(bt-W*.05,by2-H*.005);x.lineTo(bt-W*.07,by2-H*.03);x.fill();x.fillRect(bt-1,by2-H*.12,2,H*.11);x.fillStyle='#b8402a';x.fillRect(bt-W*.025,by2-H*.11,W*.05,H*.07);
    const dk=(t*.07)%1.4-.2,dx=W*dk,dy=H*(.25+.05*Math.sin(t*.9)),s=H*.06,f=Math.sin(t*5);x.fillStyle='#141c22';
    x.beginPath();x.ellipse(dx,dy,s*1.2,s*.3,0,0,TAU);x.fill();x.beginPath();x.moveTo(dx+s,dy);x.quadraticCurveTo(dx+s*1.5,dy-s*.5,dx+s*1.9,dy-s*.4);x.lineTo(dx+s*1.6,dy);x.fill();
    x.beginPath();x.moveTo(dx-s*1.1,dy);x.quadraticCurveTo(dx-s*2,dy+s*.3,dx-s*2.6,dy-s*.1);x.lineTo(dx-s*2.3,dy+s*.1);x.lineTo(dx-s*1,dy+s*.15);x.fill();
    x.beginPath();x.moveTo(dx-s*.4,dy);x.lineTo(dx-s*1.2,dy-s*2*f);x.lineTo(dx+s*.2,dy-s*1.4*f);x.lineTo(dx+s*.5,dy);x.fill();
    SC.vignette(x,W,H,.45);SC.fadeIn(x,W,H,t)}});

addTheme('project',{id:'pixel',name:'8-Bit Platformer',song:'Super Mario Bros. soundtrack',pal:['#5aa0f0','#9ad0ff','#6ad06a','#f0c04a','#ff6a8a'],
  init(W,H){return {}},
  draw(x,W,H,t,S){x.imageSmoothingEnabled=false;const P=Math.max(3,Math.round(H/90)),cols=Math.ceil(W/P),rows=Math.ceil(H/P),scroll=t*14;
    x.fillStyle='#6aa8f0';x.fillRect(0,0,W,H);
    const px=(cx,cy,c)=>{x.fillStyle=c;x.fillRect(Math.round(cx)*P,Math.round(cy)*P,P,P)};
    for(let i=0;i<4;i++){const cx=((i*40-scroll*.3)%(cols+40)+cols+40)%(cols+40)-20,cy=10+i%2*8;for(let a=0;a<12;a++)for(let b=0;b<4;b++)if((a>1&&a<10)||b>0&&b<3)px(cx+a,cy+b,b===3?'#d8ecff':'#fff')}
    for(let i=0;i<5;i++){const hx=((i*55-scroll*.5)%(cols+60)+cols+60)%(cols+60)-30,hy=rows-12;for(let a=-14;a<=14;a++){const hh=Math.round(10*Math.cos(a/14*Math.PI/2));for(let b=0;b<hh;b++)px(hx+a,hy-b,b===hh-1?'#4ab04a':'#3a9a5a')}}
    const ground=rows-10;for(let c=0;c<=cols;c++)for(let r=ground;r<rows;r++){const wc=c+Math.floor(scroll);px(c-(scroll%1),r,r===ground?'#5ad04a':((wc+r)%4===0?'#a0603a':'#c07a40'))}
    const plats=[[30,ground-12,8],[55,ground-20,6],[80,ground-14,10],[110,ground-22,7]];
    plats.forEach(([pxw,py,len])=>{const bx=((pxw-scroll)%140+140)%140-10;for(let a=0;a<len;a++){px(bx+a,py,'#c86a3a');px(bx+a,py+1,'#a0502a')}
      const gx=bx+len/2,gy=py-3-Math.abs(Math.sin(t*3+pxw))*1.2,sw=Math.abs(Math.cos(t*4+pxw));for(let k=-1;k<=1;k++)px(gx+k*sw,gy,'#4af0f0');px(gx,gy-1,'#c0ffff');px(gx,gy+1,'#2ab0c0')});
    // the hero: a small original robot that runs and jumps
    const hx=Math.round(cols*.3),jump=Math.max(0,Math.sin(t*2.2))*10,hy=ground-1-Math.round(jump),leg=Math.floor(t*8)%2;
    const R=[[0,-8,'#ffe060'],[0,-7,'#888'],[-2,-6,'#3ad0c0'],[-1,-6,'#3ad0c0'],[0,-6,'#3ad0c0'],[1,-6,'#3ad0c0'],[2,-6,'#3ad0c0'],[-2,-5,'#3ad0c0'],[-1,-5,'#102030'],[0,-5,'#3ad0c0'],[1,-5,'#102030'],[2,-5,'#3ad0c0'],[-2,-4,'#2ab0a0'],[-1,-4,'#2ab0a0'],[0,-4,'#2ab0a0'],[1,-4,'#2ab0a0'],[2,-4,'#2ab0a0'],
      [-2,-3,'#f06a8a'],[-1,-3,'#f06a8a'],[0,-3,'#f06a8a'],[1,-3,'#f06a8a'],[2,-3,'#f06a8a'],[-3,-3,'#3ad0c0'],[3,-3,'#3ad0c0'],[-2,-2,'#f06a8a'],[-1,-2,'#ffe060'],[0,-2,'#f06a8a'],[1,-2,'#f06a8a'],[2,-2,'#f06a8a'],[-1,-1,'#444'],[1,-1,'#444'],[leg?-2:-1,0,'#222'],[leg?2:1,0,'#222']];
    R.forEach(([dx,dy,c])=>px(hx+dx,hy+dy,c));
    for(let i=0;i<6;i++){const cx=((i*23+10-scroll)%140+140)%140,cy=ground-6-(i%2)*4;if(Math.abs(cx-hx)<2&&jump>2)continue;px(cx,cy,(Math.floor(t*6+i)%2)?'#ffd84a':'#fff0a0')}
    x.imageSmoothingEnabled=true;SC.fadeIn(x,W,H,t,.6)}});

addTheme('project',{id:'themepark',name:'Theme Park Fireworks',song:'Disney World park music',pal:['#140c2a','#3a1a5a','#ff6ad0','#5ad0ff','#ffd04a'],
  init(W,H){const r=SC.mk(191);return {fw:[],r,next:0,st:SC.starsInit(r,90)}},
  draw(x,W,H,t,S){const {grad,glow,TAU}=SC;grad(x,W,H,[[0,'#0e0820'],[.7,'#2a1448'],[1,'#3a1a40']]);SC.drawStars(x,S.st,W,H,t,.6,.5);
    if(t>S.next){S.next=t+.5+S.r()*.7;S.fw.push({x:.15+S.r()*.7,y:.15+S.r()*.3,t0:t,c:['#ff6ad0','#5ad0ff','#ffd04a','#9aff6a','#ff8a4a'][Math.floor(S.r()*5)]})}
    x.globalCompositeOperation='lighter';S.fw=S.fw.filter(f=>t-f.t0<2.2);for(const f of S.fw){const k=(t-f.t0)/2.2,r=H*.18*Math.sqrt(k);for(let i=0;i<36;i++){const a=i/36*TAU,xx=f.x*W+Math.cos(a)*r,yy=f.y*H+Math.sin(a)*r+k*k*H*.06;x.globalAlpha=1-k;x.fillStyle=f.c;x.fillRect(xx,yy,W/500+1,W/500+1)}glow(x,f.x*W,f.y*H,r*.6,f.c,.15*(1-k))}x.globalAlpha=1;x.globalCompositeOperation='source-over';
    const cx=W*.72,cy=H*.6,R=H*.24;x.strokeStyle='#1a1030';x.lineWidth=W*.006;x.beginPath();x.moveTo(cx-R*.6,H*.92);x.lineTo(cx,cy);x.lineTo(cx+R*.6,H*.92);x.stroke();x.strokeStyle='rgba(255,220,160,.5)';x.lineWidth=W*.002;x.beginPath();x.arc(cx,cy,R,0,TAU);x.stroke();
    for(let i=0;i<12;i++){const a=i/12*TAU+t*.25;x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+Math.cos(a)*R,cy+Math.sin(a)*R);x.stroke();const c=['#ff6ad0','#5ad0ff','#ffd04a'][i%3];glow(x,cx+Math.cos(a)*R,cy+Math.sin(a)*R,W*.012,c);x.fillStyle=c;x.fillRect(cx+Math.cos(a)*R-W*.008,cy+Math.sin(a)*R,W*.016,H*.02)}
    x.strokeStyle='#1a1030';x.lineWidth=W*.004;x.beginPath();for(let i=0;i<=60;i++){const u=i/60,xx=W*(.02+u*.5),yy=H*(.8-.25*Math.sin(u*Math.PI*2.2)*(1-u*.4));i?x.lineTo(xx,yy):x.moveTo(xx,yy)}x.stroke();
    for(let i=0;i<10;i++)x.fillRect(W*(.03+i*.05),H*.82,W*.003,H*.1);
    const ck=(t*.18)%1,u=ck,xx=W*(.02+u*.5),yy=H*(.8-.25*Math.sin(u*Math.PI*2.2)*(1-u*.4));x.fillStyle='#ffd04a';x.fillRect(xx-W*.012,yy-H*.025,W*.024,H*.02);
    x.fillStyle='#0a0614';x.fillRect(0,H*.92,W,H*.08);for(let i=0;i<30;i++){x.fillStyle=['#ff6ad0','#5ad0ff','#ffd04a'][i%3];x.globalAlpha=.5+.5*Math.sin(t*4+i);x.fillRect(i/30*W,H*.92,W*.01,H*.006)}x.globalAlpha=1;
    SC.vignette(x,W,H,.4);SC.fadeIn(x,W,H,t)}});

addTheme('project',{id:'spacefight',name:'Space Dogfight',song:'Star Wars soundtrack',pal:['#05060f','#121a3a','#ff7a3a','#3ad0ff','#a06aff'],
  init(W,H){const r=SC.mk(203);return {st:Array.from({length:220},()=>({x:r()*2-1,y:r()*2-1,z:r()})),r,bolts:[],booms:[],nb:0}},
  draw(x,W,H,t,S){const {glow,TAU}=SC;x.fillStyle='#04050c';x.fillRect(0,0,W,H);const cx=W/2,cy=H/2;
    for(const s of S.st){s.z-=.004;if(s.z<=.02){s.z=1;s.x=S.r()*2-1;s.y=S.r()*2-1}const k=1/s.z,xx=cx+s.x*W*.5*k*.3,yy=cy+s.y*H*.5*k*.3;if(xx<0||xx>W||yy<0||yy>H)continue;x.fillStyle=`rgba(255,255,255,${Math.min(1,(1-s.z)*1.3)})`;x.fillRect(xx,yy,1+(1-s.z)*2,1+(1-s.z)*2)}
    const pg=x.createRadialGradient(W*.82,H*.78,0,W*.82,H*.78,H*.4);pg.addColorStop(0,'#7a4aa0');pg.addColorStop(.8,'#2a1a4a');pg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=pg;x.beginPath();x.arc(W*.82,H*.78,H*.38,0,TAU);x.fill();
    // original ships: an orange arrowhead chased by two blue crescent fighters
    const hero=[W*(.45+.2*Math.sin(t*.7)),H*(.45+.15*Math.sin(t*1.1))],ha=Math.atan2(Math.cos(t*1.1)*.15*H*1.1,Math.cos(t*.7)*.2*W*.7);
    const arrow=(px,py,a,s)=>{x.save();x.translate(px,py);x.rotate(a);x.fillStyle='#ff8a3a';x.beginPath();x.moveTo(s,0);x.lineTo(-s*.7,-s*.6);x.lineTo(-s*.4,0);x.lineTo(-s*.7,s*.6);x.closePath();x.fill();x.fillStyle='#ffe0b0';x.fillRect(-s*.1,-s*.1,s*.4,s*.2);glow(x,-s*.6,0,s*.6,'rgba(120,200,255,.9)');x.restore()};
    const cres=(px,py,a,s)=>{x.save();x.translate(px,py);x.rotate(a);x.fillStyle='#3ab0ff';x.beginPath();x.arc(0,0,s,-1.2,1.2);x.arc(-s*.45,0,s*.75,1.1,-1.1,true);x.fill();x.fillStyle='#dff4ff';x.beginPath();x.arc(s*.25,0,s*.18,0,TAU);x.fill();glow(x,-s*.5,0,s*.5,'rgba(160,110,255,.8)');x.restore()};
    arrow(hero[0],hero[1],ha,H*.05);
    const ch=[[hero[0]-W*.22-W*.03*Math.sin(t*1.3),hero[1]+H*.1*Math.sin(t*.9)],[hero[0]-W*.3,hero[1]-H*.12+H*.08*Math.cos(t*1.2)]];ch.forEach(([px,py])=>cres(px,py,Math.atan2(hero[1]-py,hero[0]-px),H*.04));
    if(t>S.nb){S.nb=t+.25+S.r()*.3;const c=ch[Math.floor(S.r()*2)];S.bolts.push({x:c[0],y:c[1],a:Math.atan2(hero[1]-c[1],hero[0]-c[0])+(S.r()-.5)*.2,t0:t,c:'#7affb0'});if(S.r()<.5)S.bolts.push({x:hero[0],y:hero[1],a:ha+Math.PI+(S.r()-.5)*.3,t0:t,c:'#ff6a6a'})}
    S.bolts=S.bolts.filter(b=>t-b.t0<1);for(const b of S.bolts){const k=(t-b.t0)*W*.9,bx=b.x+Math.cos(b.a)*k,by=b.y+Math.sin(b.a)*k;x.strokeStyle=b.c;x.lineWidth=H*.006;x.beginPath();x.moveTo(bx,by);x.lineTo(bx-Math.cos(b.a)*W*.04,by-Math.sin(b.a)*W*.04);x.stroke();glow(x,bx,by,H*.02,b.c,.6)}
    const bk=t%5;if(bk<.8){const k=bk/.8;glow(x,W*.25,H*.25,H*.15*k+H*.02,`rgba(255,190,90,${1-k})`)}
    SC.vignette(x,W,H,.5);SC.fadeIn(x,W,H,t)}});

addTheme('project',{id:'icepalace',name:'Ice Crystal Palace',song:'Frozen soundtrack',pal:['#0a1a3a','#1a3a6a','#9ae0ff','#5a7aff','#e0f6ff'],
  init(W,H){const r=SC.mk(217);return {st:SC.starsInit(r,140),sn:Array.from({length:140},()=>({x:r(),y:r(),v:.02+r()*.04,s:r(),p:r()*6})),sp:[[.5,.62,.5],[.38,.46,.32],[.62,.46,.32],[.28,.32,.2],[.72,.32,.2],[.45,.36,.38],[.55,.36,.38]]}},
  draw(x,W,H,t,S){const {grad,glow}=SC;grad(x,W,H,[[0,'#060d24'],[.6,'#15306a'],[1,'#2a5a9a']]);SC.drawStars(x,S.st,W,H,t,.55);
    x.globalCompositeOperation='lighter';for(let i=0;i<=60;i++){const u=i/60,yy=H*(.12+.06*Math.sin(u*6+t*.4)),h=H*.18;const g=x.createLinearGradient(0,yy,0,yy+h);g.addColorStop(0,'rgba(120,200,255,0)');g.addColorStop(.4,'rgba(140,220,255,.16)');g.addColorStop(1,'rgba(120,200,255,0)');x.fillStyle=g;x.fillRect(u*W,yy,W/60+1,h)}x.globalCompositeOperation='source-over';
    x.fillStyle='#cfe6f6';x.beginPath();x.moveTo(0,H*.82);x.quadraticCurveTo(W*.5,H*.74,W,H*.82);x.lineTo(W,H);x.lineTo(0,H);x.fill();
    glow(x,W*.5,H*.55,H*.45,'rgba(150,220,255,.4)');
    S.sp.slice().sort((a,b)=>a[2]-b[2]).forEach(([sx,base,h],i)=>{const bx=sx*W,by=H*base+H*.3,top=by-h*H,w=W*.04*(h+.4);const g=x.createLinearGradient(bx-w,0,bx+w,0);g.addColorStop(0,'#7ab8e8');g.addColorStop(.5,'#e8f8ff');g.addColorStop(1,'#5a90d0');x.fillStyle=g;
      x.beginPath();x.moveTo(bx,top);x.lineTo(bx+w,by-h*H*.25);x.lineTo(bx+w*.8,by);x.lineTo(bx-w*.8,by);x.lineTo(bx-w,by-h*H*.25);x.closePath();x.fill();
      x.strokeStyle='rgba(255,255,255,.6)';x.lineWidth=1;x.beginPath();x.moveTo(bx,top);x.lineTo(bx,by);x.stroke();const sh=(t*.5+i*.3)%2;if(sh<1){x.fillStyle=`rgba(255,255,255,${.6*(1-Math.abs(sh-.5)*2)})`;x.fillRect(bx-w,top+(by-top)*sh,w*2,H*.01)}});
    for(const s of S.sn){const xx=((s.x+Math.sin(t*.8+s.p)*.02)%1)*W,yy=((s.y+t*s.v)%1)*H;x.fillStyle='rgba(255,255,255,.85)';x.fillRect(xx,yy,W/700*(1+s.s*2),W/700*(1+s.s*2))}
    SC.vignette(x,W,H,.45);SC.fadeIn(x,W,H,t)}});

/* ===== channel guide + teach back looks ===== */
const MENU_THEME={id:'menu',name:'Channel Guide',song:"Breakfast at Tiffany's soundtrack · The Entertainer",pal:['#3a3226','#1a1610','#c9a86a','#7a6a4a','#e8d8b0'],grain:true};
const TB_THEME={id:'tb',name:'Intermission',song:"Let's All Go to the Lobby",pal:['#2a2a2a','#0a0a0a','#8a8a8a','#5a5a5a','#c0c0c0'],grain:true,
  draw(x,W,H,t){// classic color bars, a stand-by card, film grain and flicker
    const bars=['#c0c0c0','#c0c000','#00c0c0','#00c000','#c000c0','#c00000','#0000c0'];bars.forEach((c,i)=>{x.fillStyle=c;x.fillRect(i*W/7,0,W/7+1,H*.68)});
    const lo=['#0000c0','#131313','#c000c0','#131313','#00c0c0','#131313','#c0c0c0'];lo.forEach((c,i)=>{x.fillStyle=c;x.fillRect(i*W/7,H*.68,W/7+1,H*.08)});
    x.fillStyle='#1a1a1a';x.fillRect(0,H*.76,W,H*.24);for(let i=0;i<4;i++){x.fillStyle=['#00214c','#fff','#32006a','#131313'][i];x.fillRect(i*W/6,H*.76,W/6,H*.24)}
    for(let i=0;i<W*H/120;i++){x.fillStyle=`rgba(${Math.random()<.5?0:255},${Math.random()<.5?0:255},${Math.random()<.5?0:255},.06)`;x.fillRect(Math.random()*W,Math.random()*H,2,2)}
    if(Math.random()<.1){x.fillStyle='rgba(255,255,255,.08)';x.fillRect(0,0,W,H)}
    const y=(t*.3%1)*H;x.fillStyle='rgba(255,255,255,.05)';x.fillRect(0,y,W,H*.06)}};

/* ================= TV controller: knobs, channels, guide, settings, timer, cutscenes ================= */
document.body.classList.add('tv');
const TV={scheme:recall('sb.scheme','auto'),cutLen:recall('sb.cutLen',4)?4:0,sub:recall('sb.tvsub',{}),theme:null,mode:'task',guideCat:null,cut:null,songIdx:0,songT:0};
const MAIN=['class','skill','project'],CH_BASE={class:100,skill:200,project:300},MAIN_LBL={class:'Class',skill:'Skills',project:'Projects'};
const darkMQ=matchMedia('(prefers-color-scheme: dark)');
function applyScheme(){const s=TV.scheme==='auto'?(darkMQ.matches?'dark':'light'):TV.scheme;document.body.dataset.scheme=s;document.documentElement.dataset.theme=s}
darkMQ.addEventListener?.('change',()=>{applyScheme();renderWork()});
applyScheme();

/* ---------- channels ---------- */
function subsOf(k){
  if(k==='class')return ['Due Date','IS 401','IS 402','IS 403','IS 404'];
  if(k==='skill')return Object.keys(SKILL_TAGS);
  const p=filterOptions('project');return p.length?p:['All'];
}
function curSub(k){const s=subsOf(k);return s.includes(TV.sub[k])?TV.sub[k]:s[0]}
function listFor(k,sub){
  let l=candidates(k).filter(t=>t.status!=='done');
  if(k==='class')return (sub==='Due Date'?l:l.filter(t=>t.course===sub)).sort(byDue);
  if(k==='skill')return l.filter(t=>catOf(t)===sub).sort((a,b)=>byOrder(a,b)||skillLevel(a)-skillLevel(b));
  return sub==='All'?l:l.filter(t=>(t.course||'Other')===sub);
}
function allChannels(k){return k==='class'?listFor('class','Due Date'):subsOf(k).flatMap(s=>listFor(k,s))}
function courseCh(t){const m=t&&typeOf(t)==='class'&&String(t.course||'').match(/(\d{3,4})/);return m?m[1]:''}
function chNum(t){if(!t)return '';if(courseCh(t))return courseCh(t);const k=typeOf(t),i=allChannels(k).findIndex(x=>x.id===t.id);return String(CH_BASE[k]+(i<0?0:i+1))}
function subOfTask(t){const k=typeOf(t);if(k==='class')return curSub('class')==='Due Date'?'Due Date':t.course;if(k==='skill')return catOf(t);return t.course||'Other'}

function ensureSession(){
  if(current||!db||!loaded.state||!loaded.tasks)return;
  const now=Date.now(),k='class',first=listFor(k,curSub(k))[0]||allChannels(k)[0];
  current={startedAt:new Date(now).toISOString(),endAt:null,minutes:0,alloc:{},mood:k,order:CATS.slice(),active:first?.id||null,activeSince:now,timeOn:{},practiced:[],cur:{class:first?.id||null,skill:null,project:null}};
  wrapping=false;coachTurns={};saveState();
}
// an old session whose finish time passed long ago just loses its timer instead of jumping into teach back
function tidySession(){
  if(!current||!current.endAt)return;
  const over=Date.now()-new Date(current.endAt).getTime();
  if(over>2*3600e3&&!current.tbStarted){current.endAt=null;saveState()}
}

/* ---------- themes ---------- */
function pickTheme(k){
  const list=THEMES[k],last=current?.themeId;let pool=list.filter(x=>x.id!==last);if(!pool.length)pool=list;
  return pool[Math.floor(Math.random()*pool.length)];
}
function themeById(id){for(const k of MAIN){const f=THEMES[k].find(x=>x.id===id);if(f)return f}return null}
function activeTheme(){
  if(wrapping)return TB_THEME;
  if(TV.mode==='guide')return MENU_THEME;
  const t=themeById(current?.themeId);if(t&&current&&THEMES[current.mood]?.includes(t))return t;
  return THEMES[current?.mood||'class'][0];
}

/* ---------- tuning to a channel ---------- */
async function tune(id,opts={}){
  if(!current)return;const t=T(id);
  if(!opts.keepGuide)closeSheets();accumulate();
  if(t){const k=typeOf(t);current.mood=k;current.active=id;current.cur[k]=id}else{current.active=null;if(opts.cat)current.mood=opts.cat}
  current.activeSince=Date.now();
  const th=(opts.themeId&&(THEMES[current.mood]||[]).find(x=>x.id===opts.themeId))||pickTheme(current.mood);current.themeId=th.id;
  saveState();
  await staticBurst();
  renderWork();
  if(t&&opts.cut!==false&&TV.mode!=='guide')playCut(th,chNum(t));
}
function turnMain(dir){
  if(!current)return;stopCut();
  const i=MAIN.indexOf(current.mood),k=MAIN[(i+dir+MAIN.length)%MAIN.length];
  current.cur[current.mood]=current.active;
  // back to the task you had open in that category; if there isn't one, open that category's menu
  const keep=current.cur[k],ok=keep&&allChannels(k).some(x=>x.id===keep);
  if(ok){tune(keep,{cat:k,keepGuide:TV.mode==='guide'});return}
  const inGuide=TV.mode==='guide';
  tune(null,{cat:k,keepGuide:true,cut:false});
  if(inGuide){TV.guideCat=k;renderGuide();renderPanel()}else openGuide();
}
function turnSub(dir){
  if(!current)return;stopCut();
  const k=current.mood,s=subsOf(k),i=s.indexOf(curSub(k)),n=s[(i+dir+s.length)%s.length];
  TV.sub[k]=n;store('sb.tvsub',TV.sub);
  const first=listFor(k,n)[0];
  tune(first?first.id:null,{cat:k});
}
// "Done, next" / "Next Skill" move to the next channel on the same sub-channel
async function markDone(id){
  accumulate();const t=T(id);if(!t)return;
  if(isSkill(t)){current.practiced=[...new Set([...(current.practiced||[]),id])]}
  const k=typeOf(t),list=listFor(k,curSub(k)),i=list.findIndex(x=>x.id===id);
  const after=[...list.slice(i+1),...list.slice(0,Math.max(0,i))].find(x=>x.id!==id&&!isDoneNow(x))||allChannels(k).find(x=>x.id!==id&&!isDoneNow(x));
  saveState();
  if(isSkill(t))await guard(()=>db.doc('tasks/'+id).update({lastPracticed:new Date().toISOString(),reps:(t.reps||0)+1}),after?'Nice. On to the next channel.':'That was the last one here.');
  else await guard(()=>db.doc('tasks/'+id).update({status:'done',doneAt:new Date().toISOString()}),after?'Nice. On to the next channel.':'That was the last one here.');
  if(after)tune(after.id);else renderWork();
}
function selectTask(id){tune(id)}

/* ---------- static between channels ---------- */
function staticBurst(){
  if(reduce())return Promise.resolve();
  const crt=$('crt'),cv=$('tv-static'),x=cv.getContext('2d');cv.width=160;cv.height=100;
  crt.classList.add('tuning');const t0=performance.now();
  return new Promise(res=>{const f=ts=>{const img=x.createImageData(160,100);for(let i=0;i<img.data.length;i+=4){const v=Math.random()*255|0;img.data[i]=img.data[i+1]=img.data[i+2]=v;img.data[i+3]=255}
    x.putImageData(img,0,0);if(ts-t0<380)requestAnimationFrame(f);else{crt.classList.remove('tuning');res()}};requestAnimationFrame(f)});
}

/* ---------- cutscene ---------- */
function canvasFit(cv,scale=1){const r=cv.getBoundingClientRect(),dpr=Math.min(1.5,window.devicePixelRatio||1)*scale;const w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}return {W:w,H:h}}
function playCut(th,ch){
  stopCut();if(!TV.cutLen||reduce())return;
  const crt=$('crt'),cv=$('tv-cut'),x=cv.getContext('2d');
  $('cut-ch').textContent=`Now showing · CH ${ch}`;$('cut-name').textContent=th.name;
  crt.classList.add('cut');const {W,H}=canvasFit(cv);const S=th.init?th.init(W,H):{};
  const dur=TV.cutLen*1000,t0=performance.now();
  const c={raf:0,done:false};TV.cut=c;
  const f=ts=>{if(c.done)return;const el=ts-t0;const {W,H}=canvasFit(cv);x.save();th.draw(x,W,H,el/1000,S);x.restore();
    $('cut-bar').style.width=Math.min(100,el/dur*100)+'%';if(el>=dur){stopCut();return}c.raf=requestAnimationFrame(f)};
  c.raf=requestAnimationFrame(f);
}
function stopCut(){const c=TV.cut;if(!c)return;c.done=true;cancelAnimationFrame(c.raf);TV.cut=null;$('crt').classList.remove('cut');$('cut-bar').style.width='0'}
$('cut-skip').onclick=e=>{e.stopPropagation();stopCut()};
$('tv-cut').onclick=()=>stopCut();
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&TV.cut)stopCut()});

/* ---------- ambient background: the theme's colors drifting slowly behind the screen content ---------- */
const AMB={raf:0,last:0};
function ambLoop(ts){
  AMB.raf=requestAnimationFrame(ambLoop);
  if(ts-AMB.last<66)return;AMB.last=ts;
  const cv=$('tv-amb'),{W,H}=canvasFit(cv,.35),x=cv.getContext('2d'),th=activeTheme(),p=th.pal,t=ts/1000;
  const dark=document.body.dataset.scheme==='dark';
  const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,p[0]);g.addColorStop(1,p[1]);x.fillStyle=g;x.fillRect(0,0,W,H);
  for(let i=0;i<3;i++){const c=p[2+i]||p[2];const bx=W*(.5+.38*Math.sin(t*.07+i*2.1)),by=H*(.5+.34*Math.cos(t*.05+i*1.7)),r=Math.max(W,H)*(.45+.1*Math.sin(t*.1+i));
    const rg=x.createRadialGradient(bx,by,0,bx,by,r);rg.addColorStop(0,c);rg.addColorStop(1,'rgba(0,0,0,0)');x.globalAlpha=.55;x.fillStyle=rg;x.fillRect(0,0,W,H)}
  x.globalAlpha=1;
  if(th.grain){for(let i=0;i<W*H/60;i++){x.fillStyle=`rgba(255,255,255,${Math.random()*.08})`;x.fillRect(Math.random()*W,Math.random()*H,1,1)}
    if(Math.random()<.15){x.fillStyle='rgba(255,255,255,.08)';x.fillRect(Math.random()*W,0,1,H)}}
  if(dark){x.fillStyle='rgba(0,0,0,.35)';x.fillRect(0,0,W,H)}
}
if(!reduce())AMB.raf=requestAnimationFrame(ambLoop);else{requestAnimationFrame(ts=>{ambLoop(ts);cancelAnimationFrame(AMB.raf)})}

/* ---------- control panel ---------- */
function knobLabels(){
  const w=$('kw-main'),ang=[-50,0,50],R=66,C=66;
  w.querySelectorAll('.lbl,.tick').forEach(n=>n.remove());
  MAIN.forEach((k,i)=>{const a=ang[i]*Math.PI/180;
    const l=document.createElement('span');l.className='lbl';l.dataset.k=k;l.textContent=MAIN_LBL[k];const P=[{right:'106px',bottom:'101px'},{left:'66px',bottom:'119px',transform:'translateX(-50%)'},{left:'106px',bottom:'101px'}][i];l.style.transform='none';Object.assign(l.style,P);w.appendChild(l);
    const tk=document.createElement('i');tk.className='tick';tk.dataset.k=k;tk.style.transform=`rotate(${ang[i]}deg) translateY(-48px)`;w.appendChild(tk)});
}
knobLabels();
function renderPanel(){
  if(!current)return;const k=current.mood,i=MAIN.indexOf(k),ang=[-50,0,50][i];
  $('knob-main').setAttribute('aria-label',`Channel knob: ${MAIN_LBL[k]}. Click for the next channel, right-click for the previous one`);
  $('kw-main').querySelectorAll('.lbl,.tick').forEach(n=>n.classList.toggle('on',n.dataset.k===k));
  {const dd=$('dial-disc');if(dd){const prev=+(dd.dataset.r||0),want=i*120;let r=prev+((((want-prev)%360)+360)%360);dd.dataset.r=r;dd.style.transform=`rotate(${r}deg)`;$('knob-main').style.transform=`rotate(${r}deg)`}}
  const s=subsOf(k),si=s.indexOf(curSub(k)),n=s.length,spread=n>1?Math.min(240,(n-1)*50):0,sa=n>1?-spread/2+si*spread/(n-1):0;
  const w=$('kw-sub');w.querySelectorAll('.tick').forEach(x=>x.remove());
  s.forEach((_,j)=>{const a=n>1?-spread/2+j*spread/(n-1):0;const tk=document.createElement('i');tk.className='tick'+(j===si?' on':'');tk.style.transform=`rotate(${a}deg) translateY(-50px)`;w.appendChild(tk)});
  $('knob-sub').style.transform=`rotate(${sa}deg)`;$('knob-sub').setAttribute('aria-label',`Sub-channel knob: ${curSub(k)}. Click for the next sub-channel`);
  $('sub-name').textContent=curSub(k);
  $('btn-menu').setAttribute('aria-pressed',String(TV.mode==='guide'));$('btn-set').setAttribute('aria-pressed',String(TV.mode==='settings'));
}
function bindKnob(el,fn){
  el.onclick=e=>{e.preventDefault();fn(e.shiftKey?-1:1)};
  el.oncontextmenu=e=>{e.preventDefault();fn(-1)};
  el.addEventListener('wheel',e=>{e.preventDefault();if(bindKnob.lock)return;bindKnob.lock=true;setTimeout(()=>bindKnob.lock=false,350);fn(e.deltaY>0?1:-1)},{passive:false});
  el.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();fn(1)}else if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();fn(-1)}};
}
bindKnob($('knob-main'),turnMain);bindKnob($('knob-sub'),turnSub);
$('btn-menu').onclick=()=>{if(TV.mode==='guide')closeSheets();else openGuide()};
$('btn-set').onclick=()=>{if(TV.mode==='settings')closeSheets();else openSettings()};

/* ---------- song note by the speaker (music comes later) ---------- */
const OLD_SONGS=['Daisy Bell (Bicycle Built for Two)','Take Me Out to the Ball Game','Shine On, Harvest Moon','By the Light of the Silvery Moon','In the Good Old Summertime','Let Me Call You Sweetheart','Meet Me in St. Louis, Louis'];
function renderSong(){
  let name='';
  if(wrapping){const el=(Date.now()-(current?.tbStarted||Date.now()))/1000;name=el<150?"Let's All Go to the Lobby":'Old-Time Shuffle'}
  else if(TV.mode==='guide')name="Breakfast at Tiffany's";
  else name=(activeTheme().song||'').replace(/\s*soundtracks?$/i,'');
  const ic={prev:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>',next:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg>',
    play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>',pause:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>'};
  const on=!!TV.playing;
  $('song-note').innerHTML=`<b>Now Playing:</b><div class="sn-name" title="${esc(name)}">${esc(name)}</div>
    <div class="sn-ctl"><button type="button" data-sn="prev" aria-label="Previous song">${ic.prev}</button><button type="button" data-sn="play" class="pp" aria-label="${on?'Pause':'Play'}">${on?ic.pause:ic.play}</button><button type="button" data-sn="next" aria-label="Next song">${ic.next}</button></div>`;
}
$('song-note').addEventListener('click',e=>{const b=e.target.closest('[data-sn]');if(!b)return;
  if(b.dataset.sn==='play'){TV.playing=!TV.playing;renderSong()}
  else toast('Song skipping starts working once the music is hooked up.')});
setInterval(()=>{if(wrapping)renderSong()},15000);

/* ---------- timer: set a finish time, it counts down hours:minutes left ---------- */
const SEGS={a:'M6 2h28l-5 6H11z',b:'M35 4v29l-6-5V10z',c:'M35 37v29l-6-5V43z',d:'M6 68h28l-5-6H11z',e:'M5 37v29l6-5V43z',f:'M5 4v29l6-5V10z',g:'M8 35l4-4h16l4 4-4 4H12z'};
const DIG={'0':'abcdef','1':'bc','2':'abged','3':'abgcd','4':'fgbc','5':'afgcd','6':'afgedc','7':'abc','8':'abcdefg','9':'abcdfg','-':'g',' ':''};
function segSvg(str,blink){
  let x=4,out='',ci=-1;
  for(const ch of str){ci++;
    if(ch===':'){out+=`<g class="colon"><rect x="${x+3}" y="22" width="6" height="6" class="seg-on"/><rect x="${x+3}" y="44" width="6" height="6" class="seg-on"/></g>`;x+=16;continue}
    const on=DIG[ch]||'';out+=`<g transform="translate(${x} 0)"${blink&&blink.includes(ci)?' class="blink"':''}>`+Object.keys(SEGS).map(s=>`<path d="${SEGS[s]}" class="${on.includes(s)?'seg-on':'seg-off'}"/>`).join('')+`</g>`;x+=44;
  }
  return `<svg viewBox="0 0 ${x+2} 72" aria-hidden="true">${out}</svg>`;
}
function minsLeft(){return current?.endAt?Math.ceil((new Date(current.endAt)-Date.now())/60000):null}
function renderClock(){
  if(!current)return;if(TV.tEdit!=null)return;const m=minsLeft();
  let s='--:--',cap='Set Timer';
  if(m!=null){const v=Math.max(0,m);s=String(Math.floor(v/60)).padStart(2,'0')+':'+String(v%60).padStart(2,'0');cap=`Ends ${fmtClock(new Date(current.endAt)).replace(/\s?[AP]M$/i,'')}`}
  const up=m!=null&&m<=0&&!wrapping;if(up)cap="Time's up · click";
  $('tv-timer').classList.toggle('live',m!=null&&m>0);$('tv-timer').classList.toggle('expired',up);
  const key=s+cap;if($('tv-timer').dataset.k!==key){$('tv-timer').dataset.k=key;$('tv-timer').innerHTML=segSvg(s)+`<span class="cap">${esc(cap)}</span>`;
    $('tv-timer').setAttribute('aria-label',up?"Time's up. Click to start your session review":m==null?'Timer not set. Click to set your finish time':`${Math.floor(Math.max(0,m)/60)} hours ${Math.max(0,m)%60} minutes left. Click to change`)}

}
setInterval(()=>renderClock(),5000);
$('tv-timer').onclick=e=>{e.stopPropagation();const p=$('timer-pop');if(!p.hidden){p.hidden=true;return}
  let d=current?.endAt?new Date(current.endAt):new Date(Date.now()+60*60000);if(!current?.endAt){d.setMinutes(Math.ceil(d.getMinutes()/5)*5,0,0)}
  $('tp-h').value=((d.getHours()+11)%12)+1;$('tp-m').value=String(d.getMinutes()).padStart(2,'0');p.hidden=false;$('tp-h').focus();$('tp-h').select()};
document.addEventListener('click',e=>{if(!e.target.closest('#timer-pop')&&!e.target.closest('#tv-timer'))$('timer-pop').hidden=true});
function finishFrom(h12,mm){
  const now=Date.now(),cands=[];for(const day of [0,1])for(const add of [0,12]){const d=new Date();d.setDate(d.getDate()+day);d.setHours((h12%12)+add,mm,0,0);if(d.getTime()>now+30000)cands.push(d.getTime())}
  return Math.min(...cands);
}
$('tp-form').onsubmit=e=>{e.preventDefault();if(!current)return;
  const h=Math.max(1,Math.min(12,parseInt($('tp-h').value,10)||0)),m=Math.max(0,Math.min(59,parseInt($('tp-m').value,10)||0));
  const end=finishFrom(h,m);current.endAt=new Date(end).toISOString();current.tbStarted=null;saveState();$('timer-pop').hidden=true;renderClock();
  const left=Math.ceil((end-Date.now())/60000);toast(`Session ends in ${fmtMin(left)}`)};
$('tp-clear').onclick=()=>{if(!current)return;current.endAt=null;saveState();$('timer-pop').hidden=true;renderClock()};
['tp-h','tp-m'].forEach(id=>$(id).addEventListener('focus',e=>e.target.select()));

/* ---------- teach back when the session ends ---------- */
async function startTeachBack(){
  if(!current||wrapping)return;closeSheets();stopCut();accumulate();
  current.tbStarted=Date.now();saveState();
  const crt=$('crt');
  if(!reduce()){crt.classList.add('standby');const cv=$('tv-cut'),x=cv.getContext('2d');crt.classList.add('cut');$('cut-ch').textContent='Your session is over';$('cut-name').textContent='Time to teach it back';
    const t0=performance.now();await new Promise(res=>{const f=ts=>{const {W,H}=canvasFit(cv);TB_THEME.draw(x,W,H,(ts-t0)/1000,{});if(ts-t0<3800)requestAnimationFrame(f);else res()};requestAnimationFrame(f)});
    crt.classList.remove('standby','cut')}
  wrapping=true;renderWork();
}
$('w-end').onclick=()=>startTeachBack();

/* ---------- channel guide (Menu) ---------- */
function openGuide(){stopCut();TV.mode='guide';TV.guideCat=current?.mood||'class';$('tv-settings').classList.remove('open');$('tv-guide').classList.add('open');renderGuide();renderPanel();renderSong()}
function closeSheets(){if(TV.mode==='task')return;TV.mode='task';$('tv-guide').classList.remove('open');$('tv-settings').classList.remove('open');renderPanel();renderSong()}
function renderGuide(){
  const k=TV.guideCat||'class';
  $('guide-tabs').innerHTML=MAIN.map(c=>`<button type="button" data-c="${c}" aria-pressed="${c===k}">${MAIN_LBL[c]}</button>`).join('');
  $('guide-tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{TV.guideCat=b.dataset.c;renderGuide()});
  const subs=k==='class'?['Due Date']:subsOf(k);
  const row=t=>{const ty=typeOf(t),d=ty==='class'&&t.due?dueFor(t):null;
    const meta=ty==='class'?`${esc(t.course||'')}${d?` · <span class="due ${d.cls}">${esc(d.text)}</span>`:''}`:ty==='skill'?`${esc(catOf(t))} · ${esc(t.course||'Other')}`:`${esc(t.course||'')}${t.phase?' · '+esc(t.phase):''}`;
    return `<div class="ch-row${t.status==='done'?' is-done':''}" role="button" tabindex="0" data-tune="${esc(t.id)}" aria-current="${current?.active===t.id}">
      ${ty==='class'?chkBtn(t):'<span class="nochk"></span>'}<span class="num">${chNum(t)}</span>
      <div style="min-width:0"><div class="ttl">${esc(t.title)}</div><div class="meta">${meta}</div></div>
      <div class="side">${ty==='skill'?lvlBox(t):''}${ty==='class'?`<button type="button" class="info" data-info="${esc(t.id)}" aria-label="Details: ${esc(t.title)}" title="Details">i</button>`:''}</div></div>`};
  let h='';
  if(k==='class'){const byC={};listFor('class','Due Date').forEach(t=>{(byC[t.course||'Other']=byC[t.course||'Other']||[]).push(t)});
    const all=listFor('class','Due Date');h=`<div class="guide-sub">All classwork · by due date</div>`+(all.length?all.map(row).join(''):'<p class="muted">Nothing due. Nice.</p>')}
  else h=subs.map(s=>{const l=listFor(k,s);return l.length?`<div class="guide-sub">${esc(s)}</div>${l.map(row).join('')}`:''}).join('')||'<p class="muted">No channels yet.</p>';
  $('guide-body').innerHTML=h;
  $('guide-body').querySelectorAll('[data-tune]').forEach(r=>{const go=()=>{const t=T(r.dataset.tune);if(t){TV.sub[typeOf(t)]=typeOf(t)==='class'?curSub('class'):subOfTask(t);store('sb.tvsub',TV.sub)}TV.mode='task';tune(r.dataset.tune)};
    r.onclick=go;r.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target===r){e.preventDefault();go()}}});
  $('guide-body').querySelectorAll('[data-chk]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleSubmitted(b.dataset.chk).then(()=>renderGuide())});
  $('guide-body').querySelectorAll('[data-info]').forEach(b=>b.onclick=e=>{e.stopPropagation();openTask(b.dataset.info)});
}
$('guide-x').onclick=()=>closeSheets();

/* ---------- settings ---------- */
function openSettings(){stopCut();TV.mode='settings';$('tv-guide').classList.remove('open');$('tv-settings').classList.add('open');renderSettings();renderPanel()}
function renderSettings(){
  const seg=(name,opts,val)=>`<div class="seg" role="group" aria-label="${name}">${opts.map(([v,l])=>`<button type="button" data-${name}="${v}" aria-pressed="${String(v)===String(val)}">${l}</button>`).join('')}</div>`;
  $('set-body').innerHTML=`<div class="set-grid">
    <div class="set-card"><h3>Appearance</h3><p>Light and dark change the room and the screen panels.</p>${seg('scheme',[['auto','Auto'],['light','Light'],['dark','Dark']],TV.scheme)}</div>
    <div class="set-card"><h3>Channel cutscenes</h3><p>The scene that plays when you change channels. Click it or press Esc to skip.</p>${seg('cut',[[4,'On · 4 sec'],[0,'Off']],TV.cutLen)}</div>
    <div class="set-card"><h3>Session</h3><p>${current?.endAt?`Ends at ${esc(fmtClock(new Date(current.endAt)))}. `:'No finish time set. Click the timer to set one. '}End early to go straight to teach back.</p><div class="row"><button class="btn primary" id="set-end">End session &amp; teach back</button></div></div>
    <div class="set-card"><h3>Your work</h3><p>Add classwork, skills or projects, and read past sessions.</p><div class="row"><button class="btn" id="set-add">Add item</button><button class="btn" id="set-log">Learning log</button></div></div>
  </div>`;
  $('set-body').querySelectorAll('[data-scheme]').forEach(b=>b.onclick=()=>{TV.scheme=b.dataset.scheme;store('sb.scheme',TV.scheme);applyScheme();renderSettings()});
  $('set-body').querySelectorAll('[data-cut]').forEach(b=>b.onclick=()=>{TV.cutLen=+b.dataset.cut;store('sb.cutLen',TV.cutLen);renderSettings()});
  $('set-end').onclick=()=>startTeachBack();
  $('set-add').onclick=()=>{closeSheets();openDrawer('add-drawer')};
  $('set-log').onclick=()=>{closeSheets();go('log')};
}
$('set-x').onclick=()=>closeSheets();
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&TV.mode!=='task'&&$('backdrop').hidden&&view!=='log')closeSheets()});

/* ---------- the screen ---------- */
function renderOSD(){
  if(!current)return;const t=T(current.active),k=current.mood;
  $('tv-osd').innerHTML=wrapping?`<span class="ch">CH 000</span><span>TEACH BACK</span><span class="grow"></span>`
    :`<span class="ch">CH ${t?chNum(t):CH_BASE[k]}</span><span>${MAIN_LBL[k].toUpperCase()}</span><span class="sub">· ${esc(curSub(k).toUpperCase())}</span><span class="grow"></span>${t?`<button type="button" id="osd-replay" title="Replay this channel's scene">▶ ${esc(activeTheme().name)}</button>`:''}`;
  if($('osd-replay'))$('osd-replay').onclick=()=>playCut(activeTheme(),chNum(t));
}
function renderWork(){
  if(!current){$('tv-osd').innerHTML='<span class="ch">CH --</span><span>WARMING UP…</span>';return}
  document.body.dataset.mood='tv';
  renderPanel();renderOSD();renderSong();
  $('work-main').hidden=wrapping;$('wrapup').hidden=!wrapping;
  if(TV.mode==='guide')renderGuide();
  if(wrapping){wsMount(null);renderWrap();renderClock();return}
  const t=T(current.active),f=$('focus');
  wsMount(t&&typeOf(t)==='skill'?t:null);if(typeof ppMount==='function')ppMount(t);
  if(typeof ppNoSignal==='function')ppNoSignal(!t);
  if(!t){f.innerHTML=`<div class="chat-title"><h2>No program on this channel</h2></div>`;$('coach-log').innerHTML=`<div class="msg ai">Nothing is scheduled on <b>${esc(MAIN_LBL[current.mood])} · ${esc(curSub(current.mood))}</b>. Turn the sub-channel knob, or press Menu to see every channel.</div>`;$('coach-quick').innerHTML='';$('coach-form').hidden=true;renderClock();return}
  const type=typeOf(t),doneNow=isDoneNow(t);
  const doneBtn=doneNow?(isSkill(t)?`<span class="small" style="color:var(--ok)">Practiced ✓</span>`:`<button class="btn" id="undo-done">Mark not done</button>`)
    :isSkill(t)?(current.wrapUp?.[t.id]?`<button class="btn primary" id="done-btn" title="Save this conversation and move to the next skill">Next Skill</button>`:`<button class="btn primary" id="wrapup-btn" title="Stop practicing and teach back what you know">Wrap Up</button>`)
    :`<button class="btn primary" id="done-btn" title="Mark this assignment done and go back to the channel menu">Done</button>`;
  const head=type==='project'?(t.course||'Project'):t.title;
  f.innerHTML=`<div class="chat-title"><h2 title="${esc(head)}">${esc(head)}</h2></div>
    <div class="row chat-actions">${type==='skill'?`<span class="lvl-wrap">${lvlCtl(t)}</span>`:''}${type==='class'?`<button class="btn ghost" id="info-btn" title="Assignment details">Details</button>`:''}${type==='project'?projModeSeg(t):doneBtn}</div>`;
  if($('done-btn'))$('done-btn').onclick=()=>{if(isSkill(t)){saveSkillChat(t.id);markDone(t.id)}else doneToMenu(t.id)};
  if($('wrapup-btn'))$('wrapup-btn').onclick=()=>{current.wrapUp=Object.assign({},current.wrapUp,{[t.id]:true});saveState();renderWork();
    sendCoach('I\'m ready to wrap up this skill. Stop teaching and quizzing me, and ask me to teach it back to you.','Wrap up: I\'ll teach it back.')};
  if($('undo-done'))$('undo-done').onclick=()=>guard(()=>db.doc('tasks/'+t.id).update({status:'todo',doneAt:null}));
  if($('info-btn'))$('info-btn').onclick=()=>openTask(t.id);
  bindRows(f);renderWsOpen();
  $('coach-wrap').hidden=false;$('coach-form').hidden=!sample;$('coach-quick').innerHTML='';
  renderCoachLog();renderClock();
}

/* ---------- routing: there is only the TV now (plus the learning log on top) ---------- */
function go(v){const h=v==='log'?'log':'';if(location.hash.replace('#','')!==h)location.hash=h;else route()}
function route(){
  const v=location.hash.replace('#','')==='log'?'log':'work';
  view=v==='log'?'log':'work';document.body.dataset.view='work';
  $('view-work').hidden=false;$('view-log').hidden=v!=='log';
  ensureSession();tidySession();
  if(current?.tbStarted&&!TV.tbSeen){TV.tbSeen=true;wrapping=true}
  if(v==='log')renderLog();
  renderWork();
  if(current&&!TV.booted){TV.booted=true;const t=T(current.active);if(t&&!current.themeId){current.themeId=pickTheme(current.mood).id}
    if(t&&!wrapping)playCut(activeTheme(),chNum(t))}
}
function refresh(){if(current&&!CATS.includes(current.mood))migrateSession(current);ensureSession();if(view==='log')renderLog();renderWork()}
$('log-back').onclick=()=>go('work');
window.addEventListener('resize',()=>{renderPanel()});

/* ---------- live picture-tube interference: fine snow, a rolling bar and thin lines drifting down the screen ---------- */
(function(){
  const crt=$('crt'),cv=document.createElement('canvas');cv.id='tv-noise';cv.setAttribute('aria-hidden','true');crt.insertBefore(cv,crt.querySelector('.crt-fx'));
  const x=cv.getContext('2d'),NW=240,NH=150,nz=document.createElement('canvas');nz.width=NW;nz.height=NH;const nx=nz.getContext('2d'),img=nx.createImageData(NW,NH);
  let last=0,lines=[],bars=[{p:0,speed:1/9,h:.12,a:.05},{p:.55,speed:1/23,h:.05,a:.03}];
  const fill=()=>{const d=img.data;for(let i=0;i<d.length;i+=4){const v=Math.random()*255|0;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255}nx.putImageData(img,0,0)};
  function frame(ts){
    requestAnimationFrame(frame);
    if(document.hidden||ts-last<41)return;const dt=Math.min(.1,(ts-last)/1000);last=ts;
    const {W,H}=canvasFit(cv,.6);x.clearRect(0,0,W,H);
    if(reduce())return;
    const busy=crt.classList.contains('cut');
    fill();x.imageSmoothingEnabled=false;
    // overall snow, faint so the screen stays readable
    x.globalAlpha=busy?.035:(document.body.dataset.scheme==='dark'?.026:.016);x.drawImage(nz,0,0,W,H);
    // rolling bars: brighter, noisier strips that crawl from top to bottom
    for(const b of bars){b.p=(b.p+dt*b.speed)%1.25;const cy=(b.p-.12)*H,bh=b.h*H;
      const g=x.createLinearGradient(0,cy-bh,0,cy+bh);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,`rgba(245,245,245,${b.a})`);g.addColorStop(1,'rgba(255,255,255,0)');
      x.globalAlpha=1;x.fillStyle=g;x.fillRect(0,cy-bh,W,bh*2);
      x.globalAlpha=b.a;x.drawImage(nz,0,(Math.random()*NH*.6)|0,NW,(NH*.25)|0,0,cy-bh*.5,W,bh);
      const dg=x.createLinearGradient(0,cy+bh,0,cy+bh*2.2);dg.addColorStop(0,'rgba(0,0,0,0)');dg.addColorStop(.5,`rgba(0,0,0,${b.a*.9})`);dg.addColorStop(1,'rgba(0,0,0,0)');
      x.globalAlpha=1;x.fillStyle=dg;x.fillRect(0,cy+bh,W,bh*1.2)}
    // thin broken interference lines falling down the tube
    if(Math.random()<.08)lines.push({y:-.02,v:.12+Math.random()*.5,a:.06+Math.random()*.09,h:Math.random()<.7?1:2,seed:Math.random()});
    x.globalAlpha=1;lines=lines.filter(l=>l.y<1.03);
    for(const l of lines){l.y+=l.v*dt;const yy=l.y*H;let xx=0;
      while(xx<W){const seg=W*(.03+Math.random()*.22),gap=W*Math.random()*.06;x.fillStyle=`rgba(${Math.random()<.5?255:220},255,${Math.random()<.5?255:225},${l.a*(.4+Math.random()*.6)})`;x.fillRect(xx,yy,seg,l.h*(W/900+.6));xx+=seg+gap}
      x.fillStyle=`rgba(0,0,0,${l.a*.6})`;x.fillRect(0,yy+l.h*2,W,1)}
    // occasional full-screen flicker
    if(Math.random()<.03){x.fillStyle='rgba(255,255,255,.015)';x.fillRect(0,0,W,H)}
    x.imageSmoothingEnabled=true;
  }
  requestAnimationFrame(frame);
})();

/* ---------- the Menu: a cable-style listings grid for Class, an on-demand option menu for Skills and Projects ---------- */
TV.gSel=TV.gSel||{};TV.gOff=null;TV.gFilter='All';TV.gHover=null;
const GD_COURSE_NAMES={'IS 401':'Product Management','IS 402':'Database','IS 404':'Infrastructure','IS 403':'Javascript'};
const gdYmd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const gdVis=()=>{const w=$('crt').getBoundingClientRect().width;return w<600?2:w<1000?3:4};
function gdClock(){
  if(current?.mood==='class'){const t=T(TV.gSel.class);if(!t)return '';if(!t.due)return 'No due date';const d=dueAt(t)||parseDay(t.due);return `Due ${d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})} · ${fmtClock(d)}`}
  const d=new Date();return `${d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})} · ${fmtClock(d)}`}
function gdCourses(){const all=candidates('class');return [...new Set(['IS 401','IS 402','IS 404','IS 403',...all.map(t=>t.course).filter(Boolean)])]}
function gdDays(){
  const all=candidates('class'),today=gdYmd(new Date());let lo=today,hi=gdYmd(new Date(Date.now()+6*864e5));
  all.forEach(t=>{if(!t.due)return;if(t.status!=='done'&&t.due<lo)lo=t.due;if(t.due>hi)hi=t.due});
  const out=[],d=parseDay(lo);while(gdYmd(d)<=hi&&out.length<120){out.push(gdYmd(d));d.setDate(d.getDate()+1)}
  if(all.some(t=>!t.due))out.push('none');return out;
}
function gdCellItems(course,day){return candidates('class').filter(t=>(t.course||'Other')===course&&(day==='none'?!t.due:t.due===day)).sort((a,b)=>(a.dueTime||'23:59').localeCompare(b.dueTime||'23:59'))}
function gdShortTime(hm){if(!hm)return '11:59p';const [h,m]=hm.split(':').map(Number);return `${(h%12)||12}:${String(m).padStart(2,'0')}${h<12?'a':'p'}`}
function gdDefaultSel(k){
  const s=TV.gSel[k];
  if(k==='class'){const all=candidates('class');if(s&&all.some(t=>t.id===s))return s;const a=T(current?.active);if(a&&typeOf(a)==='class')return a.id;return (listFor('class','Due Date')[0]||all[0])?.id||null}
  if(k==='skill'){const l=gdSkills();if(s&&l.some(t=>t.id===s))return s;const a=T(current?.active);if(a&&typeOf(a)==='skill'&&l.some(t=>t.id===a.id))return a.id;return l[0]?.id||null}
  const p=gdProjects();if(s&&p.includes(s))return s;const a=T(current?.active);if(a&&typeOf(a)==='project')return a.course||p[0];return p[0]||null;
}
/* in the Skills menu the category is already shown, so "Python for Data" under Data reads as just "Python" */
/* menu shows a simple stage instead of the 1–5 level: 1–2 NEW, 3–4 LEARNED, 5 MASTERED */
function lvlTag(t){return LVL_TAG(skillLevel(t))}
function skShort(t){const c=catOf(t)||'';const q=c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const r=String(t.title||'').replace(new RegExp('\\s+for\\s+'+q+'$','i'),'').replace(new RegExp('\\s*\\('+q+'\\)$','i'),'');return r||t.title}
function gdFilt(){const subs=subsOf('skill');if(!subs.includes(TV.gFilter)){const a=T(current&&current.cur&&current.cur.skill);TV.gFilter=a&&subs.includes(catOf(a))?catOf(a):subs[0]}return TV.gFilter}
function gdSkills(){const all=allChannels('skill'),f=gdFilt();return all.filter(t=>catOf(t)===f)}
function gdProjects(){return subsOf('project').filter(p=>p!=='All')}

function gdInfoHTML(k){
  const sel=TV.gSel[k];
  if(k==='class'){const t=T(sel);if(!t)return `<div class="gd-sel"><div class="gd-t">Nothing listed</div></div><div class="gd-desc">Add classwork from Settings and it shows up here on its due date.</div><div class="gd-det-row"><button type="button" class="btn ghost gd-det gd-past" data-act="past">Past Assignments</button></div>`;
    const d=dueFor(t),done=t.status==='done';
    return `<div class="gd-sel"><div class="gd-t">${esc(t.title)}</div></div>
      <div class="gd-desc">${esc(d.text)}${done?' · submitted':''}${t.goal?` — by the end, explain ${esc(t.goal)}.`:''}</div>
      <div class="gd-det-row"><button type="button" class="btn ghost gd-det gd-past" data-act="past">Past Assignments</button><button type="button" class="btn gd-det" data-act="info">Details</button></div>
      <div class="gd-acts">${done?'':`<button type="button" class="btn primary" data-act="tune">Tune in ▸</button>`}<button type="button" class="btn" data-act="sub">${done?'Mark not submitted':'Mark submitted'}</button><button type="button" class="btn ghost" data-act="info">Details</button></div>`}
  if(k==='skill'){const t=T(sel);if(!t)return `<div class="gd-sel"><div class="gd-t">No skills here</div></div><div class="gd-desc">Pick another category, or add a skill from Settings.</div>`;
    const n=skillLevel(t);
    return `<div class="gd-sel"><div class="gd-t">${esc(skShort(t))}</div></div>
      <div class="gd-desc">${esc(catOf(t))} · ${lvlTag(t)} · ${esc(agoLabel(t.lastPracticed))}${t.goal?` — ${esc(t.goal.charAt(0).toUpperCase()+t.goal.slice(1))}.`:''}</div>
      <div class="gd-acts"><button type="button" class="btn primary" data-act="tune">Open chat ▸</button></div>`}
  const p=sel;if(!p)return `<div class="gd-sel"><div class="gd-t">No projects yet</div></div><div class="gd-desc">Add a project task from Settings.</div>`;
  const l=listFor('project',p);
  const ps=((settings&&settings.projectSkills)||{})[p]||[];
  return `<div class="gd-sel"><div class="gd-t">${esc(p)}</div></div>
    <div class="gd-pskills">${ps.length?esc(ps.join(', ')):'<span class="gd-psk none">Skills not listed yet</span>'}</div>
    <div class="gd-desc">${l.length?`Up next: ${esc(l[0].title)}${l[1]?` · then ${esc(l[1].title)}`:''}`:'No open tasks. Open it anyway and plan the next step with AI coach.'}</div>
    <div class="gd-acts"><button type="button" class="btn primary" data-act="tune">Work on it ▸</button></div>`;
}
function gdBindInfo(k){
  const box=$('gd-info-sel');if(!box)return;
  box.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{const a=b.dataset.act,sel=TV.gSel[k];
    if(a==='tune')gdTune(k,sel);
    else if(a==='sub')toggleSubmitted(sel).then(()=>renderGuide());
    else if(a==='info')openTask(sel);
    else if(a==='past')openPast()});
}
function gdPickPip(k){const list=THEMES[k]||THEMES.class,cur=TV.pipPick;let n=list[Math.floor(Math.random()*list.length)];if(list.length>1)while(n.id===cur)n=list[Math.floor(Math.random()*list.length)];TV.pipPick=n.id;const s=document.querySelector('#tv-guide .gd-pip span');if(s)s.textContent=`CH ${gdPipCh(k)} · ${n.name}`}
function gdPipCh(k){return (k==='class'&&courseCh(T(TV.gSel[k])))||CH_BASE[k]}
function gdSetSel(k,v,rerender){
  const chg=k==='class'&&TV.gSel[k]!==v;
  TV.gSel[k]=v;if(chg)gdPickPip(k);
  document.querySelectorAll('#tv-guide [data-gid]').forEach(b=>b.classList.toggle('sel',b.dataset.gid===v));
  const box=$('gd-info-sel');if(box){box.innerHTML=gdInfoHTML(k);gdBindInfo(k)}
  const ck=$('gd-clock');if(ck)ck.textContent=gdClock();
}
function gdTune(k,sel){
  if(k==='project'){const l=listFor('project',sel);TV.sub.project=sel;store('sb.tvsub',TV.sub);closeSheets();
    if(l[0])tune(l[0].id);else{tune(null,{cat:'project'});toast(`No open tasks in ${sel} yet. Add one from Settings.`)}return}
  const t=T(sel);if(!t)return;
  TV.sub[k]=k==='class'?curSub('class'):subOfTask(t);store('sb.tvsub',TV.sub);const pip=k==='class'&&TV.pipPick&&(THEMES[k]||[]).some(x=>x.id===TV.pipPick)?TV.pipPick:null;closeSheets();tune(sel,pip?{themeId:pip}:{});
}

function renderGuide(){
  const g=$('tv-guide');if(!g||!current)return;
  const k=current.mood;TV.gSel[k]=gdDefaultSel(k);
  const keepScroll=g.querySelector('.gd-pills')?.scrollTop||0;
  const th=themeById(current.themeId)||THEMES[k][0];
  const what=k==='class'?'Classwork':k==='skill'?'Skills':'Projects';
  let body='',hint='';
  if(k==='class'){
    const days=gdDays(),N=Math.min(gdVis(),days.length),courses=gdCourses(),today=gdYmd(new Date());
    if(TV.gOff==null){const ti=days.indexOf(today);TV.gOff=ti<0?0:ti}
    TV.gDays=days;TV.gN=N;
    TV.gWide=TV.gWide||new Set();
    const maxN=d=>Math.max(0,...courses.map(c=>gdCellItems(c,d).length));
    const W=days.map(d=>TV.gWide.has(d)&&maxN(d)>2?Math.max(1.5,maxN(d)/2+.25):1);TV.gW=W;
    // expanding/collapsing never moves the view: the left-most day stays put and the wide day grows to the right
    TV.gFocus=null;TV.gOff=Math.max(0,Math.min(TV.gOff,gdMaxOff()));
    const tot=W.reduce((s,x)=>s+x,0),tr=`width:${tot/N*100}%;transform:translateX(-${gdOffPct()}%)`;
    const cwOf=j=>`width:${W[j]/tot*100}%`;
    const dayLbl=d=>{if(d==='none')return 'NO DATE';const x=parseDay(d);const s=`${x.toLocaleDateString(undefined,{weekday:'short'}).toUpperCase()} ${x.getMonth()+1}/${x.getDate()}`;return d===today?`TODAY <small>${x.getMonth()+1}/${x.getDate()}</small>`:s};
    body=`<div class="gd-grid" id="gd-grid">
      <div class="gd-row gd-hdr"><div class="gd-ch"><button type="button" data-slide="-1" aria-label="Earlier days">◀</button><button type="button" data-today>Today</button></div>
        <div class="gd-vp"><div class="gd-track" style="${tr}">${days.map((d,j)=>`<div class="gd-day${d===today?' today':''}" style="${cwOf(j)}">${dayLbl(d)}</div>`).join('')}</div></div>
        <div class="gd-end"><button type="button" data-slide="1" aria-label="Later days">▶</button></div></div>
      ${courses.map((c,i)=>`<div class="gd-row"><div class="gd-ch"><b>${esc(c)}</b><small>${esc(GD_COURSE_NAMES[c]||('CH '+(101+i)))}</small></div>
        <div class="gd-vp"><div class="gd-track" style="${tr}">${days.map((d,j)=>{const all=gdCellItems(c,d),wide=TV.gWide.has(d),items=all.length>2&&!wide?all.slice(0,2):all;
          const more=all.length>2?(wide?`<button type="button" class="gd-more-btn" data-less="${d}" aria-label="Show fewer">&lt;</button>`:`<button type="button" class="gd-more-btn" data-more="${d}" aria-label="Show ${all.length-2} more">+${all.length-2}</button>`):'';
          return `<div class="gd-cell${d===today?' today':''}" style="${cwOf(j)}">${items.length?items.map(t=>{const late=t.status!=='done'&&dueAt(t)&&dueAt(t)<new Date();
            return `<button type="button" class="gd-prog${t.id===TV.gSel.class?' sel':''}${t.status==='done'?' done':''}${late?' late':''}" data-gid="${esc(t.id)}" title="${esc(t.title)}"><span class="pt">${esc(t.title)}</span><small>${d==='none'?'ANYTIME':gdShortTime(t.dueTime)}</small></button>`}).join('')+more:'<span class="gd-empty"></span>'}</div>`}).join('')}</div></div>
        <div class="gd-end"></div></div>`).join('')}
    </div>`;
    hint='Slide ◀ ▶ through the days · click a show twice to tune in';
  }else{
    const opts=k==='skill'?gdSkills():gdProjects();
    const filt=k==='skill'?`<div class="gd-filt" role="group" aria-label="Category">${(gdFilt(),subsOf('skill')).map(c=>`<button type="button" data-filt="${c}" aria-pressed="${TV.gFilter===c}">${c}</button>`).join('')}</div>`:'';
    const pills=opts.length?opts.map(o=>k==='skill'
      ?`<button type="button" class="gd-pill${o.id===TV.gSel.skill?' sel':''}" data-gid="${esc(o.id)}" title="${esc(o.title)}"><span class="pn">${esc(skShort(o))}</span><i class="lv">${lvlTag(o)}</i></button>`
      :`<button type="button" class="gd-pill${o===TV.gSel.project?' sel':''}" data-gid="${esc(o)}"><span class="pn">${esc(o)}</span></button>`).join('')
      :`<p class="gd-none">Nothing on demand here yet.</p>`;
    body=`<div class="gd-menu">${filt}<div class="gd-pills" id="gd-pills">${pills}</div><div class="gd-more" id="gd-more"></div></div>`;
    hint=k==='skill'?'Pick a skill to open its chat with AI coach':'Pick a project, then plan the work with AI coach';
  }
  g.innerHTML=`<button type="button" class="gd-x" id="gd-x">EXIT ✕</button>
    <div class="gd-top"><div class="gd-info"><div class="gd-brand"><span class="gd-logo">Session<b>TV</b></span><span class="gd-what">${what}</span><span class="gd-clock" id="gd-clock">${gdClock()}</span></div><div id="gd-info-sel" style="display:flex;flex-direction:column;gap:6px">${gdInfoHTML(k)}</div></div>
      <div class="gd-pip"><canvas id="gd-pip"></canvas><span>CH ${gdPipCh(k)} · ${esc(((TV.pipPick&&(THEMES[k]||[]).find(x=>x.id===TV.pipPick))||th).name)}</span></div></div>
    <div class="gd-body">${body}</div>
    <div class="gd-ad"><b>Session TV</b><span>${hint}</span></div>`;
  $('gd-x').onclick=()=>closeSheets();gdBindInfo(k);
  g.querySelectorAll('[data-more],[data-less]').forEach(b=>b.onclick=e=>{e.stopPropagation();const d=b.dataset.more||b.dataset.less;if(b.dataset.more){TV.gWide.add(d);TV.gFocus=d}else{TV.gWide.delete(d);TV.gFocus=null}renderGuide()});
  g.querySelectorAll('[data-gid]').forEach(b=>{
    // first click shows it on the info board, a second click on the same one tunes in (every menu)
    b.onclick=()=>{const v=b.dataset.gid;if(TV.gSel[k]!==v){gdSetSel(k,v);return}gdTune(k,v)};
    b.onfocus=()=>{if(b.matches(':focus-visible'))gdSetSel(k,b.dataset.gid)};
  });
  g.querySelectorAll('[data-filt]').forEach(b=>b.onclick=()=>{TV.gFilter=b.dataset.filt;TV.gSel.skill=null;renderGuide()});
  g.querySelectorAll('[data-slide]').forEach(b=>b.onclick=()=>gdSlide(+b.dataset.slide));
  g.querySelector('[data-today]')?.addEventListener('click',()=>{const i=TV.gDays.indexOf(gdYmd(new Date()));gdSlideTo(i<0?0:i)});
  const pl=$('gd-pills');if(pl){pl.scrollTop=keepScroll;const more=()=>{$('gd-more').textContent=pl.scrollTop+pl.clientHeight<pl.scrollHeight-4?'▼':''};pl.onscroll=more;requestAnimationFrame(more)}
  if(k==='class')gdArrows();
  gdSwipe();gdPip();
}
/* furthest you can slide: the last start day that still fills the screen (wide days count for more) */
function gdMaxOff(){const W=TV.gW||[],N=TV.gN||3;let i=W.length-1,sum=0;
  while(i>=0){sum+=W[i];if(sum>=N-.01)return i;i--}return 0}
function gdOffPct(){const W=TV.gW||[],tot=W.reduce((s,x)=>s+x,0)||1;return W.slice(0,TV.gOff||0).reduce((s,x)=>s+x,0)/tot*100}
function gdSlideTo(i){
  TV.gOff=Math.max(0,Math.min(i,gdMaxOff()));
  document.querySelectorAll('#tv-guide .gd-track').forEach(tr=>tr.style.transform=`translateX(-${gdOffPct()}%)`);gdArrows();
}
function gdSlide(n){gdSlideTo((TV.gOff||0)+n)}
function gdArrows(){const days=TV.gDays||[],N=TV.gN||3;const p=document.querySelector('#tv-guide [data-slide="-1"]'),n=document.querySelector('#tv-guide [data-slide="1"]');if(p)p.disabled=TV.gOff<=0;if(n)n.disabled=TV.gOff>=gdMaxOff()}
function gdSwipe(){
  const grid=$('gd-grid');if(!grid)return;let x0=null;
  grid.onpointerdown=e=>{if(e.pointerType!=='mouse')x0=e.clientX};
  grid.onpointerup=e=>{if(x0==null)return;const dx=e.clientX-x0;x0=null;if(Math.abs(dx)>40)gdSlide(dx<0?1:-1)};
  // one swipe = one day: a trackpad swipe keeps sending scroll events (momentum) after the fingers lift,
  // so a swipe only counts once, and the next one waits until those events have stopped
  grid.onwheel=e=>{
    if(Math.abs(e.deltaX)<=Math.abs(e.deltaY))return;e.preventDefault();
    const W=TV.gWh||(TV.gWh={acc:0,used:false,t:0}),d=Math.abs(e.deltaX),dir=Math.sign(e.deltaX),now=e.timeStamp;
    clearTimeout(W.t);W.t=setTimeout(()=>{W.acc=0;W.used=false},140);
    if(W.used){
      // after a day moves, ignore the rest of that swipe (the finger part and the coasting after it).
      // A smoothed speed is tracked; a new swipe only counts once the coasting has faded to under half its peak
      // and the movement then surges well above the smoothed speed (or turns around).
      const prev=W.ema,surge=W.fading&&d>prev*2&&d>12,flip=W.fading&&dir!==W.dir&&d>8;
      W.ema=prev*.7+d*.3;W.peak=Math.max(W.peak,W.ema);if(W.ema<W.peak*.5)W.fading=true;
      if(now-W.at>250&&(surge||flip)){W.used=false;W.acc=0}else return;
    }
    W.acc+=e.deltaX;
    if(Math.abs(W.acc)>30){W.used=true;W.dir=dir;W.at=now;W.ema=d;W.peak=d;W.fading=false;gdSlide(W.acc>0?1:-1)}
  };
}
// keyboard: arrows move through the listings or the menu, Enter tunes in
document.addEventListener('keydown',e=>{
  if(TV.mode!=='guide'||!current||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter'].includes(e.key))return;
  if(e.target.closest&&e.target.closest('input,textarea,select'))return;
  const k=current.mood,sel=TV.gSel[k];
  if(e.key==='Enter'){if(e.target.closest&&e.target.closest('button'))return;e.preventDefault();if(sel)gdTune(k,sel);return}
  e.preventDefault();
  if(k==='class'){
    const t=T(sel),courses=gdCourses(),days=TV.gDays||[];
    if(!t){gdSlide(e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0);return}
    const dayOf=x=>x.due?days.indexOf(x.due):days.length-1;
    const row=c=>days.flatMap(d=>gdCellItems(c,d));
    let next=null;
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){const r=row(t.course||'Other'),i=r.findIndex(x=>x.id===t.id);next=r[i+(e.key==='ArrowRight'?1:-1)];if(!next){gdSlide(e.key==='ArrowRight'?1:-1);return}}
    else{const ci=courses.indexOf(t.course||'Other');for(let j=ci+(e.key==='ArrowDown'?1:-1);j>=0&&j<courses.length;j+=(e.key==='ArrowDown'?1:-1)){const r=row(courses[j]);if(r.length){const di=dayOf(t);next=r.slice().sort((a,b)=>Math.abs(dayOf(a)-di)-Math.abs(dayOf(b)-di))[0];break}}}
    if(next){gdSetSel(k,next.id);const di=dayOf(next),N=TV.gN||3;if(di<TV.gOff)gdSlideTo(di);else if(di>=TV.gOff+N)gdSlideTo(di-N+1);document.querySelector(`#tv-guide [data-gid="${CSS.escape(next.id)}"]`)?.focus({preventScroll:true})}
    return;
  }
  const btns=[...document.querySelectorAll('#tv-guide .gd-pill')];if(!btns.length)return;
  const cols=getComputedStyle($('gd-pills')).gridTemplateColumns.split(' ').length;
  let i=btns.findIndex(b=>b.dataset.gid===sel);if(i<0)i=0;
  i+= e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:e.key==='ArrowDown'?cols:-cols;
  i=Math.max(0,Math.min(btns.length-1,i));btns[i].focus();btns[i].scrollIntoView({block:'nearest'});
});
// the picture-in-picture preview plays the channel's scene in the corner
function gdPip(){
  if(TV.pip)return;const loop=ts=>{
    if(TV.mode!=='guide'||!current){TV.pip=0;return}
    TV.pip=requestAnimationFrame(loop);if(ts-(TV.pipLast||0)<55)return;TV.pipLast=ts;
    const cv=$('gd-pip');if(!cv||!cv.offsetWidth)return;
    const th=(TV.pipPick&&themeById(TV.pipPick)&&(THEMES[current.mood]||[]).some(x=>x.id===TV.pipPick)?themeById(TV.pipPick):null)||themeById(current.themeId)||THEMES[current.mood][0];const {W,H}=canvasFit(cv,.8);
    if(TV.pipTh!==th.id||TV.pipW!==W){TV.pipTh=th.id;TV.pipW=W;TV.pipS=th.init?th.init(W,H):{};TV.pipT0=ts-8000}
    const x=cv.getContext('2d');x.save();th.draw(x,W,H,(ts-TV.pipT0)/1000,TV.pipS);x.restore();
    const c=$('gd-clock');if(c&&ts-(TV.clkLast||0)>1000){TV.clkLast=ts;c.textContent=gdClock()}
  };TV.pip=requestAnimationFrame(loop);
}
addEventListener('resize',()=>{if(TV.mode==='guide'&&current?.mood==='class'&&gdVis()!==TV.gN)renderGuide()});


/* ---------- timer editing right on the display: click, the dashes flash, type the finish time ---------- */
TV.tEdit=null;
const tIn=document.createElement('input');
Object.assign(tIn,{id:'timer-in',type:'text',inputMode:'numeric',autocomplete:'off',className:'timer-in',maxLength:4});
tIn.setAttribute('aria-label','Finish time: type hours then minutes, like 430 for 4:30, then press Enter');
$('tv-timer').parentElement.appendChild(tIn);
function drawTimerEdit(){
  const pad=('----'+TV.tEdit).slice(-4),s=pad.slice(0,2)+':'+pad.slice(2);
  const blink=[0,1,3,4].filter((ci,j)=>pad[j]==='-');
  const t=$('tv-timer');t.classList.remove('live');t.classList.add('editing');t.dataset.k='';
  t.innerHTML=segSvg(s,blink)+`<span class="cap">Type Finish Time</span>`;
}
function timerEditStart(){if(!current)return;$('timer-pop').hidden=true;TV.tEdit='';tIn.value='';tIn.focus({preventScroll:true});drawTimerEdit()}
function timerEditEnd(){TV.tEdit=null;$('tv-timer').classList.remove('editing');$('tv-timer').dataset.k='';if(document.activeElement===tIn)tIn.blur();renderClock()}
function timerBad(){TV.tEdit='';tIn.value='';drawTimerEdit();const t=$('tv-timer');t.classList.remove('bad');void t.offsetWidth;t.classList.add('bad')}
/* a 3-digit time that no 4th digit could turn into a valid time (e.g. 4:30) is accepted right away */
function timerFinal3(d){if(d.length!==3)return false;const h=+d[0],mm=+d.slice(1);if(h<1||mm>59)return false;
  const could4=d[0]==='1'&&'012'.includes(d[1])&&+d[2]<=5;return !could4}
function timerCommit(){
  const b=TV.tEdit;if(b==null)return;
  if(!b){if(current.endAt){current.endAt=null;saveState();toast('Timer cleared')}timerEditEnd();return}
  if(b.length<3){timerBad();return}
  const hh=+b.slice(0,-2),mm=+b.slice(-2);
  if(hh<1||hh>12||mm>59){timerBad();return}
  const end=finishFrom(hh,mm);current.endAt=new Date(end).toISOString();current.tbStarted=null;saveState();timerEditEnd();
  toast(`Session ends in ${fmtMin(Math.ceil((end-Date.now())/60000))}`);
}
tIn.addEventListener('input',()=>{if(TV.tEdit==null)return;const d=tIn.value.replace(/\D/g,'').slice(-4);tIn.value=d;TV.tEdit=d;drawTimerEdit();if(d.length===4||timerFinal3(d))timerCommit()});
tIn.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();timerCommit()}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();timerEditEnd()}});
tIn.addEventListener('blur',()=>{if(TV.tEdit==null)return;if(TV.tEdit.length>=3)timerCommit();else timerEditEnd()});
$('tv-timer').addEventListener('mousedown',e=>{if(TV.tEdit!=null)e.preventDefault()});
$('tv-timer').onclick=e=>{e.stopPropagation();if(TV.tEdit!=null){timerEditEnd();if(!wrapping)startTeachBack();return}
  if($('tv-timer').classList.contains('expired')){$('tv-timer').classList.remove('expired');startTeachBack();return}
  timerEditStart()};

/* ---------- boot ---------- */
draft=Object.assign(draft,recall('sb.draft2',{}));
if(draft.alloc&&(draft.alloc.skill==null||'practice' in draft.alloc)){draft.alloc=null;draft.manualAlloc=false;draft.order=null} // plan saved before Skills became one category
{const mins=draft.end?Math.round((endDate()-Date.now())/60000):0;if(!draft.end||mins<15||mins>12*60){draft.end=defaultEnd();draft.manualAlloc=false}}
draft.order=setSeq(draft.order);
tabs=Object.assign(tabs,recall('sb.tabs2',{}));if(!['class','project'].includes(tabs.left))tabs.left='class';
route();
(async()=>{
  const c=window.sessionPlatform;
  if(!c){$('flow').innerHTML='<div class="muted small">The local board could not start. Please reload.</div>';return}
  const [d,s]=await Promise.all([c.use('db'),c.use('sample')]);db=d;sample=s;
  if(!db){$('flow').innerHTML='<div class="muted small">Please allow browser storage and reload.</div>';return}
  const slow=setTimeout(()=>{if(!loaded.tasks)$('flow').innerHTML='<div class="muted small">Still waiting for your tasks. Check your connection.</div>'},10000);
  db.collection('tasks').onSnapshot(snap=>{
    {const all=snap.docs.map(x=>({id:x.id,...x.data()}));archived=all.filter(t=>t.status==='archived');tasks=all.filter(t=>t.status!=='archived')}
    if(!snap.metadata.fromCache||tasks.length){loaded.tasks=true;clearTimeout(slow)}
    refresh();
  },()=>{loaded.tasks=true;clearTimeout(slow);refresh()});
  db.collection('sessions').orderBy('date','desc').limit(200).onSnapshot(snap=>{sessions=snap.docs.map(x=>({id:x.id,...x.data()}));loaded.sessions=true;if(view==='log')renderLog()},()=>{loaded.sessions=true});
  db.doc('state/current').onSnapshot(snap=>{
    if(snap.metadata.hasPendingWrites)return;
    const remote=snap.exists?snap.data():null;
    if(remote&&(!current||current.startedAt!==remote.startedAt))current=JSON.parse(JSON.stringify(remote)); // stored docs are read-only; work on a copy
    if(!remote&&current&&!switching&&loaded.state)current=null;
    if(current){current.timeOn=current.timeOn||{};current.cur=current.cur||{};current.practiced=current.practiced||[];current.alloc=current.alloc||{};migrateSession(current)}
    loaded.state=true;route();
  },()=>{loaded.state=true;route()});
  db.doc('settings/main').onSnapshot(snap=>{settings=snap.exists?snap.data():{};if(view==='work')renderWork()},()=>{});
})();
// a session started before the redesign: fold Skill Practice + Skill Development into Skills, moods into pages
function migrateSession(c){
  if(CATS.includes(c.mood)&&c.alloc.practice==null&&c.alloc.develop==null)return;
  const a=c.alloc;c.alloc={class:a.class||0,skill:(a.skill||0)+(a.practice||0)+(a.develop||0),project:a.project||0};
  const ord=[];(c.order||DEFAULT_ORDER).map(mapOldCat).forEach(k=>{if(CATS.includes(k)&&!ord.includes(k))ord.push(k)});CATS.forEach(k=>{if(!ord.includes(k))ord.push(k)});c.order=ord;
  const act=T(c.active);c.mood=act?typeOf(act):mapOldCat(c.mood);if(!CATS.includes(c.mood))c.mood='class';
  c.cur={class:null,skill:null,project:null,[c.mood]:c.active||null};
}
// refresh() lives in the TV controller
