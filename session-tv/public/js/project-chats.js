/* Project folder links and persistent private coding chats. */
(() => {
 const dialog = document.createElement('dialog');
 dialog.id = 'project-chats';
 dialog.className = 'confirm-dlg';
 dialog.setAttribute('aria-labelledby', 'project-chats-heading');
 dialog.innerHTML = `<div class="local-panel">
 <div class="row spread"><h2 id="project-chats-heading">Project chats & folder</h2><button class="btn" id="pc-close">Close</button></div>
 <label>Project<select id="pc-project"></select></label>
 <p class="small">Pair your computer in Settings → Session Login → AI Connections, then refresh folders here.</p>
 <button class="btn" id="pc-refresh">Refresh computer folders</button>
 <form id="pc-create"><label>Computer project folder<select id="pc-folder" required></select></label><button type="button" class="btn" id="pc-link">Save folder link for selected project</button></form>
 <p id="pc-linked" class="small"></p>
 <label>Chat<select id="pc-chat"></select></label>
 <form id="pc-new"><label>New chat name<input id="pc-title" required maxlength="100"></label><button class="btn">Create chat</button></form>
 <div id="pc-history" role="log" aria-live="polite"></div>
 <form id="pc-send"><label>Message<textarea id="pc-message" required maxlength="16000" rows="4"></textarea></label><button class="btn primary" id="pc-submit">Send to Codex</button><button class="btn" type="button" id="pc-stop">Stop</button></form>
 <p id="pc-status" role="status"></p></div>`;
 document.body.appendChild(dialog);
 let project = '', chatId = '', busy = false;
 let authorizedFolders = [];
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
  authorizedFolders = state.connected ? state.workspaces || [] : [];
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
 $('pc-link').onclick = event => {
  event.preventDefault(); if (!project) return message('Create a project first.');
  if (!authorizedFolders.includes($('pc-folder').value)) return message('Choose an authorized computer folder first.');
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
 const databaseView = renderDbView;
 renderDbView = function(view) {
  databaseView(view); if (view !== 'projects') return;
  const section = document.createElement('section'); section.className = 'db-grp';
  const heading = document.createElement('h4'); heading.textContent = 'Project folders & chats'; section.appendChild(heading);
  const create = document.createElement('button'); create.className = 'btn'; create.id = 'project-chats-open'; create.textContent = 'Create project'; create.onclick = () => SessionAddForms.open('project'); section.appendChild(create);
  const names = [...new Set([...Object.values(PROJ.data).map(p => p.name), ...tasks.filter(t => typeOf(t) === 'project').map(t => t.course), ...Object.keys(data())])].filter(Boolean).sort();
  for (const name of names) {
   const row = document.createElement('div'); row.className = 'row spread';
   const label = document.createElement('span'); label.textContent = name;
   const button = document.createElement('button'); button.className = 'btn'; button.textContent = 'Folder & chats'; button.onclick = () => open(name);
   row.append(label,button); section.appendChild(row);
  }
  $('set-body').querySelector('.db-list').prepend(section);
 };
 // A project task can use an existing project only after its folder is linked.
 $('add-form').addEventListener('submit', event => {
  if ($('f-track').value !== 'project') return;
  const name = $('f-course').value.trim();
  if (!data()[name]?.folder) {
   event.preventDefault(); event.stopImmediatePropagation();
   toast('Create or link this project in Settings → My Database → Projects first.');
  }
 }, true);
 const panel = ppRender;
 ppRender = function(task) {
  panel(task); if ($('pp').hidden) return;
  const button = document.createElement('button'); button.className = 'btn'; button.id = 'project-codex'; button.textContent = 'Project chats & folder'; button.onclick = () => open(task.course || 'Project'); $('pp-body').prepend(button);
 };
 globalThis.SessionProjectChats = {open, async create(name,folder) {
  if (SessionWorkspace.mode !== 'private') throw new Error('Sign in first.');
  if (Object.keys(data()).some(existing => pslug(existing) === pslug(name)) || PROJ.data[pslug(name)]) throw new Error('A project with that name already exists.');
  await db.doc('projects/' + pslug(name)).set({name,computerFolder:folder});
  const all = data(); all[name] = {folder,chats:[]}; store('sb.projectCodingChats',all);
 }};
})();
