/* Dedicated creation forms for each database record type. Classes use the shared class form in classes.js. */
(() => {
 const dialogs = {};
 const assignmentSkills=new Set();
 let returnToAssignment=false;
 const classNames=()=>globalThis.SessionClasses?.names()||[...new Set([...Object.keys(recall('sb.classes')),...tasks.filter(task=>typeOf(task)==='class'&&task.status!=='archived').map(task=>task.course).filter(Boolean)])].sort();
 function refreshClasses(selected){const select=dialogs.assignment.querySelector('[name=course]'),names=classNames(),value=selected??select.value;select.replaceChildren(new Option('Choose a class',''),...names.map(name=>new Option(name,name)));select.value=names.includes(value)?value:'';dialogs.assignment.querySelector('[role=status]').textContent=names.length?'':'No classes yet. Add one with + Add class.';}
 function refreshSkills(){const picker=document.getElementById('assignment-skill-picker');if(!picker)return;const skills=[...new Set([...tasks.filter(task=>typeOf(task)==='skill'&&task.status!=='archived').map(task=>task.title),...assignmentSkills])].sort();picker.replaceChildren(new Option('Choose skills…',''),...skills.map(name=>new Option((assignmentSkills.has(name)?'✓ ':'')+name,name)));const summary=document.getElementById('assignment-skill-summary');summary.textContent=assignmentSkills.size?[...assignmentSkills].join(', '):'No skills selected';summary.title=summary.textContent;}
 const field = (label, input) => `<label>${label}${input}</label>`;
 const text = (name, required = true) => `<input name="${name}" ${required?'required':''} maxlength="200">`;
 const definitions = {
  assignment: ['Add assignment', '<div class="assignment-class-field"><label for="assignment-course">Class</label><div class="assignment-skill-actions"><select id="assignment-course" name="course" required></select><button class="btn" type="button" data-new-assignment-class>+ Add class</button></div></div>' +field('Assignment title',text('title')) + field('Due date & time','<input name="dueAt" type="datetime-local">') + field('Points (optional)','<input name="points" type="number" min="0" step="any">') + '<div class="assignment-skill-field"><label for="assignment-skill-picker">Skills that apply</label><div class="assignment-skill-actions"><select id="assignment-skill-picker" aria-describedby="assignment-skill-summary"></select><button class="btn" type="button" data-new-assignment-skill>+ Add skill</button></div><p id="assignment-skill-summary" class="small" aria-live="polite">No skills selected</p></div>'],
  skill: ['Add skill', field('Skill name',text('title')) + field('Category','<select name="category" required></select>')],
  tool: ['Add tool', field('Skill','<select name="course" required></select>') + field('Tool name',text('title')) + field('Level','<select name="level"><option value="1">New</option><option value="2">Learned</option><option value="3">Experienced</option><option value="4">Mastered</option></select>') + field('Learning goal',text('goal',false))],
  project: ['Create project', field('Project name',text('name')) + field('Computer folder','<div class="project-folder-picker"><output name="folder-display">No folder selected</output><input name="folder" type="hidden"><button type="button" class="btn" data-pick-folder>Choose a folder</button></div>')]

 };
 for (const [kind,[title,fields]] of Object.entries(definitions)) {
  const dialog = document.createElement('dialog'); dialog.className = 'confirm-dlg create-record'; dialog.id = 'create-' + kind;
  dialog.setAttribute('aria-labelledby',dialog.id+'-title');
  dialog.innerHTML = `<div class="local-panel"><div class="row spread"><h2 id="${dialog.id}-title">${title}</h2><button type="button" class="btn ghost" data-close-form>Close</button></div><form data-write>${fields}<div class="create-form-actions"><button class="btn primary" type="submit">${title}</button></div></form><p role="status"></p></div>`;
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
    if(kind === 'project') {
     if(!values.name || !values.folder)throw new Error('Enter a project name and choose a computer folder.');
     dialog.querySelector('[role=status]').textContent='Preparing Plan, Apply and Work chats…';
     await SessionProjectChats.create(values.name,values.folder);
    } else if(kind === 'skill') {
     SessionSkills.addSkill(values.title,values.category);
     if(returnToAssignment){assignmentSkills.add(values.title);refreshSkills();}
    } else {
     if(!values.title || !values.course)throw new Error('Complete the required fields.');
     if(kind==='tool'){const [category,skill]=JSON.parse(values.course);values.course=skill;values.cat=category;} // the category keeps Python in Data apart from Python in Software
     const level=Number(values.level),track=kind==='assignment'?'class':level>=3?'practice':'develop';
     const record={...values,track,status:'todo',order:Math.max(0,...tasks.map(task=>task.order||0))+1};
     if(kind==='tool')record.level=level;
     if(kind==='assignment'){const [date,time]=String(values.dueAt||'').split('T');record.due=date||'';record.dueTime=time||'23:59';record.skills=[...assignmentSkills];delete record.dueAt;}
     if(!record.due)delete record.due;
     await db.collection('tasks').add(record);
    }
    form.reset(); if(kind==='project')dialog.querySelector('[name=folder-display]').textContent='No folder selected'; dialog.close(); if(TV.dbView)renderSettings();if(TV.mode==='guide')renderGuide();
   } catch(error) { dialog.querySelector('[role=status]').textContent=error.message; }
   finally { button.disabled=false; }
  };
 }
 function open(kind, course, category) {
  if(SessionWorkspace.mode==='demo'){toast('Sign in to add records.');return;}
  if(kind==='class'){SessionClasses.add();return;} // one class form for every entry point
  const dialog=dialogs[kind];dialog.querySelector('[role=status]').textContent='';
  if(kind==='assignment') {
   refreshClasses(course||'');
   const courseField=dialog.querySelector('[name=course]');if(course&&courseField.value!==course)courseField.append(new Option(course,course));courseField.value=course||'';courseField.closest('.assignment-class-field').hidden=!!course;dialog.classList.toggle('class-assignment',!!course);
   assignmentSkills.clear();refreshSkills();
  }
  if(kind==='skill') {
   const categories=SessionSkills.categories(),select=dialog.querySelector('[name=category]');
   select.replaceChildren(new Option('Choose a category',''),...categories.map(name=>new Option(name,name)));
   const preset=course||SessionSkills.selected();select.value=categories.includes(preset)?preset:''; // default to the category open in settings
  }
  if(kind==='tool') {
   // Skills grouped by category; each option carries both so a tool is saved under the right one.
   const live=tasks.filter(task=>typeOf(task)==='skill'&&task.status!=='archived'),select=dialog.querySelector('[name=course]');
   select.replaceChildren(new Option('Choose a skill',''),...SessionSkills.categories().map(category=>{const group=document.createElement('optgroup');group.label=category;group.append(...SessionSkills.skillsIn(category,live).map(skill=>new Option(skill,JSON.stringify([category,skill]))));return group}));
   const preset=course&&category?JSON.stringify([category,course]):'';select.value=preset;
   select.closest('label').hidden=!!preset&&select.value===preset;
   dialog.querySelector('h2').textContent=select.closest('label').hidden?`Add ${course} tool`:'Add tool';
  }
  dialog.showModal();
 }
 document.getElementById('assignment-skill-picker').onchange=event=>{const name=event.target.value;if(name){if(assignmentSkills.has(name))assignmentSkills.delete(name);else assignmentSkills.add(name);refreshSkills()}};
 dialogs.assignment.querySelector('[data-new-assignment-skill]').onclick=()=>{returnToAssignment=true;open('skill')};
 // the assignment stays open underneath; a newly added class comes back selected
 dialogs.assignment.querySelector('[data-new-assignment-class]').onclick=()=>SessionClasses.add({onClose:key=>{refreshClasses(key||undefined);if(!dialogs.assignment.open)dialogs.assignment.showModal()}});
 dialogs.skill.addEventListener('close',()=>{if(returnToAssignment){returnToAssignment=false;refreshSkills();dialogs.assignment.showModal()}});
 globalThis.SessionAddForms={open};
})();
