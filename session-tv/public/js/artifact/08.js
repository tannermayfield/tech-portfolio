/* project chat modes: Plan · Learn · Work */
const PROJ_MODES=[['plan','Plan'],['apply','Apply'],['work','Work']];
Object.assign(COACH_RULES,{
  proj_plan:'MODE: PLAN. Do not build, write, or edit any part of the project itself. Help him plan: decide what to do next, break work into tasks, set goals, reorder priorities, and spot risks or missing steps. Ask clarifying questions. Use Scrum: work in sprints (usually 1-2 weeks) with one clear sprint goal and a small set of tasks that achieve it. Help him write the sprint goal, choose and size tasks for the sprint, and review progress like a sprint review/retro. To set the sprint goal, put it on its own line as: SPRINT_GOAL: <goal>. To add an existing task to the sprint: SPRINT_ADD: <id>. When you propose a new task, put it on its own line exactly as: ADD_TASK: <task title> | <goal: what he should be able to explain after>. When you propose changing an existing task, use its id from the task list: EDIT_TASK: <id> | <new title> | <new goal>. He will click a button to apply each one, so only include ones you actually recommend.',
  proj_apply:'MODE: APPLY. He is building this himself to practice what he is learning in class and in his skills. Do NOT write his project code, configs, queries or content. Give only hints, nudges, questions, small conceptual explanations and minor suggestions, starting with the smallest useful hint. Tiny generic syntax examples are fine. Ask what he has tried and have him explain his choices. Point out which of his skills or class topics apply.',
  proj_work:'MODE: WORK. You do most of the work: write and edit the code, queries, configs or content for the project directly, in full, in the main reply. Put your teaching in a separate block that the app shows in a side panel: wrap it exactly as <teach>...</teach>. Inside it, explain what you did and why, the key lines and decisions, and the concepts behind them, in plain language. Keep the main reply focused on the work itself. When you finish a chunk of work, quiz him with 1-3 short questions about what you just did (why this approach, what a line does, what would break if...) and check his answers before moving on.'
});
function projMode(t){const n=t&&(t.course||'Project');const m=(current&&current.projModes&&current.projModes[n])||'apply';return m==='learn'?'apply':m}
function projModeSeg(t){const m=projMode(t);return `<div class="seg pm-seg" role="group" aria-label="Chat mode">${PROJ_MODES.map(([v,l])=>`<button type="button" data-pmode="${v}" aria-pressed="${v===m}">${l}</button>`).join('')}</div>`}
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('[data-pmode]');if(!b)return;
  const t=T(current&&current.active);if(!t)return;const n=t.course||'Project';
  current.projModes=Object.assign({},current.projModes,{[n]:b.dataset.pmode});saveState();renderWork();
});
// plan-mode suggestions: ADD_TASK / EDIT_TASK lines become buttons
TV.pApplied=TV.pApplied||new Set();
const _fmtMsg=fmtMsg;
fmtMsg=function(text,ai){
  if(!ai)return _fmtMsg(text,ai);
  const acts=[];
  const clean=String(text).replace(/^[ \t]*(ADD_TASK|EDIT_TASK):[ \t]*(.+)$/gim,(m,k,rest)=>{acts.push([k.toUpperCase(),rest.split('|').map(x=>x.trim())]);return ''}).replace(/\n{3,}/g,'\n\n').trim();
  let html=_fmtMsg(clean,ai);
  if(acts.length)html+=`<div class="pa-acts">${acts.map(([k,a])=>{const key=k+':'+a.join('|'),done=TV.pApplied.has(key);
    if(k==='ADD_TASK')return `<div class="pa-act"><span><b>New task:</b> ${esc(a[0]||'')}${a[1]?` <span class="muted">· ${esc(a[1])}</span>`:''}</span><button type="button" class="btn" data-pact="${esc(key)}" ${done?'disabled':''}>${done?'Added ✓':'Add task'}</button></div>`;
    const ot=T(a[0]);return `<div class="pa-act"><span><b>Edit:</b> ${esc(ot?ot.title:a[0])} → ${esc(a[1]||'')}${a[2]?` <span class="muted">· ${esc(a[2])}</span>`:''}</span><button type="button" class="btn" data-pact="${esc(key)}" ${done||!ot?'disabled':''}>${done?'Updated ✓':ot?'Apply edit':'Task not found'}</button></div>`}).join('')}</div>`;
  return html;
};
document.addEventListener('click',async e=>{
  const b=e.target.closest&&e.target.closest('[data-pact]');if(!b||b.disabled)return;
  const key=b.dataset.pact,i=key.indexOf(':'),k=key.slice(0,i),a=key.slice(i+1).split('|');
  const t=T(current&&current.active);if(!t)return;const name=t.course||'Project';
  b.disabled=true;
  if(k==='ADD_TASK'){const order=Math.max(0,...tasks.filter(x=>typeOf(x)==='project').map(x=>x.order||0))+1;
    const doc={track:'project',title:a[0]||'New task',course:name,goal:a[1]||'',status:'todo',order};if(isPipe(doc))doc.phase='Other';
    await guard(()=>db.collection('tasks').add(doc));b.textContent='Added ✓'}
  else{const id=a[0],upd={};if(a[1])upd.title=a[1];if(a[2])upd.goal=a[2];await guard(()=>db.doc('tasks/'+id).update(upd));b.textContent='Updated ✓'}
  TV.pApplied.add(key);
});
