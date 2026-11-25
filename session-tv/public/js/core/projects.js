/* ---------- projects: the project chat (Plan · Apply · Work) and its side panel task board ---------- */
function projectTasks(name){return tasks.filter(x=>typeOf(x)==='project'&&(x.course||'Other')===name).sort(byOrder)}
function projectIntro(t){
  const name=t.course||'Project',all=projectTasks(name),open=all.filter(x=>x.status!=='done'),ps=projectSkills(name);
  return `<div class="msg ai intro"><div class="ai-name">${CLAUDE_MARK} AI coach</div>This is your <b>${esc(name)}</b> chat. Everything about this project happens here. ${({plan:'<b>Plan</b> mode: we list the project\'s tasks and assign each one to you or Codex on the right; no building.',apply:'<b>Apply</b> mode: you build your tasks yourself and attach the skills you use on the right; I only give hints and small suggestions.',work:'<b>Work</b> mode: I do the building here, and explain and teach it on the right as I go, then quiz you.'})[projMode(t)]}${ps.length?`<br><br>Skills applied: ${esc(ps.join(', '))}.`:''}<br><br>${open.length?`Next up: <b>${esc(open[0].title)}</b>. `:''}${all.length-open.length} of ${all.length} tasks done.${sample?' Tell me what you want to work on, ask for help, or explain what you built and I\'ll push back.':'<br><br><span class="muted">AI coaching is optional. See Settings → AI Connections for connection status.</span>'}</div>`;
}
function projectCtx(t){
  const name=t.course||'Project',all=projectTasks(name),open=all.filter(x=>x.status!=='done'),done=all.filter(x=>x.status==='done'),ps=projectSkills(name);
  return `\nCurrent project: ${name}. This is the single chat for the whole project; help with whatever part he brings up.${ps.length?`\nSkills he has applied in finished Apply tasks (most-used first): ${ps.join(', ')}.`:''}\nOpen tasks in order:\n${open.slice(0,12).map((x,i)=>`${i+1}. [id ${x.id}] ${x.title}${x.goal?` (goal: explain ${x.goal})`:''}`).join('\n')||'none'}${done.length?`\nAlready done: ${done.map(x=>x.title).join('; ')}`:''}${projExtraCtx(t)}`;
}

/* project chat modes: Plan · Learn · Work */
const PROJ_MODES=[['plan','Plan'],['apply','Apply'],['work','Work']];
Object.assign(COACH_RULES,{
  proj_plan:'Help organize the project into a simple ordered task list and assign each task to Me or Codex. Do not add dates, points or estimates. Do not implement files.',
  proj_apply:'MODE: APPLY. He is building this himself to practice what he is learning in class and in his skills. Do NOT write his project code, configs, queries or content. Give only hints, nudges, questions, small conceptual explanations and minor suggestions, starting with the smallest useful hint. Tiny generic syntax examples are fine. Ask what he has tried and have him explain his choices. Point out which of his skills or class topics apply.',
  proj_work:'MODE: WORK. You do most of the work: write and edit the code, queries, configs or content for the project directly, in full, in the main reply. Put your teaching in a separate block that the app shows in a side panel: wrap it exactly as <teach>...</teach>. Inside it, explain what you did and why, the key lines and decisions, and the concepts behind them, in plain language. Keep the main reply focused on the work itself. When you finish a chunk of work, quiz him with 1-3 short questions about what you just did (why this approach, what a line does, what would break if...) and check his answers before moving on.'
});
function projMode(t){const n=t&&(t.course||'Project');const m=(current&&current.projModes&&current.projModes[n])||'apply';return m==='learn'?'apply':m}
function projModeSeg(t){const m=projMode(t);return `<div class="seg pm-seg" role="group" aria-label="Chat mode">${PROJ_MODES.map(([v,l])=>`<button type="button" data-pmode="${v}" aria-pressed="${v===m}">${l}</button>`).join('')}</div>`}
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('[data-pmode]');if(!b)return;
  const t=T(current&&current.active);if(!t)return;const n=t.course||'Project';
  current.projModes=Object.assign({},current.projModes,{[n]:b.dataset.pmode});saveState();renderWork();
  setTimeout(()=>{const t=T(current&&current.active);if(t)ppMount(t)},0); // the mode switch re-renders the panel
});
// plan-mode suggestions: fmtMsg turns ADD_TASK / EDIT_TASK lines into these buttons
TV.pApplied=TV.pApplied||new Set();
function projectActions(acts){
  if(!acts.length)return '';
  return `<div class="pa-acts">${acts.map(([k,a])=>{const key=k+':'+a.join('|'),done=TV.pApplied.has(key);
    if(k==='ADD_TASK')return `<div class="pa-act"><span><b>New task:</b> ${esc(a[0]||'')}${a[1]?` <span class="muted">· ${esc(a[1])}</span>`:''}</span><button type="button" class="btn" data-pact="${esc(key)}" ${done?'disabled':''}>${done?'Added ✓':'Add task'}</button></div>`;
    const ot=T(a[0]);return `<div class="pa-act"><span><b>Edit:</b> ${esc(ot?ot.title:a[0])} → ${esc(a[1]||'')}${a[2]?` <span class="muted">· ${esc(a[2])}</span>`:''}</span><button type="button" class="btn" data-pact="${esc(key)}" ${done||!ot?'disabled':''}>${done?'Updated ✓':ot?'Apply edit':'Task not found'}</button></div>`}).join('')}</div>`;
}
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

/* ---------- project side panel: Plan assigns tasks, Apply and Work show the Me and Codex backlogs ---------- */
const PROJ={data:{},sub:false};
const pslug=n=>String(n||'project').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'project';
function projData(n){return PROJ.data[pslug(n)]||{}}
(function sub(){if(PROJ.sub)return;if(!db){setTimeout(sub,500);return}PROJ.sub=true;
  try{db.collection('projects').onSnapshot(snap=>{const o={};snap.docs.forEach(d=>o[d.id]=d.data());PROJ.data=o;const t=T(current&&current.active);if(t&&typeOf(t)==='project')renderWork();if(TV.mode==='guide'&&current?.mood==='project')renderGuide();if(TV.mode==='settings'&&TV.dbView==='projects')renderSettings()},()=>{})}catch(e){}})();
async function projSave(n,patch){const id=pslug(n),cur=PROJ.data[id]||{},next=Object.assign({},cur,patch,{name:n});PROJ.data[id]=next;
  const t=T(current&&current.active);if(t)ppRender(t);
  await guard(()=>db.doc('projects/'+id).set(next));}
function ppMount(t){
  const on=!!(t&&typeOf(t)==='project'&&!wrapping);
  $('pp').hidden=!on;if(!on){$('pp-detail').hidden=true;$('work-mid').classList.remove('pp-on');return}
  $('work-mid').classList.add('split');$('work-mid').classList.add('pp-on');
  ppRender(t);
}
function ppRender(t){
  if($('pp').hidden)return;const n=t.course||'Project',m=projMode(t);
  $('pp').dataset.mode=m;$('pp-body').classList.remove('pp-fit');const _mid=document.querySelector('#pp .pp-mid'),_st=_mid?_mid.scrollTop:0;
  projectPanel(t,n,m);
  {const m2=document.querySelector('#pp .pp-mid');if(m2&&_st)m2.scrollTop=_st}
  ppSyncHead();
}
// keep the panel header exactly as tall as the chat header beside it
function ppSyncHead(){const f=$('focus'),h=document.querySelector('#pp .pp-head');if(!f||!h||$('pp').hidden)return;h.style.height='';h.style.minHeight='';requestAnimationFrame(()=>{const fh=f.getBoundingClientRect().height,hh=h.getBoundingClientRect().height;const H=Math.max(fh,hh);h.style.height=H+'px';if(hh<fh)return;f.style.minHeight=H+'px'})}
addEventListener('resize',()=>ppSyncHead());

// older project records keep their task owners in retired planning data (pd.sprint / pd.past); read-only
function spItems(sp){return (sp&&sp.items||[]).map(x=>typeof x==='string'?{id:x,pts:0}:x).filter(x=>x&&x.id)}

/* task board: each task is assigned to Me, Codex or nobody, in a saved order.
   projectPanel draws it for a mode: plan (assign tasks), apply (my backlog) or work (the Codex backlog). */
function projectPanel(task,name,mode){return SessionTV.hooks.run('project:panel',arguments,projectBoard)}
function boardItems(name){const pd=projData(name),owners=new Map();for(const sprint of [...(pd.past||[]),pd.sprint].filter(Boolean))for(const item of spItems(sprint))if(item.who)owners.set(item.id,item.who);const order=pd.taskOrder||[];return projectTasks(name).filter(task=>task.status!=='archived').map(task=>({task,who:Object.hasOwn(pd.taskAssignments||{},task.id)?pd.taskAssignments[task.id]:owners.get(task.id)||''})).sort((a,b)=>{const x=order.indexOf(a.task.id),y=order.indexOf(b.task.id);return (x<0?1e9:x)-(y<0?1e9:y)||byOrder(a.task,b.task)})}
function boardAssign(name,id){if(SessionWorkspace.readOnly)return;const row=boardItems(name).find(row=>row.task.id===id);if(!row)return;const next={'':'me',me:'ai',ai:''};return projSave(name,{taskAssignments:{...(projData(name).taskAssignments||{}),[id]:next[row.who]||''}})}
// a task's skills are saved as skill record ids (older tasks may hold skill titles)
function projSkillTitle(value){const skill=T(value);if(skill)return typeOf(skill)==='skill'?String(skill.title||'').trim():'';return String(value||'').trim()}
/* A project's skills: every skill attached to its completed Apply tasks (the tasks assigned to Me), most-used first.
   The Projects menu and Settings → Projects both read this. */
function projectSkills(name){
 const counts=new Map();
 for(const {task,who} of boardItems(name)){if(who!=='me'||task.status!=='done')continue;for(const title of new Set((Array.isArray(task.skills)?task.skills:[]).map(projSkillTitle)))if(title)counts.set(title,(counts.get(title)||0)+1)}
 return [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([title])=>title);
}
function projectBoard(task,name,mode){
 const body=$('pp-body'),context=name+'|'+mode,draft=body.dataset.backlogContext===context?$('pp-new')?.value||'':'';body.dataset.backlogContext=context;body.classList.remove('pp-fit');const rows=boardItems(name).filter(row=>mode==='plan'||row.who===(mode==='apply'?'me':'ai'));
 $('pp-title').textContent=mode==='plan'?'Assign tasks':mode==='apply'?'Apply backlog':'Work backlog';$('pp-acts').replaceChildren();
 body.innerHTML='<div class="pp-th"><span>Tasks</span><span>'+rows.filter(row=>row.task.status==='done').length+'/'+rows.length+' done</span></div><div class="pp-mid"><ol class="pp-tl project-task-table">'+rows.map(({task:x,who},index)=>'<li data-iid="'+esc(x.id)+'" class="'+(x.status==='done'?'done':'')+'"><span class="pp-n" tabindex="0" role="button" title="Drag or use arrow keys to reorder" aria-label="Reorder '+esc(x.title)+'">'+(index+1)+'</span><span class="pp-tt">'+esc(x.title)+'</span>'+(mode==='plan'?'<button type="button" class="pp-pill'+(!who?' empty':'')+'" data-assign-task="'+esc(x.id)+'" aria-label="Assign '+esc(x.title)+': '+(who==='me'?'Me':who==='ai'?'Codex':'Assign')+'">'+(who==='me'?'Me':who==='ai'?'Codex':'Assign')+'</button><button type="button" class="pp-x" data-remove-task="'+esc(x.id)+'" aria-label="Remove '+esc(x.title)+'">×</button>':'')+'</li>').join('')+'</ol>'+(!rows.length?'<div class="pp-empty">'+(mode==='plan'?'Add a task below.':'Assign tasks to '+(mode==='apply'?'Me':'Codex')+' in Plan.')+'</div>':'')+(mode==='plan'?'<form class="pp-new" id="project-task-create"><input id="pp-new" class="pp-in" placeholder="Create a new task" aria-label="New project task" maxlength="300" required autocomplete="off"><button class="btn" type="submit">Add</button></form>':'')+'</div>';
 const disabled=SessionWorkspace.readOnly||SessionWorkspace.mode==='demo';body.querySelectorAll('button,input').forEach(control=>control.disabled=disabled);
 body.querySelectorAll('[data-assign-task]').forEach(button=>button.onclick=()=>boardAssign(name,button.dataset.assignTask));
 body.querySelectorAll('[data-remove-task]').forEach(button=>button.onclick=()=>guard(()=>db.doc('tasks/'+button.dataset.removeTask).update({status:'archived'})));
 if(mode==='plan'&&!disabled){$('pp-new').value=draft;ppDragInit(body.querySelector('ol'),order=>projSave(name,{taskOrder:order}));$('project-task-create').onsubmit=async event=>{event.preventDefault();const input=$('pp-new'),title=input.value.trim();if(!title)return;input.value='';const id='p'+crypto.randomUUID(),order=Math.max(0,...projectTasks(name).map(task=>task.order||0))+1;await guard(()=>db.doc('tasks/'+id).set({track:'project',title,course:name,goal:'',status:'todo',order}));$('pp-new')?.focus()};}
}
function projExtraCtx(task){const name=task.course||'Project',mode=projMode(task);return '\nTask assignment board:\n'+boardItems(name).map(({task,who})=>'['+task.id+'] '+task.title+' | '+(who==='me'?'Me':who==='ai'?'Codex':'Unassigned')+' | '+task.status+' | Skills: '+(task.skills||[]).map(projSkillTitle).filter(Boolean).join(', ')).join('\n')+'\n'+(mode==='apply'?'Coach the user through Me tasks with hints; do not implement their work.':mode==='work'?'Implement Codex tasks and explain your changes. Do not implement Me tasks unless the user explicitly asks.':'Help organize tasks and choose whether Me or Codex should own each task. Do not implement files.');}
globalThis.SessionProjectBacklogs={items:boardItems,assign:boardAssign};

/* drag the number to reorder tasks */
function ppDragInit(ol,onDone){
  if(!ol)return;
  const scroller=el=>{for(let e=el;e&&e!==document.body;e=e.parentElement){const o=getComputedStyle(e).overflowY;if((o==='auto'||o==='scroll')&&e.scrollHeight>e.clientHeight)return e}return null};
  ol.querySelectorAll('li[data-iid] .pp-n').forEach(h=>{
    h.onpointerdown=e=>{
      if(e.button!==0)return;e.preventDefault();
      const li=h.closest('li'),rows=[...ol.querySelectorAll('li[data-iid]')],from=rows.indexOf(li),sc=scroller(ol);
      const sTop=()=>sc?sc.scrollTop:0,top0=sTop();
      const tops=rows.map(r=>{const b=r.getBoundingClientRect();return {top:b.top+top0,h:b.height}});
      let lastY=e.clientY,to=from,raf=0;const y0=e.clientY+top0;
      li.classList.add('dragging');h.setPointerCapture(e.pointerId);
      const place=()=>{const cy=lastY+sTop(),dy=cy-y0;li.style.transform=`translateY(${dy}px)`;
        const mid=tops[from].top+tops[from].h/2+dy;to=tops.findIndex(r=>mid<r.top+r.h/2);if(to<0)to=rows.length-1;
        const H=tops[from].h;rows.forEach((r,i)=>{if(r===li)return;let s=0;if(from<to&&i>from&&i<=to)s=-H;if(from>to&&i<from&&i>=to)s=H;r.style.transform=s?`translateY(${s}px)`:''})};
      const tick=()=>{raf=0;if(!sc)return;const b=sc.getBoundingClientRect(),edge=44;let v=0;
        if(lastY<b.top+edge)v=-Math.ceil((b.top+edge-lastY)/4);else if(lastY>b.bottom-edge)v=Math.ceil((lastY-(b.bottom-edge))/4);
        if(v){const before=sc.scrollTop;sc.scrollTop+=Math.max(-18,Math.min(18,v));if(sc.scrollTop!==before)place();raf=requestAnimationFrame(tick)}};
      const move=ev=>{lastY=ev.clientY;place();if(!raf)raf=requestAnimationFrame(tick)};
      const up=()=>{cancelAnimationFrame(raf);raf=0;h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',up);h.removeEventListener('pointercancel',up);
        rows.forEach(r=>{r.style.transform='';r.classList.remove('dragging')});
        if(to!==from){const ids=rows.map(r=>r.dataset.iid);const [m]=ids.splice(from,1);ids.splice(to,0,m);onDone(ids)}};
      h.addEventListener('pointermove',move);h.addEventListener('pointerup',up);h.addEventListener('pointercancel',up);
    };
    h.onkeydown=e=>{if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;e.preventDefault();const rows=[...ol.querySelectorAll('li[data-iid]')],ids=rows.map(r=>r.dataset.iid),i=ids.indexOf(h.closest('li').dataset.iid),j=i+(e.key==='ArrowUp'?-1:1);if(j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];onDone(ids)};
    h.tabIndex=0;
  });
}
