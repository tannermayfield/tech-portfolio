/* Dedicated creation forms for each database record type. */
(() => {
 const dialogs = {};
 const field = (label, input) => `<label>${label}${input}</label>`;
 const text = (name, required = true) => `<input name="${name}" ${required?'required':''} maxlength="200">`;
 const definitions = {
  class: ['Add class', field('Class code or name',text('name')) + field('Description',text('description',false))],
  assignment: ['Add classwork assignment', field('Class','<select name="course" required></select>') + field('Assignment title',text('title')) + field('Due date','<input name="due" type="date">') + field('Due time','<input name="dueTime" type="time" value="23:59">') + field('Learning goal',text('goal',false))],
  skill: ['Add skill', field('Skill name',text('title')) + field('Skill area',text('course')) + field('Level','<select name="level"><option value="1">New</option><option value="2">Learned</option><option value="3">Experienced</option><option value="4">Mastered</option></select>') + field('Learning goal',text('goal',false))],
  project: ['Create project', field('Project name',text('name')) + field('Computer folder','<div class="project-folder-picker"><output name="folder-display">No folder selected</output><input name="folder" type="hidden"><button type="button" class="btn" data-pick-folder>Choose a folder</button></div>')]

 };
 for (const [kind,[title,fields]] of Object.entries(definitions)) {
  const dialog = document.createElement('dialog'); dialog.className = 'confirm-dlg create-record'; dialog.id = 'create-' + kind;
  dialog.setAttribute('aria-labelledby',dialog.id+'-title');
  dialog.innerHTML = `<div class="local-panel"><div class="row spread"><h2 id="${dialog.id}-title">${title}</h2><button type="button" class="btn" data-close-form>Close</button></div><form>${fields}<div class="create-form-actions"><button class="btn primary" type="submit">${title}</button></div></form><p role="status"></p></div>`;
  document.body.appendChild(dialog); dialogs[kind] = dialog;
  dialog.querySelector('[data-close-form]').onclick = () => dialog.close();
  const picker = dialog.querySelector('[data-pick-folder]');
  if(picker)picker.onclick = async () => {
   picker.disabled = true; dialog.querySelector('[role=status]').textContent = '';
   try {
    const result = await SessionCompanion.pickFolder();
    if(result.folder) {
     dialog.querySelector('[name=folder]').value = result.folder;
     dialog.querySelector('[name=folder-display]').textContent = result.folder;
    }
   } catch(error) { dialog.querySelector('[role=status]').textContent = error.message; }
   finally { picker.disabled = false; }
  };
  dialog.querySelector('form').onsubmit = async event => {
   event.preventDefault(); const form = event.currentTarget, values = Object.fromEntries(new FormData(form));
   for(const key of Object.keys(values))values[key]=values[key].trim();
   const button = form.querySelector('[type=submit]'); button.disabled = true;
   try {
    if(SessionWorkspace.mode === 'demo')throw new Error('Sign in to save records.');
    if(kind === 'class') {
     if(!values.name)throw new Error('Enter a class name.');
     const classes=recall('sb.classes',{}); if(Object.hasOwn(classes,values.name))throw new Error('That class already exists.');
     classes[values.name]={description:values.description}; store('sb.classes',classes);
    } else if(kind === 'project') {
     if(!values.name || !values.folder)throw new Error('Enter a project name and choose a computer folder.');
     dialog.querySelector('[role=status]').textContent='Preparing Plan, Apply and Work chats…';
     await SessionProjectChats.create(values.name,values.folder);
    } else {
     if(!values.title || !values.course)throw new Error('Complete the required fields.');
     const level=Number(values.level),track=kind==='assignment'?'class':level>=3?'practice':'develop';
     const record={...values,track,status:'todo',order:Math.max(0,...tasks.map(task=>task.order||0))+1};
     if(kind==='skill')record.level=level;
     if(!record.due)delete record.due;
     await db.collection('tasks').add(record);
    }
    form.reset(); if(kind==='project')dialog.querySelector('[name=folder-display]').textContent='No folder selected'; dialog.close(); if(TV.dbView)renderSettings(); 
   } catch(error) { dialog.querySelector('[role=status]').textContent=error.message; }
   finally { button.disabled=false; }
  };
 }
 function open(kind) {
  if(SessionWorkspace.mode==='demo'){toast('Sign in to add records.');return;}
  closeDrawers(); const dialog=dialogs[kind];dialog.querySelector('[role=status]').textContent='';
  if(kind==='assignment') {
   const names=[...new Set([...Object.keys(recall('sb.classes',{})),...tasks.filter(task=>typeOf(task)==='class').map(task=>task.course).filter(Boolean)])].sort();
   dialog.querySelector('[name=course]').replaceChildren(new Option('Choose a class',''),...names.map(name=>new Option(name,name)));
   if(!names.length)dialog.querySelector('[role=status]').textContent='Add a class in My Database → Classes first.';
  }
  dialog.showModal();
 }
 const drawer = openDrawer;
 openDrawer = function(id) { if(id==='add-drawer')return open(tabs.left==='project'?'project':tabs.left==='skill'?'skill':'assignment'); return drawer(id); };
 globalThis.SessionAddForms={open};
})();
