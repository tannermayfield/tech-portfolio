/* Assignment and skill controls shared by the menu, the chat header and My Database. */
function lvlBox(t){const n=skillLevel(t);return `<span class="lvl-box" style="--lc:${LVL_COLORS[n]}" title="${LVL_NAMES[n]}" aria-label="${LVL_NAMES[n]}">${LVL_TAG(n)}</span>`}
function lvlCtl(t){
  const n=skillLevel(t);
  return `<span class="lvl"><button type="button" class="lvl-box" style="--lc:${LVL_COLORS[n]}" data-lvlopen="${esc(t.id)}" data-write="disable" aria-haspopup="true" aria-expanded="false" title="${LVL_NAMES[n]}. Click to change" aria-label="Your stage on ${esc(t.title)}: ${LVL_NAMES[n]}. Change">${LVL_TAG(n)}</button>
    <span class="lvl-pop" role="radiogroup" aria-label="Pick your level" hidden>${[1,2,3,4].map(i=>`<button type="button" style="--lc:${LVL_COLORS[i]}" data-lvl="${esc(t.id)}" data-n="${i}" data-write role="radio" aria-checked="${i===n}" title="${LVL_NAMES[i]}">${LVL_TAG(i)}</button>`).join('')}</span></span>`;
}
document.addEventListener('click',e=>{if(!e.target.closest('.lvl'))document.querySelectorAll('.lvl-pop:not([hidden])').forEach(x=>{x.hidden=true;x.previousElementSibling?.setAttribute('aria-expanded','false')})});
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.lvl-pop:not([hidden])').forEach(x=>x.hidden=true)});
// submitted work keeps a plain due date: no red/amber urgency and no "late"
function dueFor(t){const d=dueLabel(t);if(t.status!=='done')return d;return {cls:'',text:d.text.replace(/\s*·\s*(late|overdue)\b.*$/i,'').replace(/^(late|overdue)\s*·\s*/i,'')}}
// the skill stage control (lvlCtl) in the chat header
function bindRows(root){
  root.querySelectorAll('[data-lvl]').forEach(b=>b.onclick=()=>setLevel(b.dataset.lvl,+b.dataset.n));
  root.querySelectorAll('[data-lvlopen]').forEach(b=>b.onclick=()=>{const pop=b.nextElementSibling,open=pop.hidden;document.querySelectorAll('.lvl-pop').forEach(x=>x.hidden=true);pop.hidden=!open;b.setAttribute('aria-expanded',String(open));if(open)pop.querySelector('[aria-checked="true"]')?.focus()});
}
/* assignment details popup, with an Edit form */
let tdId=null;
function openTask(id,edit){
  const t=T(id);if(!t)return;tdId=id;const done=t.status==='done',d=t.due?dueFor(t):null,lead=leadOf(t);
  let canvasLink='';try{const url=new URL(t.canvas?.url);if(url.origin==='https://byu.instructure.com'&&!url.username&&!url.password)canvasLink=url.href}catch{}
  let start='';if(t.due){const s=parseDay(t.due);s.setDate(s.getDate()-lead);start=fmtDay(s)}
  $('td-view').innerHTML=`<div class="td-head"><h3 id="td-title">${esc(t.title)}</h3><button type="button" class="btn ghost td-x" id="td-close">Close</button></div>
    <dl class="td-rows">
      <dt>Course</dt><dd>${esc(t.course||'—')}</dd>
      <dt>Due</dt><dd>${esc(fmtDue(t))}${d&&!done&&d.cls?` <span class="due ${d.cls}">${esc(d.text)}</span>`:''}</dd>
      <dt>Start early</dt><dd>${lead} day${lead===1?'':'s'} ahead${start?` <span class="muted">(shows as due soon from ${esc(start)})</span>`:''}</dd>
      <dt>Status</dt><dd>${done?`<span style="color:var(--ok)">✓ Submitted</span>${t.doneAt?` <span class="muted">${esc(new Date(t.doneAt).toLocaleDateString(undefined,{month:'short',day:'numeric'}))}</span>`:''}`:'Not submitted'}</dd>
      ${t.description?`<dt>Instructions</dt><dd class="assignment-instructions">${esc(t.description)}</dd>`:''}
      ${Array.isArray(t.skills)&&t.skills.length?`<dt>Skills</dt><dd>${esc(t.skills.join(', '))}</dd>`:''}
      ${t.points!==undefined&&t.points!==''?`<dt>Points</dt><dd>${esc(t.points)}</dd>`:''}
      ${t.canvas?`<dt>Source</dt><dd>Canvas · submission status updates on sync${canvasLink?` · <a href="${esc(canvasLink)}" target="_blank" rel="noopener noreferrer">Open in Canvas</a>`:''}</dd>`:''}
    </dl>
    <div class="dd-btns"><button type="button" class="btn ghost" id="td-edit" data-write>Edit</button><button type="button" class="btn primary" id="td-sub" data-write>${done?'Mark not submitted':'Mark submitted'}</button></div>`;
  if(TV.tdPast===id){const x=$('td-close');x.textContent='← Back';x.setAttribute('aria-label','Back to past assignments');x.onclick=()=>{TV.tdPast=null;openPast()}}
  else $('td-close').onclick=()=>$('task-dlg').close();
  $('td-sub').hidden=!!t.canvas;
  $('td-sub').onclick=()=>{toggleSubmitted(id);setTimeout(()=>openTask(id),50)};
  $('td-edit').onclick=()=>openTask(id,true);
  $('td-view').hidden=!!edit;$('td-form').hidden=!edit;
  if(edit){$('td-t').value=t.title||'';$('td-course').value=t.course||'';$('td-lead').value=lead;$('td-due').value=t.due||'';$('td-time').value=t.dueTime||'';fillCourseList()}
  if(!$('task-dlg').open)$('task-dlg').showModal();
  (edit?$('td-t'):t.canvas?$('td-close'):$('td-sub')).focus();
}
// the Course suggestions are the user's own classes, not a built-in list
function fillCourseList(){const dl=$('td-courses');if(dl)dl.innerHTML=gdCourses().map(c=>`<option value="${esc(c)}">${esc(courseLabel(c))}</option>`).join('')}
// after a failed save, redraw the details popup if it is showing that assignment
function reopenTask(id){if($('task-dlg').open&&tdId===id)openTask(id,!$('td-form').hidden)}
$('task-dlg').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close()});
$('task-dlg').addEventListener('close',()=>{TV.tdPast=null});
$('td-cancel').onclick=()=>openTask(tdId);
$('td-form').onsubmit=async e=>{
  e.preventDefault();const id=tdId,t=T(id);if(!t)return;
  const lead=$('td-lead').value===''?1:Math.max(0,Math.min(21,Math.round(+$('td-lead').value)));
  const patch={title:$('td-t').value.trim()||t.title,course:$('td-course').value.trim(),due:$('td-due').value||null,dueTime:$('td-due').value?($('td-time').value||'23:59'):null,leadDays:lead};
  const before=Object.fromEntries(Object.keys(patch).map(k=>[k,t[k]]));
  Object.assign(t,patch);refresh();openTask(id);
  await guard(()=>db.doc('tasks/'+id).update(patch),'Assignment updated',()=>{Object.assign(t,before);refresh();reopenTask(id)});
};
async function toggleSubmitted(id){
  const t=T(id);if(!t)return;const done=t.status!=='done';
  const patch=done?{status:'done',doneAt:new Date().toISOString()}:{status:'todo',doneAt:null};
  const before={status:t.status,doneAt:t.doneAt};
  Object.assign(t,patch);refresh(); // move it right away; the database snapshot confirms it
  return guard(()=>db.doc('tasks/'+id).update(patch),done?'Marked submitted':'Moved back to unsubmitted',()=>{Object.assign(t,before);refresh();reopenTask(id)});
}
async function setLevel(id,n){
  const t=T(id);if(!t||skillLevel(t)===n&&t.level!=null)return;
  if(t.skillChannel){SessionSkills.setLevel(id,n);refresh();return} // a skill's level is the skill's own, not a tool record's
  const before=t.level;
  t.level=n;refresh(); // show it right away; the database snapshot confirms it
  return guard(()=>db.doc('tasks/'+id).update({level:n}),null,()=>{t.level=before;refresh()});
}

// Done on an assignment: mark it done and go back to the channel menu
async function doneToMenu(id){
  const t=T(id);if(!t)return;accumulate();saveState();
  if(typeOf(t)==='class'&&TV.gSel.class===id)TV.gSel.class=null;
  openGuide();
  await guard(()=>db.doc('tasks/'+id).update({status:'done',doneAt:new Date().toISOString()}),'Marked done.');
  if(TV.gSel.class===id){const nx=candidates('class').find(x=>x.id!==id);TV.gSel.class=nx?nx.id:null}
  if(TV.mode==='guide')renderGuide();
}

/* past assignments, newest first */
function pastAssignments(){
  return tasks.filter(t=>t.status==='done'&&typeOf(t)==='class')
    .sort((a,b)=>(b.doneAt||'').localeCompare(a.doneAt||''));
}
function openPast(){
  const list=pastAssignments(),ol=$('pa-list');
  const when=iso=>{if(!iso)return 'Done';const d=new Date(iso);return 'Done '+fmtDay(d)+' · '+fmtClock(d)};
  ol.innerHTML=list.length?list.map(t=>`<li><button type="button" class="pa-row" data-id="${esc(t.id)}"><span class="pa-t">${esc(t.title)}</span><span class="pa-m"><span>${esc(t.course||'Other')}</span><span>${esc(when(t.doneAt))}</span></span></button></li>`).join('')
    :'<li class="pa-empty">Nothing marked done yet. Finished assignments show up here, newest first.</li>';
  ol.querySelectorAll('.pa-row').forEach(b=>b.onclick=()=>{TV.tdPast=b.dataset.id;openTask(b.dataset.id)});
  $('pa-close').onclick=()=>$('past-dlg').close();
  $('past-dlg').showModal();
}
