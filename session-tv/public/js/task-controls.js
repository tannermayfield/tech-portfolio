/* Per-task preparation and a foreground-only, sequential Codex queue. */
(()=>{
 const efforts=['','low','medium','high','xhigh'],labels={'':'Effort',low:'Light',medium:'Medium',high:'High',xhigh:'Extra high'};
 let queue=null,editing=null,selectedSkills=new Set(),category='All';
 const writable=()=>SessionWorkspace.mode!=='demo'&&!SessionWorkspace.readOnly;
 const active=(name)=>{const task=T(current?.active);return writable()&&TV.mode==='task'&&task&&task.course===name&&projMode(task)==='work'};
 const update=(id,patch)=>db.doc('tasks/'+id).update(patch);
 const render=()=>{const task=T(current?.active);if(task&&typeOf(task)==='project')ppRender(task)};
 const button=(text,label,handler)=>{const b=document.createElement('button');b.type='button';b.className='pp-pill';b.textContent=text;b.setAttribute('aria-label',label);b.onclick=handler;b.disabled=!writable();return b};
 const prompt=document.createElement('dialog');prompt.id='task-prompt-editor';prompt.className='confirm-dlg';prompt.innerHTML='<form class="local-panel"><h2>Task prompt</h2><p data-task-name></p><label>Prompt<textarea rows="7" maxlength="6000"></textarea></label><div class="row"><button type="button" class="btn ghost" data-cancel>Cancel</button><button class="btn" type="submit">Save prompt</button></div><p role="status"></p></form>';document.body.append(prompt);
 prompt.querySelector('[data-cancel]').onclick=()=>prompt.close();prompt.querySelector('form').onsubmit=async event=>{event.preventDefault();if(!writable()||!editing)return;try{await update(editing,{codexPrompt:prompt.querySelector('textarea').value.trim()});prompt.close();render()}catch{prompt.querySelector('[role=status]').textContent='Could not save. Try again.'}};
 const skills=document.createElement('dialog');skills.id='task-skill-picker';skills.className='confirm-dlg';skills.innerHTML='<div class="local-panel"><h2>Task skills</h2><div class="gd-filt" data-categories></div><div class="task-skill-list"></div><div class="row"><button type="button" class="btn ghost" data-cancel>Cancel</button><button type="button" class="btn" data-save>Save skills</button></div><p role="status"></p></div>';document.body.append(skills);
 skills.querySelector('[data-cancel]').onclick=()=>skills.close();
 function renderSkills(){const all=tasks.filter(task=>typeOf(task)==='skill'&&task.status!=='archived'),filters=skills.querySelector('[data-categories]'),list=skills.querySelector('.task-skill-list');filters.replaceChildren();list.replaceChildren();for(const cat of ['All',...subsOf('skill')]){const b=button(cat,cat,()=>{category=cat;renderSkills()});b.setAttribute('aria-pressed',String(category===cat));filters.append(b)}for(const cat of subsOf('skill')){if(category!=='All'&&category!==cat)continue;const section=document.createElement('section'),title=document.createElement('h3');title.textContent=cat;section.append(title);for(const task of all.filter(task=>catOf(task)===cat)){const b=button(task.title,'Select '+task.title,()=>{selectedSkills.has(task.id)?selectedSkills.delete(task.id):selectedSkills.add(task.id);renderSkills()});b.setAttribute('aria-pressed',String(selectedSkills.has(task.id)));section.append(b)}list.append(section)}if(!all.length)list.textContent='Add skills in Settings → My Database → Skills first.';}
 skills.querySelector('[data-save]').onclick=async()=>{if(!writable()||!editing)return;try{await update(editing,{skills:[...selectedSkills]});skills.close();render()}catch{skills.querySelector('[role=status]').textContent='Could not save. Try again.'}};
 function pause(){if(!queue||queue.paused)return;queue.paused=true;if(queue.inFlight)SessionCompanion.cancel();render()}
 async function run(name){if(queue){pause();return}if(!active(name)||SessionProjectChats.busy)return;if($('coach-input').value.trim()){toast('Send or clear your draft before auto run.');return}if(!SessionProjectBacklogs.items(name).some(({task,who})=>who==='ai'&&task.status!=='done'&&efforts.slice(1).includes(task.codexEffort)&&String(task.codexPrompt||'').trim())){toast('Set an effort and save a prompt on a Codex task first.');return}
  const state=queue={name,paused:false,inFlight:false};const attempted=new Set();render();
  try{while(queue===state&&!state.paused&&active(name)){
   if($('coach-input').value.trim()){toast('Auto run paused to preserve your draft.');break}
   const row=SessionProjectBacklogs.items(name).find(({task,who})=>who==='ai'&&task.status!=='done'&&!attempted.has(task.id)&&efforts.slice(1).includes(task.codexEffort)&&String(task.codexPrompt||'').trim());if(!row)break;const task=row.task;attempted.add(task.id);state.inFlight=true;
   const text='Task: '+task.title+'\nTask ID: '+task.id+'\nImplement this task only, using the instructions below. Explain changes and verification.\n\n'+task.codexPrompt;
   const result=await SessionProjectChats.sendTask(name,text,task.codexEffort);state.inFlight=false;
   if(state.paused||!active(name)||!result?.completed){if(!state.paused)toast('Auto run paused. Review the current task and Codex response before retrying.');break}
   await update(task.id,{status:'done',doneAt:new Date().toISOString()});
  }}catch(error){toast('Auto run paused: '+error.message)}finally{if(queue===state)queue=null;render()}
 }
 function enhance(name,mode){if(queue&&(mode!=='work'||name!==queue.name||!active(name)))pause();const rows=SessionProjectBacklogs.items(name),body=$('pp-body');
  if(mode==='work'){const auto=button(queue&&!queue.paused?'Pause auto run':'Auto run','Auto run prepared tasks',()=>run(name));auto.classList.add('btn');auto.disabled=!writable()||!!queue?.paused||(!queue&&SessionProjectChats.busy);auto.setAttribute('aria-pressed',String(!!queue&&!queue.paused));$('pp-acts').append(auto)}
  if(mode==='plan')return;
  for(const li of body.querySelectorAll('[data-iid]')){const row=rows.find(row=>row.task.id===li.dataset.iid);if(!row)continue;const task=row.task;
   if(mode==='work'){
    li.append(button(labels[task.codexEffort]||'Effort','Effort for '+task.title,async()=>{try{await update(task.id,{codexEffort:efforts[(efforts.indexOf(task.codexEffort||'')+1)%efforts.length]});render()}catch{toast('Could not save effort.')}}));
    const edit=button('✎','Edit prompt for '+task.title,()=>{editing=task.id;prompt.querySelector('[data-task-name]').textContent=task.title;prompt.querySelector('textarea').value=task.codexPrompt||'';prompt.querySelector('[role=status]').textContent='';prompt.showModal()});edit.classList.add('task-prompt-button');edit.title=task.codexPrompt?'Edit saved prompt':'Write task prompt';edit.dataset.ready=String(!!task.codexPrompt);li.append(edit);
   }else{
    // Apply: the owner does Me tasks by hand, marks them done and attaches the skills used (see projectSkills)
    const done=task.status==='done',finish=button(done?'Done ✓':'Mark done',(done?'Mark not done: ':'Mark done: ')+task.title,async()=>{try{await update(task.id,done?{status:'todo',doneAt:null}:{status:'done',doneAt:new Date().toISOString()});render()}catch{toast('Could not save. Try again.')}});finish.classList.add('task-done-button');finish.classList.toggle('empty',!done);finish.setAttribute('aria-pressed',String(done));li.append(finish);
    const count=new Set(task.skills||[]).size;li.append(button(count?count+' skill'+(count===1?'':'s'):'Add skills','Skills for '+task.title,()=>{editing=task.id;selectedSkills=new Set((task.skills||[]).map(value=>T(value)?.id||tasks.find(item=>typeOf(item)==='skill'&&item.title===value)?.id||value));category='All';skills.querySelector('[role=status]').textContent='';renderSkills();skills.showModal()}))}
   const remove=button('×','Remove '+task.title,async()=>{try{await update(task.id,{status:'archived'});render()}catch{toast('Could not remove task.')}});remove.className='pp-x';li.append(remove);
  }
  if(writable())ppDragInit(body.querySelector('ol'),order=>{const shown=new Set(order),all=rows.map(row=>row.task.id);let index=0;projSave(name,{taskOrder:all.map(id=>shown.has(id)?order[index++]:id)})});
 }
 SessionTV.hooks.after('project:panel',(task,name,mode)=>enhance(name,mode));
 SessionTV.hooks.before('guide:open',pause);SessionTV.hooks.before('settings:open',pause);
 addEventListener('pagehide',pause);addEventListener('sessiontv:auth',()=>{pause();prompt.close();skills.close();editing=null});
 globalThis.SessionTaskControls={run,pause,get running(){return !!queue}};
})();
