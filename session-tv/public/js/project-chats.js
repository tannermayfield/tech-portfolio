/* Project folder links and persistent private coding chats. */
(() => {
 const dialog = document.createElement('dialog');
 dialog.id = 'project-chats';
 dialog.className = 'confirm-dlg';
 dialog.setAttribute('aria-labelledby', 'project-chats-heading');
 dialog.innerHTML = `<div class="local-panel">
 <div class="row spread"><h2 id="project-chats-heading">Project chats & folder</h2><button class="btn" id="pc-close">Close</button></div>
 <label>Project<select id="pc-project"></select></label>
 <form id="pc-create"><label>New project name<input id="pc-name" required maxlength="100"></label><button class="btn">Create project</button></form>
 <p class="small">Pair your computer in Settings → Session Login → AI Connections, then refresh folders here.</p>
 <button class="btn" id="pc-refresh">Refresh computer folders</button>
 <form id="pc-link"><label>Computer project folder<select id="pc-folder" required></select></label><button class="btn">Save folder link</button></form>
 <p id="pc-linked" class="small"></p>
 <label>Chat<select id="pc-chat"></select></label>
 <form id="pc-new"><label>New chat name<input id="pc-title" required maxlength="100"></label><button class="btn">Create chat</button></form>
 <div id="pc-history" role="log" aria-live="polite"></div>
 <form id="pc-send"><label>Message<textarea id="pc-message" required maxlength="16000" rows="4"></textarea></label><button class="btn primary" id="pc-submit">Send to Codex</button><button class="btn" type="button" id="pc-stop">Stop</button></form>
 <p id="pc-status" role="status"></p></div>`;
 document.body.appendChild(dialog);
 let project = '', chatId = '', busy = false;
 const data = () => recall('sb.projectCodingChats', {});
 const entry = () => data()[project] || {folder:'', chats:[]};
 function save(value) { const all = data(); all[project] = value; store('sb.projectCodingChats', all); }
 function message(text) { $('pc-status').textContent = text; }
 function render() {
  const value = entry();
  $('pc-linked').textContent = value.folder ? 'Linked folder — ' + value.folder : 'Choose and save a computer folder to begin.';
  $('pc-chat').replaceChildren(...value.chats.map(chat => new Option(chat.title, chat.id)));
  if (!value.chats.some(chat => chat.id === chatId)) chatId = value.chats[0]?.id || '';
  $('pc-chat').value = chatId;
  $('pc-history').replaceChildren();
  for (const item of value.chats.find(chat => chat.id === chatId)?.messages || []) {
   const block = document.createElement('p');
   const label = document.createElement('strong'); label.textContent = item.role === 'user' ? 'You' : 'Codex';
   const body = document.createElement('div'); body.textContent = item.text;
   block.append(label, body); $('pc-history').appendChild(block);
  }
  $('pc-submit').disabled = busy || !value.folder || !chatId;
  for (const id of ['pc-project','pc-chat','pc-link','pc-new','pc-create']) {
   const el = $(id); if ('disabled' in el) el.disabled = busy;
   el.querySelectorAll('input,select,button').forEach(control => control.disabled = busy);
  }
 }
 function projects(selected) {
  const names = [...new Set([...Object.values(PROJ.data).map(p => p.name), ...tasks.filter(t => typeOf(t) === 'project').map(t => t.course), ...Object.keys(data())])].filter(Boolean).sort();
  $('pc-project').replaceChildren(...names.map(name => new Option(name, name)));
  project = names.includes(selected) ? selected : names[0] || '';
  $('pc-project').value = project; render();
 }
 async function folders() {
  const state = await SessionCompanion.status();
  $('pc-folder').replaceChildren(new Option('Choose a folder', ''), ...(state.workspaces || []).map(path => new Option(path, path)));
  $('pc-folder').value = entry().folder;
  message(state.connected ? 'Computer connected. Choose a folder and save the link.' : state.error);
 }
 function open(name) {
  if (SessionWorkspace.mode !== 'private') { toast('Sign in to your private workspace to use project chats.'); return; }
  projects(name); dialog.showModal(); folders().catch(error => message(error.message));
 }
 $('pc-close').onclick = () => dialog.close();
 $('pc-refresh').onclick = () => folders().catch(error => message(error.message));
 $('pc-project').onchange = () => { project = $('pc-project').value; chatId = ''; render(); $('pc-folder').value = entry().folder; };
 $('pc-chat').onchange = () => { chatId = $('pc-chat').value; render(); };
 $('pc-create').onsubmit = async event => {
  event.preventDefault(); const name = $('pc-name').value.trim(); if (!name) return;
  try {
   await db.doc('projects/' + pslug(name)).set({...projData(name), name});
   if (!data()[name]) { const all = data(); all[name] = {folder:'',chats:[]}; store('sb.projectCodingChats', all); }
   projects(name); $('pc-name').value = ''; message('Project created. Choose its computer folder below.');
  } catch (error) { message(error.message); }
 };
 $('pc-link').onsubmit = event => {
  event.preventDefault(); if (!project) return message('Create a project first.');
  const value = entry(); value.folder = $('pc-folder').value; save(value); render();
  message('Folder linked. Existing chats keep the folder where they started.');
 };
 $('pc-new').onsubmit = event => {
  event.preventDefault(); if (!project) return message('Create a project first.');
  const title = $('pc-title').value.trim(); if (!title) return;
  const value = entry(); chatId = crypto.randomUUID();
  value.chats.push({id:chatId,title,folder:value.folder, messages:[]}); save(value); $('pc-title').value = ''; render();
 };
 $('pc-stop').onclick = () => SessionCompanion.cancel();
 $('pc-send').onsubmit = async event => {
  event.preventDefault(); if (busy) return;
  const value = entry(), chat = value.chats.find(c => c.id === chatId), prompt = $('pc-message').value.trim();
  if (!chat || !value.folder || !prompt) return;
  if (chat.threadId && chat.folder !== value.folder) return message('This chat uses its original folder. Restore that folder link or create a new chat.');
  chat.folder = value.folder; chat.messages.push({role:'user',text:prompt});
  const reply = {role:'assistant',text:''}; chat.messages.push(reply); save(value);
  busy = true; render(); message('Codex is working…'); $('pc-message').value = '';
  let completed = false;
  try {
   await SessionCompanion.start({workspace:chat.folder,prompt,threadId:chat.threadId,onEvent:event => {
    if (event.method === 'sessiontv/thread') chat.threadId = event.params.threadId;
    if (event.method === 'item/agentMessage/delta') reply.text += event.params.delta || '';
    if (event.method === 'sessiontv/error' || event.method === 'sessiontv/approvalDenied') reply.text += '\n' + (event.params.error || event.params.reason);
    if (event.method === 'turn/completed') { completed = true; message('Turn ' + (event.params.turn?.status || 'completed')); }
    save(value); render();
   }});
   if (!completed) message('Connection ended. You can continue this chat after reconnecting.');
  } catch (error) { message(error.name === 'AbortError' ? 'Stopped. You can continue this chat.' : error.message); }
  finally { busy = false; save(value); render(); }
 };
 const settings = renderSettings;
 renderSettings = function() {
  settings(); if (TV.dbView || !$('local-open')) return;
  const button = document.createElement('button'); button.className = 'btn'; button.id = 'project-chats-open'; button.textContent = 'Project chats & folders'; button.onclick = () => open();
  $('local-open').parentElement.appendChild(button);
 };
 const panel = ppRender;
 ppRender = function(task) {
  panel(task); if ($('pp').hidden) return;
  const button = document.createElement('button'); button.className = 'btn'; button.id = 'project-codex'; button.textContent = 'Project chats & folder'; button.onclick = () => open(task.course || 'Project'); $('pp-body').prepend(button);
 };
 globalThis.SessionProjectChats = {open};
})();
