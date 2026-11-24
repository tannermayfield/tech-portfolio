/* A project owns its computer folder and three independent Codex conversations. */
(() => {
 const MODES = ['plan', 'apply', 'work'];
 const labels = {plan:'Plan', apply:'Apply', work:'Work'};
 let running = null;
 let managedProject = '';
 const effortLabels = {low:'Light',medium:'Medium',high:'High',xhigh:'Extra high'};
 const modelCatalogs = new Map();
 let chatContext = '', workEffort = 'medium';
 let effortPopup=null,effortContext='';
 function closeEffort(restore=false){if(!effortPopup)return;try{effortPopup.hidePopover?.()}catch{}effortPopup.remove();effortPopup=null;const trigger=document.getElementById('project-effort-button');trigger?.setAttribute('aria-expanded','false');if(trigger){trigger.firstElementChild.textContent=trigger.dataset.model;trigger.lastElementChild.hidden=false;trigger.lastElementChild.textContent=effortLabels[workEffort]}if(restore)document.getElementById('project-effort-button')?.focus()}
 addEventListener('resize',()=>{if(effortPopup)positionEffort()});addEventListener('pagehide',()=>closeEffort());addEventListener('sessiontv:auth',()=>closeEffort());
 document.addEventListener('keydown',event=>{if(event.key==='Escape')closeEffort(true)});
 document.addEventListener('pointerdown',event=>{if(effortPopup&&!effortPopup.contains(event.target)&&!event.target.closest('#project-effort-button'))closeEffort()});
 function positionEffort(){const trigger=document.getElementById('project-effort-button');if(!trigger||!effortPopup)return;const anchor=trigger.getBoundingClientRect(),box=effortPopup.getBoundingClientRect();effortPopup.style.left=Math.max(8,Math.min(innerWidth-box.width-8,anchor.right-box.width))+'px';effortPopup.style.top=Math.max(8,anchor.top-box.height-12)+'px'}
 function modelCatalog(folder,mode) {
  const key=folder+'|'+mode;
  let catalog = modelCatalogs.get(key);
  if (catalog) return catalog;
  catalog = {loading:true,models:[],efforts:[],error:''};
  modelCatalogs.set(key,catalog);
  Promise.resolve().then(()=>SessionCompanion.models(folder)).then(result=>{
   if (!result.selectedModel || !Array.isArray(result.efforts)) throw new Error('Codex returned an incomplete model catalog.');
   if(mode!=='work'){const luna=result.models?.find(model=>(model.id||model.model)==='gpt-6-luna');if(!luna)throw Error('GPT-6 Luna is unavailable. Reconnect or update Codex to use Plan and Apply.');result={...result,selectedModel:'gpt-6-luna',efforts:luna.efforts||[]}}
   Object.assign(catalog,result,{loading:false});
  }).catch(error=>{catalog.loading=false;catalog.error=error.message}).finally(()=>{
   const active=selected();
   if (SessionWorkspace.mode==='private' && active && entry(active.name).folder===folder&&active.mode===mode) renderProjectChat();
  });
  return catalog;
 }
 function renderModelControls(heading,folder,mode) {
  const catalog=modelCatalog(folder,mode), controls=document.createElement('div');controls.className='project-model-controls';
  if(effortPopup&&heading.querySelector('#project-effort-button')){heading.querySelector('#project-effort-button').disabled=!!running;effortPopup.querySelector('input').disabled=!!running;positionEffort();const requested=mode==='work'?workEffort:'low';return !catalog.loading&&!catalog.error&&catalog.efforts.includes(requested)}
  heading.querySelector('.project-model-controls')?.remove();
  const speech=heading.querySelector('.speech-controls');if(speech)speech.parentNode.insertBefore(controls,speech);else $('coach-input').insertAdjacentElement('afterend',controls);
  if(catalog.loading||catalog.error){const state=document.createElement('span');state.textContent=catalog.error||'Connecting Codex…';state.setAttribute('role','status');controls.append(state)}
  if (catalog.error) {
   const retry=document.createElement('button');retry.type='button';retry.className='btn ghost';retry.textContent='Retry';retry.disabled=!!running;
   retry.onclick=()=>{modelCatalogs.delete(folder+'|'+mode);renderProjectChat()};controls.appendChild(retry);
  }
  if (mode==='work') {
   const chosen=catalog.models.find(model=>(model.id||model.model)===catalog.selectedModel),modelName=chosen?.displayName||catalog.selectedModel||'Codex';
   const trigger=document.createElement('button');trigger.type='button';trigger.id='project-effort-button';trigger.className='project-effort-button';trigger.dataset.model=modelName;trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','project-effort-popup');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label','Select Codex effort: '+effortLabels[workEffort]);trigger.disabled=!!running||catalog.loading||!!catalog.error;
   const name=document.createElement('span');name.textContent=modelName;const effort=document.createElement('span');effort.className='effort-muted';effort.textContent=effortLabels[workEffort];trigger.append(name,effort);controls.append(trigger);
   trigger.onclick=()=>{
    if(effortPopup){closeEffort();return}
    const choices=Object.keys(effortLabels).filter(value=>catalog.efforts.includes(value));if(!choices.length)return;
    effortContext=chatContext;const popup=effortPopup=document.createElement('div');popup.id='project-effort-popup';popup.className='project-effort-popup';popup.setAttribute('popover','manual');popup.setAttribute('role','dialog');popup.setAttribute('aria-label','Select Codex effort');
    const header=document.createElement('div');header.className='effort-popup-head';const selected=document.createElement('strong');selected.textContent=effortLabels[workEffort];const reset=document.createElement('button');reset.type='button';reset.className='effort-reset';reset.textContent='↺';reset.title='Reset to Medium';reset.setAttribute('aria-label','Reset effort to Medium');reset.disabled=!choices.includes('medium');header.append(selected,reset);
    const model=document.createElement('p');model.className='effort-model';model.textContent=modelName;
    const track=document.createElement('div');track.className='effort-track';const range=document.createElement('input');range.type='range';range.id='project-reasoning';range.min='0';range.max=String(choices.length-1);range.step='1';range.value=String(Math.max(0,choices.indexOf(workEffort)));range.setAttribute('aria-label','Reasoning effort');range.setAttribute('aria-valuetext',effortLabels[workEffort]);track.append(range);
    const ticks=document.createElement('div');ticks.className='effort-ticks';for(const value of choices){const tick=document.createElement('button');tick.type='button';tick.textContent=effortLabels[value];tick.setAttribute('aria-pressed',String(value===workEffort));tick.onclick=()=>choose(value);ticks.append(tick)}
    function choose(value){workEffort=value;selected.textContent=effortLabels[value];effort.textContent=effortLabels[value];trigger.setAttribute('aria-label','Select Codex effort: '+effortLabels[value]);range.value=String(choices.indexOf(value));range.setAttribute('aria-valuetext',effortLabels[value]);ticks.querySelectorAll('button').forEach((tick,index)=>tick.setAttribute('aria-pressed',String(choices[index]===value)))}
    range.oninput=()=>choose(choices[Number(range.value)]);range.onchange=()=>choose(choices[Number(range.value)]);reset.onclick=()=>choose('medium');popup.append(header,model,track,ticks);document.body.append(popup);popup.showPopover?.();trigger.setAttribute('aria-expanded','true');name.textContent='Select effort';effort.hidden=true;
    positionEffort();range.focus();popup.addEventListener('toggle',event=>{if(effortPopup===popup&&event.newState==='closed')closeEffort()});
   };

  }
  if(mode!=='work'&&!catalog.loading&&!catalog.error){const fixed=document.createElement('span');fixed.className='composer-fixed-effort';fixed.textContent='Light';fixed.title='GPT-6 Luna · fixed Light thinking';controls.append(fixed);}
  const requested=mode==='work'?workEffort:'low';
  if (!catalog.loading && !catalog.error && !catalog.efforts.includes(requested)) {
   const warning=document.createElement('span');warning.className='project-model-warning';warning.textContent=effortLabels[requested]+' is unavailable for this Codex model.';controls.appendChild(warning);
  }
  return !catalog.loading&&!catalog.error&&catalog.efforts.includes(requested);
 }
 const stored = () => recall('sb.projectCodingChats', {});
 function names() {
  return [...new Set([...Object.values(PROJ.data).map(project => project.name), ...tasks.filter(task => typeOf(task) === 'project').map(task => task.course), ...Object.keys(stored())])].filter(Boolean).sort();
 }
 function entry(name) {
  const project = projData(name);
  const all = stored();
  return Object.hasOwn(all,name) ? all[name] : {folder:project.computerFolder || '', chats:project.codingChats || []};
 }
 function save(name, value) {
  store('sb.projectCodingChats', {...stored(), [name]:value});
 }
 function channel(id) {
  const name = names().find(name => id === 'project:' + pslug(name));
  return name ? {id, track:'project', course:name, title:name, status:'todo', projectChannel:true} : null;
 }
 function selected() {
  const task = T(current?.active);
  return task && typeOf(task) === 'project' ? {name:task.course || 'Project', mode:projMode(task), task} : null;
 }
 function modeChat(name, mode) { return entry(name).chats.find(chat => chat.mode === mode); }
 function completeChats(chats) {
  return MODES.every(mode => chats.some(chat => chat.mode === mode && typeof chat.threadId === 'string' && chat.threadId));
 }
 function preparedChats(result) {
  if (!result?.folder || !Array.isArray(result.chats) || !completeChats(result.chats)) throw new Error('Codex did not prepare all three starter chats. The project was not saved.');
  return result.chats.map(chat => ({id:crypto.randomUUID(), mode:chat.mode, title:labels[chat.mode], folder:result.folder, threadId:chat.threadId, messages:[]}));
 }
 async function provision(name, folder, existing = false) {
  if (SessionWorkspace.mode !== 'private') throw new Error('Sign in to create projects.');
  if (!name.trim() || !folder) throw new Error('Enter a project name and choose a computer folder.');
  if (!existing && names().some(other => pslug(other) === pslug(name))) throw new Error('A project with that name already exists.');
  const result = await SessionCompanion.prepareProject(folder,pslug(name));
  const chats = preparedChats(result);
  const previous = entry(name);
  const oldChats = existing ? previous.chats.map(chat => ({...chat, archived:true})) : [];
  const value = {folder:result.folder, chats:[...chats, ...oldChats], ready:true};
  const document = {...projData(name), name, computerFolder:result.folder, codingChats:value.chats, codingReady:true};
  await db.doc('projects/' + pslug(name)).set(document);
  PROJ.data[pslug(name)] = document;
  save(name, value);
  if (TV.mode === 'guide') renderGuide();
  if (TV.dbView === 'projects') renderSettings();
  return value;
 }
 function totalTime(name, timeOn) {
  let ms = 0;
  for (const [id, value] of Object.entries(timeOn || {})) {
   const task = T(id);
   if (task && typeOf(task) === 'project' && task.course === name) ms += Number(value) || 0;
  }
  return ms;
 }
 function stats(name) {
  let milliseconds = sessions.reduce((sum, session) => sum + (Number(session.projectTime?.[name]) || 0), 0) + totalTime(name, current?.timeOn);
  const active = T(current?.active);
  if (active?.course === name && current.activeSince) milliseconds += Math.max(0, Math.min(Date.now() - current.activeSince, 150 * 60000));
  return {sprints:(projData(name).past || []).length, minutes:Math.round(milliseconds / 60000)};
 }
 const manage = document.createElement('dialog');
 manage.id = 'project-manage'; manage.className = 'confirm-dlg'; manage.setAttribute('aria-labelledby','project-manage-title');
 manage.innerHTML = `<div class="local-panel"><div class="row spread"><h2 id="project-manage-title">Manage project</h2><button class="btn" id="pm-close">Close</button></div><h3 id="pm-name"></h3><p id="pm-folder" class="project-folder-path"></p><div class="row"><button class="btn" id="pm-open">Open folder</button><button class="btn" id="pm-change">Choose another folder</button></div><h3>Codex chats</h3><ul id="pm-chats"></ul><button class="btn" id="pm-repair">Prepare starter chats</button><p role="status" id="pm-status"></p></div>`;
 document.body.appendChild(manage);
 function renderManage() {
  const value = entry(managedProject);
  $('pm-name').textContent = managedProject;
  $('pm-folder').textContent = value.folder || 'No computer folder linked';
  $('pm-open').disabled = !value.folder;
  $('pm-chats').replaceChildren(...MODES.map(mode => {
   const li = document.createElement('li'); li.textContent = labels[mode] + (modeChat(managedProject,mode)?.threadId ? ' · Ready' : ' · Setup needed'); return li;
  }));
  $('pm-repair').hidden = completeChats(value.chats);
 }
 function openManage(name) {
  if (SessionWorkspace.mode !== 'private') return toast('Sign in to manage projects.');
  managedProject = name; $('pm-status').textContent = ''; renderManage(); manage.showModal();
 }
 async function updateManaged(folder) {
  const controls = manage.querySelectorAll('button'); controls.forEach(button => button.disabled = true);
  $('pm-status').textContent = 'Preparing Plan, Apply and Work chats…';
  try { await provision(managedProject,folder,true); renderManage(); $('pm-status').textContent = 'Project ready. Previous chats are retained in your saved history.'; }
  catch(error) { $('pm-status').textContent = error.message; }
  finally { controls.forEach(button => button.disabled = false); renderManage(); }
 }
 $('pm-close').onclick = () => manage.close();
 $('pm-open').onclick = () => SessionCompanion.openFolder(entry(managedProject).folder).catch(error => $('pm-status').textContent = error.message);
 $('pm-change').onclick = async () => {
  try { const result = await SessionCompanion.pickFolder(); if(result.folder && result.folder !== entry(managedProject).folder) await updateManaged(result.folder); }
  catch(error) { $('pm-status').textContent = error.message; }
 };
 $('pm-repair').onclick = async () => {
  let folder = entry(managedProject).folder;
  try { if(!folder) folder = (await SessionCompanion.pickFolder()).folder; if(folder)await updateManaged(folder); }
  catch(error) { $('pm-status').textContent = error.message; }
 };
 const baseDatabase = renderDbView;
 renderDbView = function(view) {
  baseDatabase(view); if(view !== 'projects')return;
  const list = $('set-body').querySelector('.db-list');
  list.innerHTML = `<div class="project-table"></div>`;
  const table = list.firstElementChild;
  for(const name of names()) {
   const value = entry(name), totals = stats(name), row = document.createElement('div'); row.className = 'project-table-row';
   const label = document.createElement('strong'); label.textContent = name;
   const open = document.createElement('button'); open.className = 'btn ghost'; open.textContent = 'Open folder'; open.disabled = !value.folder;
   open.onclick = () => SessionCompanion.openFolder(value.folder).catch(error=>toast(error.message));
   const pd=projData(name),owners=new Map();for(const sprint of [...(pd.past||[]),pd.sprint].filter(Boolean))for(const item of spItems(sprint))if(item.who)owners.set(item.id,item.who);
   for(const [id,who] of Object.entries(pd.taskAssignments||{}))owners.set(id,who);
   const completed=tasks.filter(task=>typeOf(task)==='project'&&task.course===name&&task.status==='done');
   const skills=new Set(completed.flatMap(task=>Array.isArray(task.skills)?task.skills:[]));
   const counters=document.createElement('div');counters.className='class-counters project-counters';for(const [count,caption] of [[totals.sprints,'Sprints completed'],[completed.filter(task=>owners.get(task.id)==='me').length,'Tasks completed by me'],[skills.size,'Skills applied'],[completed.filter(task=>owners.get(task.id)==='ai').length,'Tasks completed by Codex']]){const counter=document.createElement('span'),number=document.createElement('b'),label=document.createElement('small');number.textContent=count;label.textContent=caption;counter.append(number,label);counters.append(counter);}
   const time = document.createElement('span'); time.textContent = fmtMin(totals.minutes); time.setAttribute('aria-label','Total project time');
   const button = document.createElement('button'); button.className = 'btn'; button.textContent = 'Manage'; button.onclick = () => openManage(name);
   const identity=document.createElement('div');identity.className='class-identity';identity.append(label,open);row.append(identity,counters,button); table.appendChild(row);
  }
  if(!names().length) { const empty = document.createElement('p'); empty.className='db-empty'; empty.textContent='No projects yet.'; table.appendChild(empty); }
 };
 function renderReplyContent(content, message, working) {
  content.replaceChildren();
  if(working||message.activity?.length){
   const activity=document.createElement('div');activity.className='codex-activity';
   for(const step of message.activity||[]){
    const row=document.createElement('div');row.className='codex-step';
    const label=document.createElement('strong');label.textContent=step.label;
    const detail=document.createElement('span');detail.textContent=step.detail||'';
    row.append(label,detail);activity.append(row);
   }
   if(working){const status=document.createElement('div');status.className='codex-working';status.setAttribute('role','status');status.textContent=message.activity?.length?'Working…':'Starting Codex…';activity.append(status)}
   if(working)for(const approval of running.approvals.values()){
    const panel=document.createElement('section');panel.className='codex-step';
    const heading=document.createElement('strong');heading.textContent=approval.kind+' approval';panel.append(heading);
    const detail=document.createElement('span');detail.textContent=[approval.command,approval.cwd,approval.host,approval.grantRoot,approval.reason,approval.additionalPermissions?JSON.stringify(approval.additionalPermissions):''].filter(Boolean).join('\n');panel.append(detail);
    const actions=document.createElement('div');actions.className='row';
    for(const accept of [true,false]){
     const button=document.createElement('button');button.className='btn';button.type='button';button.textContent=accept?'Approve once':'Deny';button.disabled=approval.sending;
     button.onclick=async()=>{approval.sending=true;for(const control of actions.children)control.disabled=true;try{await SessionCompanion.answerCodexApproval(approval.id,accept)}catch(error){approval.sending=false;for(const control of actions.children)control.disabled=false;toast(error.message)}};
     actions.append(button);
    }
    panel.append(actions);activity.append(panel);
   }
   content.append(activity);
  }
  const text=document.createElement('div');text.innerHTML=fmtMsg(message.text||message.content||'',message.role!=='user');content.append(text);
 }
 function updateActivity(reply, event){
  const {method,params={}}=event,item=params.item;
  if(method==='turn/started')return setStep('turn','Working on your request','');
  if(method==='turn/plan/updated'&&Array.isArray(params.plan)){
   return setStep('plan','Plan',params.plan.slice(0,12).map(step=>(step.status==='completed'?'✓ ':step.status==='inProgress'?'› ':'• ')+step.step).join('\n'));
  }
  if(!item?.id||!['item/started','item/completed'].includes(method))return;
  const finished=method==='item/completed';
  if(item.type==='commandExecution')return setStep(item.id,finished?(item.exitCode!=null&&item.exitCode!==0?'Command failed':'Command finished'):'Running command',item.command);
  if(item.type==='fileChange')return setStep(item.id,finished?'File changes reported':'Changing files',(item.changes||[]).map(change=>change.path).join('\n'));
  if(item.type==='mcpToolCall')return setStep(item.id,finished?'Tool finished':'Using tool',[item.server,item.tool].filter(Boolean).join(' / '));
  if(item.type==='webSearch')return setStep(item.id,finished?'Search finished':'Searching the web',item.query);
  if(item.type==='reasoning'&&finished&&Array.isArray(item.summary)&&item.summary.length)return setStep(item.id,'Progress summary',item.summary.join('\n'));
  function setStep(id,label,detail){
   const steps=reply.activity??=[];
   const entry={id,label,detail:String(detail||'').slice(0,1200)};
   const index=steps.findIndex(step=>step.id===id);
   if(index>=0)steps[index]=entry;else steps.push(entry);
   if(steps.length>40)steps.shift();
  }
 }
 function renderProjectChat() {
  const active = selected(); if(!active){closeEffort();return false;}
  const {name,mode,task} = active, value = running?.name===name?running.value:entry(name), chat = value.chats.find(chat=>chat.mode===mode);
  const context=TV.mode==='task'?name+'|'+mode+'|'+value.folder:'';
  if(effortPopup&&context!==effortContext)closeEffort();
  if (context!==chatContext) {chatContext=context;workEffort='medium'}
  const privateChat=SessionWorkspace.mode==='private';
  $('coach-wrap').setAttribute('aria-label','Codex project chat');
  $('coach-input').setAttribute('aria-label','Message to Codex');
  $('coach-input').placeholder=mode==='work'?'Work with Codex':'Ask Codex';
  const log = $('coach-log');
  $('coach-wrap').hidden = false; $('coach-quick').innerHTML = '';
  $('coach-form').hidden = SessionWorkspace.mode !== 'private' || !chat?.threadId;
  log.replaceChildren();
  const modelReady=privateChat&&chat?.threadId ? renderModelControls($('coach-form'),value.folder,mode) : false;
  $('coach-form').dataset.providerReady=String(!!modelReady);
  $('coach-send').disabled=!!running||!modelReady;
  if(!chat?.threadId) {
   const notice = document.createElement('div'); notice.className = 'msg ai'; notice.textContent = 'Prepare this project’s starter chats in Settings → My Database → Projects → Manage.'; log.appendChild(notice); return true;
  }
  if(!chat.messages.length) {
   const intro = document.createElement('div'); intro.className='msg ai';
   intro.textContent = mode === 'plan' ? 'Plan your next weekly Scrum sprint. What outcome do you want by the end of this week?' : mode === 'apply' ? 'Build this yourself with hints and feedback. What skill are you practicing, and what have you tried?' : 'Build with Codex and learn as you go. What would you like to implement?';
   log.appendChild(intro);
  }
  for(const message of chat.messages) {
   const bubble = document.createElement('div'); bubble.className = 'msg ' + (message.role === 'user' ? 'me' : 'ai');
   const heading = document.createElement('div'); heading.className='ai-name'; heading.textContent=message.role==='user'?'You':'Codex';
   const content = document.createElement('div');if(running?.reply===message)content.dataset.codexLive='';renderReplyContent(content,message,running?.reply===message); bubble.append(heading,content); log.appendChild(bubble);
  }
  $('coach-send').disabled = !!running || !modelReady;
  $('coach-input').placeholder=mode==='work'?'Work with Codex':'Ask Codex';
  let stop = $('project-stop');
  if(!stop) { stop=document.createElement('button');stop.id='project-stop';stop.type='button';stop.className='btn ghost';stop.textContent='Stop';$('coach-form').appendChild(stop);stop.onclick=()=>SessionCompanion.cancel(); }
  stop.hidden = !running;
  coachTurns['proj:'+name] = chat.messages.map(message=>({role:message.role,content:message.text||message.content||''}));
  if(projMode(task)==='work') ppRender(task);
  log.scrollTop=log.scrollHeight;
  return true;
 }
 const baseLog = renderCoachLog;
 renderCoachLog = function() { if(!renderProjectChat())baseLog(); };
 const baseWork = renderWork;
 renderWork = function() { baseWork(); if(selected())renderProjectChat();else {chatContext='';document.querySelector('#coach-form .project-model-controls')?.remove();if($('project-stop'))$('project-stop').hidden=true;} };
 const baseOpenGuide=openGuide;openGuide=function(){closeEffort();chatContext='';return baseOpenGuide.apply(this,arguments)};
 const baseOpenSettings=openSettings;openSettings=function(){closeEffort();chatContext='';return baseOpenSettings.apply(this,arguments)};
 const baseSend = sendCoach;
 const sendProject = async function(text, show, options={}) {
  const active = selected(); if(!active)return baseSend(text,show);
  const prompt=String(text||'').trim(); if(!prompt || running)return {sent:false};
  if(SessionWorkspace.mode!=='private'){toast('Sign in to use project chats.');return {sent:false};}
  const {name,mode,task}=active, value=entry(name), chat=value.chats.find(chat=>chat.mode===mode);
  if(!chat?.threadId){toast('Prepare the project’s starter chats in Manage first.');return {sent:false};}
  const catalog=modelCatalog(value.folder,mode),effort=mode==='work'?(options.effort||workEffort):'low';
  if (catalog.loading||catalog.error||!catalog.efforts.includes(effort)){toast(catalog.error||'Wait for a supported Codex model and effort before sending.');return {sent:false};}
  chat.messages.push({role:'user',text:show||prompt});const reply={role:'assistant',text:''};chat.messages.push(reply);
  running={name,mode,value,reply,approvals:new Map()};save(name,value);$('coach-input').value='';renderProjectChat();
  let repaint=null,lastMessageItem=null,failed=false,completed=false;
  const streamedMessages=new Set();
  const paint=()=>{
   repaint=null;
   const log=$('coach-log'),content=log.querySelector('[data-codex-live]');
   if(!content||selected()?.name!==name||selected()?.mode!==mode)return;
   const follow=log.scrollHeight-log.clientHeight-log.scrollTop<48;
   renderReplyContent(content,reply,true);
   if(follow)log.scrollTop=log.scrollHeight;
  };
  try {
   const learnedSkills=tasks.filter(item=>typeOf(item)==='skill').map(item=>item.title+' ('+skillLevel(item)+')').join(', ');
   const context='Project: '+name+'\nPreviously learned skills and self-rated levels: '+(learnedSkills||'None recorded yet')+'\n'+projectCtx(task);
   await SessionCompanion.start({workspace:value.folder,prompt:context+'\n\nUser message: '+prompt,threadId:chat.threadId,mode,effort,image:options.image,reviewer:mode==='work'?globalThis.SessionComposer?.approvalMode():undefined,onEvent:event=>{
    if(event.method==='sessiontv/approval')running.approvals.set(event.params.id,event.params);
    if(event.method==='sessiontv/approvalResolved')running.approvals.delete(event.params.id);
    if(event.method==='sessiontv/publish'){
     reply.activity??=[];reply.activity.push({label:'GitHub Pages',detail:event.params.message});
     if(event.params.commit)globalThis.SessionProjectPublish?.verify(event.params.commit);
    }
    updateActivity(reply,event);
    if(event.method==='sessiontv/thread')chat.threadId=event.params.threadId;
    if(event.method==='item/agentMessage/delta'){
     streamedMessages.add(event.params.itemId);
     if(lastMessageItem&&event.params.itemId&&lastMessageItem!==event.params.itemId)reply.text+='\n\n';
     lastMessageItem=event.params.itemId||lastMessageItem;reply.text+=event.params.delta||'';
    }
    if(event.method==='sessiontv/error'||(event.method==='sessiontv/stopped'&&!completed))failed=true;
    if(event.method==='turn/completed'){completed=event.params.turn?.status==='completed';if(!completed)failed=true;}
    const item=event.params?.item;
    if(event.method==='item/completed'&&item?.type==='agentMessage'&&!streamedMessages.has(item.id)&&typeof item.text==='string'){
     reply.text+=(reply.text?'\n\n':'')+item.text;lastMessageItem=item.id;
    }
    if(event.method==='sessiontv/error'||event.method==='sessiontv/approvalDenied')reply.text+='\n'+(event.params.error||event.params.reason);
    if(event.method==='turn/completed'&&event.params.turn?.status==='failed')reply.text+='\n'+(event.params.turn.error?.message||'The Codex turn failed. You can retry.');
    if(event.method==='sessiontv/thread')save(name,value);
    if(event.method==='sessiontv/stopped'&&!completed)reply.text+='\n'+(event.params.error||'Codex stopped before finishing.');
    if(repaint===null)repaint=setTimeout(paint,50);
   }});
  } catch(error) { failed=true;reply.text+=(error.name==='AbortError'?'\nStopped.':'\n'+error.message); }
  finally { clearTimeout(repaint);if(!reply.text.trim())reply.text=completed?'Codex finished without a text reply.':'Codex stopped before sending a reply.';running=null;save(name,value);if(selected()?.name===name)renderProjectChat(); }
  return {sent:!failed&&completed,completed:!failed&&completed};
 };
 sendCoach=sendProject;
 addEventListener('pagehide',()=>{if(running)save(running.name,running.value)});
 globalThis.SessionProjectChats = {
  get busy(){return !!running},sendImage(text,show,image){return sendProject(text,show,{image})},async sendTask(name,prompt,effort){const active=selected();if(!active||active.name!==name||active.mode!=='work')return {sent:false,completed:false};return sendProject(prompt,prompt,{effort})},names, entry, channel, open:openManage, create:(name,folder)=>provision(name.trim(),folder),
  timeTotals:()=>Object.fromEntries(names().map(name=>[name,totalTime(name,current?.timeOn)]))
 };
 if(current)renderWork();
})();
