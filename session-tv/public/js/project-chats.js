/* A project owns its computer folder and three independent Codex conversations. */
(() => {
 const MODES = ['plan', 'apply', 'work'];
 const labels = {plan:'Plan', apply:'Apply', work:'Work'};
 let running = null;
 let managedProject = '';
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
  list.innerHTML = `<div class="project-table"><div class="project-table-head"><span>Project</span><span>Computer folder</span><span>Sprints completed</span><span>Total time</span><span></span></div></div>`;
  const table = list.firstElementChild;
  for(const name of names()) {
   const value = entry(name), totals = stats(name), row = document.createElement('div'); row.className = 'project-table-row';
   const label = document.createElement('strong'); label.textContent = name;
   const open = document.createElement('button'); open.className = 'btn ghost'; open.textContent = 'Open folder'; open.disabled = !value.folder;
   open.onclick = () => SessionCompanion.openFolder(value.folder).catch(error=>toast(error.message));
   const sprints = document.createElement('span'); sprints.textContent = String(totals.sprints); sprints.setAttribute('aria-label','Sprints completed');
   const time = document.createElement('span'); time.textContent = fmtMin(totals.minutes); time.setAttribute('aria-label','Total project time');
   const button = document.createElement('button'); button.className = 'btn'; button.textContent = 'Manage'; button.onclick = () => openManage(name);
   row.append(label,open,sprints,time,button); table.appendChild(row);
  }
  if(!names().length) { const empty = document.createElement('p'); empty.className='db-empty'; empty.textContent='No projects yet.'; table.appendChild(empty); }
 };
 function renderProjectChat() {
  const active = selected(); if(!active)return false;
  const {name,mode,task} = active, value = entry(name), chat = modeChat(name,mode);
  $('coach-wrap').setAttribute('aria-label','Codex project chat');
  $('coach-input').setAttribute('aria-label','Message to Codex');
  const log = $('coach-log');
  $('coach-wrap').hidden = false; $('coach-quick').innerHTML = '';
  $('coach-form').hidden = SessionWorkspace.mode !== 'private' || !chat?.threadId;
  log.innerHTML = `<div class="project-chat-heading"><span>Codex · ${labels[mode]}</span><span>${running?.name === name && running.mode === mode ? 'Working…' : 'Saved conversation'}</span></div>`;
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
   const content = document.createElement('div'); content.innerHTML=fmtMsg(message.text || message.content || '',message.role!=='user'); bubble.append(heading,content); log.appendChild(bubble);
  }
  $('coach-send').disabled = !!running;
  $('coach-input').placeholder = 'Message Codex · ' + labels[mode];
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
 renderWork = function() { baseWork(); if(selected())renderProjectChat();else if($('project-stop'))$('project-stop').hidden=true; };
 const baseSend = sendCoach;
 sendCoach = async function(text, show) {
  const active = selected(); if(!active)return baseSend(text,show);
  const prompt=String(text||'').trim(); if(!prompt || running)return;
  if(SessionWorkspace.mode!=='private')return toast('Sign in to use project chats.');
  const {name,mode,task}=active, value=entry(name), chat=value.chats.find(chat=>chat.mode===mode);
  if(!chat?.threadId)return toast('Prepare the project’s starter chats in Manage first.');
  chat.messages.push({role:'user',text:show||prompt});const reply={role:'assistant',text:''};chat.messages.push(reply);
  running={name,mode,value};save(name,value);$('coach-input').value='';renderProjectChat();
  let lastRender=0, lastMessageItem=null;
  try {
   const learnedSkills=tasks.filter(item=>typeOf(item)==='skill').map(item=>item.title+' ('+skillLevel(item)+')').join(', ');
   const context='Project: '+name+'\nPreviously learned skills and self-rated levels: '+(learnedSkills||'None recorded yet')+'\n'+projectCtx(task);
   await SessionCompanion.start({workspace:value.folder,prompt:context+'\n\nUser message: '+prompt,threadId:chat.threadId,mode,onEvent:event=>{
    if(event.method==='sessiontv/thread')chat.threadId=event.params.threadId;
    if(event.method==='item/agentMessage/delta'){
     if(lastMessageItem&&event.params.itemId&&lastMessageItem!==event.params.itemId)reply.text+='\n\n';
     lastMessageItem=event.params.itemId||lastMessageItem;reply.text+=event.params.delta||'';
    }
    if(event.method==='sessiontv/error'||event.method==='sessiontv/approvalDenied')reply.text+='\n'+(event.params.error||event.params.reason);
    if(event.method==='turn/completed'&&event.params.turn?.status==='failed')reply.text+='\n'+(event.params.turn.error?.message||'The Codex turn failed. You can retry.');
    if(event.method==='sessiontv/thread')save(name,value);
    if(Date.now()-lastRender>100||event.method==='turn/completed'){lastRender=Date.now();if(selected()?.name===name&&selected()?.mode===mode)renderProjectChat();}
   }});
  } catch(error) { reply.text+=(error.name==='AbortError'?'\nStopped.':'\n'+error.message); }
  finally { running=null;save(name,value);if(selected()?.name===name)renderProjectChat(); }
 };
 addEventListener('pagehide',()=>{if(running)save(running.name,running.value)});
 globalThis.SessionProjectChats = {
  names, entry, channel, open:openManage, create:(name,folder)=>provision(name.trim(),folder),
  timeTotals:()=>Object.fromEntries(names().map(name=>[name,totalTime(name,current?.timeOn)]))
 };
 if(current)renderWork();
})();
