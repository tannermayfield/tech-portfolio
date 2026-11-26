/* Shared skill categories and skills for the menu and settings.
   Category (Data) → Skill (SQL) → Tool (CTEs). Tools are the skill task records:
   a tool's `course` is its skill and its `cat` is its category. */
(()=>{
 const defaults=Object.fromEntries(Object.entries(SKILL_TAGS).map(([key,skills])=>[key,[...skills]]));let selected='';
 const clean=value=>typeof value==='string'?value.trim():'';
 const readOnly=()=>SessionWorkspace.mode==='demo'||!!SessionWorkspace.readOnly;
 function hydrate(){
  for(const key of Object.keys(SKILL_TAGS))if(!Object.hasOwn(defaults,key))delete SKILL_TAGS[key];
  for(const [key,skills] of Object.entries(defaults))SKILL_TAGS[key]=[...skills];
  for(const name of recall('sb.skillCategories').map(clean))if(name&&!Object.hasOwn(SKILL_TAGS,name))SKILL_TAGS[name]=[];
  const custom=recall('sb.skills');
  for(const [category,names] of Object.entries(custom&&typeof custom==='object'?custom:{})){
   if(!Object.hasOwn(SKILL_TAGS,category)||!Array.isArray(names))continue;
   for(const name of names.map(clean))if(name&&!SKILL_TAGS[category].includes(name))SKILL_TAGS[category].push(name);
  }
 }
 const liveTools=()=>tasks.filter(task=>typeOf(task)==='skill'&&task.status!=='archived');
 // Skills in a category: the listed ones first, then any skill a tool uses that the list leaves out.
 function skillsIn(category,tools=[]){
  const listed=SKILL_TAGS[category]||[];
  const extra=[...new Set(tools.filter(tool=>catOf(tool)===category).map(tool=>tool.course||'Other'))].filter(name=>!listed.includes(name));
  return [...listed,...extra];
 }
 // every skill across every category, including skills with no tools yet (the Settings home count)
 function count(){hydrate();const tools=liveTools();return Object.keys(SKILL_TAGS).reduce((sum,category)=>sum+skillsIn(category,tools).length,0)}
 const customSkills=()=>{const value=recall('sb.skills');return value&&typeof value==='object'&&!Array.isArray(value)?value:{}};
 const isCustom=(category,skill)=>Array.isArray(customSkills()[category])&&customSkills()[category].map(clean).includes(skill);
 function addSkill(name,category){
  name=clean(name);category=clean(category);hydrate();
  if(!name)throw new Error('Enter a skill name.');
  if(!Object.hasOwn(SKILL_TAGS,category))throw new Error('Choose a category.');
  if(SKILL_TAGS[category].some(skill=>skill.toLowerCase()===name.toLowerCase()))throw new Error(`${category} already has ${name}.`);
  const custom=customSkills();store('sb.skills',{...custom,[category]:[...(Array.isArray(custom[category])?custom[category]:[]),name]});
  hydrate();selected=category;
 }
 // A skill channel stands in for one skill in the menu and owns its chat, like a project channel.
 // Its level, practice time and code editor live with the skill; its tools are the skill's open records.
 const toolsOf=(category,skill)=>tasks.filter(task=>typeOf(task)==='skill'&&!['archived','done'].includes(task.status)&&catOf(task)===category&&(task.course||'Other')===skill).sort(byOrder);
 const latest=values=>values.filter(Boolean).sort().pop()||null;
 function build(category,skill){
  const id=skillChannelId(category,skill),tools=toolsOf(category,skill),own=recall('sb.skillChannels')[id]||{};
  const level=own.level||Math.max(0,...tools.map(skillLevel))||1;
  return {id,track:level>=3?'practice':'develop',title:skill,course:skill,cat:category,status:'todo',level,skillChannel:true,
   lastPracticed:latest([own.lastPracticed,...tools.map(tool=>tool.lastPracticed)]),reps:own.reps||0,toolIds:tools.map(tool=>tool.id),tools:tools.map(tool=>tool.title)};
 }
 const channels=category=>skillsIn(category,liveTools()).map(skill=>build(category,skill));
 function find(id){
  if(typeof id!=='string'||!id.startsWith('skill:'))return null;
  for(const category of Object.keys(SKILL_TAGS))for(const skill of skillsIn(category,liveTools()))if(skillChannelId(category,skill)===id)return {category,skill};
  return null;
 }
 function channel(id){const found=find(id);return found?build(found.category,found.skill):null}
 function update(id,values){const all=recall('sb.skillChannels');store('sb.skillChannels',{...all,[id]:{...all[id],...values}});}
 // Practicing a skill stamps the skill and each of its open tools.
 async function practice(id){
  const skill=channel(id);if(!skill)return;const at=new Date().toISOString();
  update(id,{lastPracticed:at,reps:skill.reps+1});
  await Promise.all(skill.toolIds.map(toolId=>db.doc('tasks/'+toolId).update({lastPracticed:at,reps:(T(toolId)?.reps||0)+1})));
 }
 // The code editor beside a skill's chat: 'none' or a WS_KINDS key, chosen in Settings → Skills.
 function setEditor(id,kind){
  if(readOnly())return false;
  if(kind!=='none'&&!WS_KINDS[kind])throw new Error('Choose an editor.');
  update(id,{editor:kind});
  const active=current&&T(current.active);if(active&&typeOf(active)==='skill'&&skillChannelId(catOf(active),active.course||'Other')===id)renderWork();
  return true;
 }

 /* Moving a skill to a new name: its channel state, study chat, editor drafts and the open session follow it. */
 function moveKey(map,from,to,merge){if(!map||typeof map!=='object'||!Object.hasOwn(map,from))return false;map[to]=merge(map[from],map[to]);delete map[from];return true}
 // the stored text is checked first, so this is cheap to run on every render when there is nothing to move
 const mentions=(key,id)=>{try{return String(SessionWorkspace.storage.getItem(key)||'').includes(JSON.stringify(id))}catch(e){return false}};
 function rekey(from,to){
  if(from===to)return;
  if(mentions('sb.skillChannels',from)){const state=recall('sb.skillChannels');if(moveKey(state,from,to,(old,now)=>({...old,...now})))store('sb.skillChannels',state)}
  if(mentions('sb.studyChats',from)){const chats=recall('sb.studyChats');if(moveKey(chats,from,to,(old,now)=>now&&Array.isArray(now.messages)&&now.messages.length?now:old))store('sb.studyChats',chats)}
  const storage=SessionWorkspace.storage,drafts=[];
  try{for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key===('sb.ws.'+from)||key?.startsWith('sb.ws.'+from+'.'))drafts.push(key)}}catch(e){}
  for(const key of drafts){try{const target='sb.ws.'+to+key.slice(('sb.ws.'+from).length);if(storage.getItem(target)==null)storage.setItem(target,storage.getItem(key));storage.removeItem(key)}catch(e){}}
  if(!current)return;
  let moved=false;const swap=value=>{if(value===from){moved=true;return to}return value};
  current.active=swap(current.active);
  if(current.cur&&typeof current.cur==='object')for(const key of Object.keys(current.cur))current.cur[key]=swap(current.cur[key]);
  if(Array.isArray(current.practiced))current.practiced=current.practiced.map(swap);
  for(const field of ['timeOn','wrapUp','skillChats'])if(moveKey(current[field],from,to,(old,now)=>field==='timeOn'?(old||0)+(now||0):now??old))moved=true;
  if(coachTurns&&moveKey(coachTurns,from,to,(old,now)=>now?.length?now:old))moved=true;
  if(moved)saveState();
 }
 // renames a skill the owner added; built-in skill names stay fixed
 async function rename(category,from,to){
  to=clean(to);hydrate();
  if(readOnly())throw new Error('You can view this board but not change it.');
  if(!isCustom(category,from))throw new Error('Only skills you added can be renamed.');
  if(!to)throw new Error('Enter a skill name.');
  if(to===from)return true;
  if(skillsIn(category,liveTools()).some(skill=>skill.toLowerCase()===to.toLowerCase()&&skill!==from))throw new Error(`${category} already has ${to}.`);
  const custom=customSkills();store('sb.skills',{...custom,[category]:custom[category].map(name=>clean(name)===from?to:name)});
  rekey(skillChannelId(category,from),skillChannelId(category,to));hydrate();
  const tools=[...tasks,...archived].filter(task=>typeOf(task)==='skill'&&catOf(task)===category&&(task.course||'Other')===from);
  for(const tool of tools)tool.course=to;
  return guard(()=>Promise.all(tools.map(tool=>db.doc('tasks/'+tool.id).update({course:to}))),null,()=>{for(const tool of tools)tool.course=from;refresh()});
 }
 // removes a skill the owner added, once it has no tools
 function remove(category,skill){
  if(readOnly())throw new Error('You can view this board but not change it.');
  if(!isCustom(category,skill))throw new Error('Only skills you added can be removed.');
  if([...tasks,...archived].some(task=>typeOf(task)==='skill'&&task.status!=='archived'&&catOf(task)===category&&(task.course||'Other')===skill))throw new Error('Move or delete this skill\'s tools first.');
  const custom=customSkills();store('sb.skills',{...custom,[category]:custom[category].filter(name=>clean(name)!==skill)});
  const all=recall('sb.skillChannels');delete all[skillChannelId(category,skill)];store('sb.skillChannels',all);hydrate();
 }

 /* One-time move from the shared "Python" skill to "Python (Data)" and "Python (Software)".
    Tools named Python go by their category (none means Data, as catOf always read it), and the
    Data/Software Python channels' state and chats move to the new ids. Safe to run again: once
    nothing is named Python it does nothing. A failed save is not retried until the next sign-in. */
 const PYTHON_SPLIT={Data:'Python (Data)',Software:'Python (Software)'};
 const attempted=new Set();
 function migratePython(){
  if(readOnly())return;
  for(const [category,name] of Object.entries(PYTHON_SPLIT))rekey(skillChannelId(category,'Python'),skillChannelId(category,name));
  if(!db||!loaded.tasks)return;
  const stale=[...tasks,...archived].filter(task=>isSkill(task)&&task.course==='Python'&&PYTHON_SPLIT[catOf(task)]&&!attempted.has(task.id));
  for(const tool of stale){
   const name=PYTHON_SPLIT[catOf(tool)];attempted.add(tool.id);tool.course=name;
   guard(()=>db.doc('tasks/'+tool.id).update({course:name}),null,()=>{tool.course='Python';refresh()});
  }
 }
 SessionTV.hooks.before('work:render',migratePython);
 SessionTV.hooks.before('subs:list',kind=>{if(kind==='skill')hydrate()});

 const dialog=document.createElement('dialog');dialog.className='confirm-dlg';dialog.innerHTML='<form class="local-panel"><h2>Add skill category</h2><label>Category name<input name="category" required maxlength="60" autocomplete="off"></label><div class="row"><button type="button" class="btn ghost" data-cancel>Cancel</button><button class="btn" type="submit">Add category</button></div><p role="status"></p></form>';document.body.append(dialog);
 dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.querySelector('form').onsubmit=event=>{event.preventDefault();if(SessionWorkspace.mode==='demo')return;const name=dialog.querySelector('input').value.trim();if(!name)return;hydrate();if(Object.keys(SKILL_TAGS).some(key=>key.toLowerCase()===name.toLowerCase())){dialog.querySelector('[role=status]').textContent='This category already exists.';return}store('sb.skillCategories',[...recall('sb.skillCategories'),name]);hydrate();selected=name;dialog.close();renderSettings()};

 // Edit skill: stage, code editor, and for skills the owner added, the name (or removing it).
 const editor=document.createElement('dialog');editor.id='skill-edit';editor.className='confirm-dlg';editor.setAttribute('aria-labelledby','skill-edit-title');
 editor.innerHTML='<form class="local-panel"><header class="row spread"><h2 id="skill-edit-title">Edit skill</h2><button type="button" class="btn ghost" data-cancel>Close</button></header><label>Skill name<input name="name" maxlength="80" required autocomplete="off"></label><small class="skill-edit-note" data-name-note></small><label>Stage<select name="level"></select></label><label>Code editor<select name="editor"></select></label><div class="class-edit-actions"><button type="button" class="btn danger" data-remove-skill>Remove skill</button><button class="btn class-save" type="submit">Save changes</button></div><p role="status"></p></form>';
 document.body.append(editor);
 const editForm=editor.querySelector('form');let editing=null;
 editForm.elements.level.append(...[1,2,3,4].map(level=>new Option(LVL_NAMES[level],String(level))));
 editForm.elements.editor.append(...WS_CHOICES.map(([value,label])=>new Option(label,value)));
 function openEdit(id){
  const found=find(id);if(!found||readOnly())return;editing=found;const skill=build(found.category,found.skill),custom=isCustom(found.category,found.skill);
  editForm.elements.name.value=found.skill;editForm.elements.name.disabled=!custom;
  editor.querySelector('[data-name-note]').textContent=custom?'':'Built-in skill names stay fixed. Add your own skill to name it freely.';
  editForm.elements.level.value=String(skillLevel(skill));editForm.elements.editor.value=wsEditorOf(found.category,found.skill)||'none';
  editor.querySelector('[data-remove-skill]').hidden=!custom;editor.querySelector('[role=status]').textContent='';
  editor.querySelector('#skill-edit-title').textContent='Edit '+found.category+' › '+found.skill;editor.showModal();
 }
 editor.querySelector('[data-cancel]').onclick=()=>editor.close();
 editor.querySelector('[data-remove-skill]').onclick=()=>{if(!editing)return;try{remove(editing.category,editing.skill);editor.close();renderSettings()}catch(error){editor.querySelector('[role=status]').textContent=error.message}};
 editForm.onsubmit=async event=>{
  event.preventDefault();if(!editing||readOnly())return;const {category,skill}=editing,status=editor.querySelector('[role=status]');
  try{
   const id=skillChannelId(category,skill),level=Number(editForm.elements.level.value),name=editForm.elements.name.value;
   if(!editForm.elements.name.disabled&&clean(name)!==skill)skillsIn(category,liveTools()).forEach(other=>{if(other!==skill&&other.toLowerCase()===clean(name).toLowerCase())throw new Error(`${category} already has ${clean(name)}.`)});
   if(level!==skillLevel(build(category,skill)))update(id,{level});
   if(editForm.elements.editor.value!==(wsEditorOf(category,skill)||'none'))setEditor(id,editForm.elements.editor.value);
   editor.close();
   if(!editForm.elements.name.disabled&&clean(name)&&clean(name)!==skill){const saving=rename(category,skill,name);renderSettings();if(current)refresh();await saving}
   renderSettings();if(current)refresh();
  }catch(error){status.textContent=error.message}
 };

 // Settings → Skills: the same category chips as the menu; each category holds one row per skill (core/settings.js draws the rows).
 SessionTV.hooks.before('dbView:render',view=>{if(view==='skills')hydrate()});
 SessionTV.hooks.after('dbView:render',view=>{
  if(view!=='skills')return;const list=document.querySelector('#set-body .db-list');if(!list)return;
  const categories=subsOf('skill');if(!categories.includes(selected))selected=categories[0];
  const filters=document.createElement('div');filters.className='gd-filt settings-skill-filters';filters.setAttribute('aria-label','Skill categories');filters.setAttribute('role','group');
  const groups=[...list.querySelectorAll(':scope>[data-skill-category]')];
  const apply=()=>{groups.forEach(group=>group.hidden=group.dataset.skillCategory!==selected);filters.querySelectorAll('[data-category]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.category===selected)))};
  for(const category of categories){const button=document.createElement('button');button.type='button';button.dataset.category=category;button.textContent=category;button.onclick=()=>{selected=category;apply()};filters.append(button)}
  const plus=document.createElement('button');plus.type='button';plus.textContent='+ Add category';plus.title='Add skill category';plus.disabled=SessionWorkspace.mode==='demo';plus.onclick=()=>{dialog.querySelector('input').value='';dialog.querySelector('[role=status]').textContent='';dialog.showModal();dialog.querySelector('input').focus()};filters.append(plus);
  list.before(filters);apply();
  list.querySelectorAll('[data-skill-editor]').forEach(select=>{select.disabled=readOnly();select.onchange=()=>{try{setEditor(select.dataset.skillEditor,select.value)}catch(error){toast(error.message)}}});
  list.querySelectorAll('[data-edit-skill]').forEach(button=>{button.disabled=readOnly();button.onclick=()=>openEdit(button.dataset.editSkill)});
 });
 addEventListener('sessiontv:auth',()=>{selected='';editing=null;attempted.clear();dialog.close();editor.close();hydrate()});hydrate();
 globalThis.SessionSkills={hydrate,skillsIn,count,addSkill,channel,channels,practice,setEditor,rename,remove,migratePython,openEdit,setLevel:(id,level)=>update(id,{level}),selected:()=>TV.dbView==='skills'?selected:'',categories:()=>{hydrate();return Object.keys(SKILL_TAGS)}};
})();
