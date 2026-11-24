/* Shared skill categories and skills for the menu and settings.
   Category (Data) → Skill (SQL) → Tool (CTEs). Tools are the skill task records:
   a tool's `course` is its skill and its `cat` is its category. */
(()=>{
 const defaults=Object.fromEntries(Object.entries(SKILL_TAGS).map(([key,skills])=>[key,[...skills]]));let selected='';
 const clean=value=>typeof value==='string'?value.trim():'';
 function hydrate(){
  for(const key of Object.keys(SKILL_TAGS))if(!Object.hasOwn(defaults,key))delete SKILL_TAGS[key];
  for(const [key,skills] of Object.entries(defaults))SKILL_TAGS[key]=[...skills];
  for(const name of recall('sb.skillCategories',[]).map(clean))if(name&&!Object.hasOwn(SKILL_TAGS,name))SKILL_TAGS[name]=[];
  const custom=recall('sb.skills',{});
  for(const [category,names] of Object.entries(custom&&typeof custom==='object'?custom:{})){
   if(!Object.hasOwn(SKILL_TAGS,category)||!Array.isArray(names))continue;
   for(const name of names.map(clean))if(name&&!SKILL_TAGS[category].includes(name))SKILL_TAGS[category].push(name);
  }
 }
 // Skills in a category: the listed ones first, then any skill a tool uses that the list leaves out.
 function skillsIn(category,tools=[]){
  const listed=SKILL_TAGS[category]||[];
  const extra=[...new Set(tools.filter(tool=>catOf(tool)===category).map(tool=>tool.course||'Other'))].filter(name=>!listed.includes(name));
  return [...listed,...extra];
 }
 function addSkill(name,category){
  name=clean(name);category=clean(category);hydrate();
  if(!name)throw new Error('Enter a skill name.');
  if(!Object.hasOwn(SKILL_TAGS,category))throw new Error('Choose a category.');
  if(SKILL_TAGS[category].some(skill=>skill.toLowerCase()===name.toLowerCase()))throw new Error(`${category} already has ${name}.`);
  const custom=recall('sb.skills',{});store('sb.skills',{...custom,[category]:[...(Array.isArray(custom[category])?custom[category]:[]),name]});
  hydrate();selected=category;
 }
 // A skill channel stands in for one skill in the menu and owns its chat, like a project channel.
 // Its level and practice time live with the skill; its tools are the skill's open records.
 const channelId=(category,skill)=>'skill:'+encodeURIComponent(category)+':'+encodeURIComponent(skill);
 const toolsOf=(category,skill)=>tasks.filter(task=>typeOf(task)==='skill'&&!['archived','done'].includes(task.status)&&catOf(task)===category&&(task.course||'Other')===skill).sort(byOrder);
 const latest=values=>values.filter(Boolean).sort().pop()||null;
 function build(category,skill){
  const id=channelId(category,skill),tools=toolsOf(category,skill),own=recall('sb.skillChannels',{})[id]||{};
  const level=own.level||Math.max(0,...tools.map(skillLevel))||1;
  return {id,track:level>=3?'practice':'develop',title:skill,course:skill,cat:category,status:'todo',level,skillChannel:true,
   lastPracticed:latest([own.lastPracticed,...tools.map(tool=>tool.lastPracticed)]),reps:own.reps||0,toolIds:tools.map(tool=>tool.id),tools:tools.map(tool=>tool.title)};
 }
 const channels=category=>skillsIn(category,tasks.filter(task=>typeOf(task)==='skill'&&task.status!=='archived')).map(skill=>build(category,skill));
 function channel(id){
  if(typeof id!=='string'||!id.startsWith('skill:'))return null;
  for(const category of Object.keys(SKILL_TAGS))for(const skill of skillsIn(category,tasks.filter(task=>typeOf(task)==='skill'&&task.status!=='archived')))if(channelId(category,skill)===id)return build(category,skill);
  return null;
 }
 function update(id,values){const all=recall('sb.skillChannels',{});store('sb.skillChannels',{...all,[id]:{...all[id],...values}});}
 // Practicing a skill stamps the skill and each of its open tools.
 async function practice(id){
  const skill=channel(id);if(!skill)return;const at=new Date().toISOString();
  update(id,{lastPracticed:at,reps:skill.reps+1});
  await Promise.all(skill.toolIds.map(toolId=>db.doc('tasks/'+toolId).update({lastPracticed:at,reps:(T(toolId)?.reps||0)+1})));
 }
 const baseSubs=subsOf;subsOf=function(kind){if(kind==='skill')hydrate();return baseSubs(kind)};
 const dialog=document.createElement('dialog');dialog.className='confirm-dlg';dialog.innerHTML='<form class="local-panel"><h2>Add skill category</h2><label>Category name<input name="category" required maxlength="60" autocomplete="off"></label><div class="row"><button type="button" class="btn ghost" data-cancel>Cancel</button><button class="btn" type="submit">Add category</button></div><p role="status"></p></form>';document.body.append(dialog);
 dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.querySelector('form').onsubmit=event=>{event.preventDefault();if(SessionWorkspace.mode==='demo')return;const name=dialog.querySelector('input').value.trim();if(!name)return;hydrate();if(Object.keys(SKILL_TAGS).some(key=>key.toLowerCase()===name.toLowerCase())){dialog.querySelector('[role=status]').textContent='This category already exists.';return}store('sb.skillCategories',[...recall('sb.skillCategories',[]),name]);hydrate();selected=name;dialog.close();renderSettings()};
 // Settings → Skills: the same category chips as the menu; each category section holds one row per skill with its tools below.
 const base=renderDbView;renderDbView=function(view){if(view==='skills')hydrate();base.apply(this,arguments);if(view!=='skills')return;const list=document.querySelector('#set-body .db-list');if(!list)return;const categories=subsOf('skill');if(!categories.includes(selected))selected=categories[0];const filters=document.createElement('div');filters.className='gd-filt settings-skill-filters';filters.setAttribute('aria-label','Skill categories');filters.setAttribute('role','group');const groups=[...list.querySelectorAll(':scope>[data-skill-category]')];const apply=()=>{groups.forEach(group=>group.hidden=group.dataset.skillCategory!==selected);filters.querySelectorAll('[data-category]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.category===selected)))};for(const category of categories){const button=document.createElement('button');button.type='button';button.dataset.category=category;button.textContent=category;button.onclick=()=>{selected=category;apply()};filters.append(button)}const plus=document.createElement('button');plus.type='button';plus.textContent='+';plus.setAttribute('aria-label','Add skill category');plus.title='Add skill category';plus.disabled=SessionWorkspace.mode==='demo';plus.onclick=()=>{dialog.querySelector('input').value='';dialog.querySelector('[role=status]').textContent='';dialog.showModal();dialog.querySelector('input').focus()};filters.append(plus);list.before(filters);apply();};
 addEventListener('sessiontv:auth',()=>{selected='';dialog.close();hydrate()});hydrate();
 globalThis.SessionSkills={hydrate,skillsIn,addSkill,channel,channels,practice,setLevel:(id,level)=>update(id,{level}),selected:()=>TV.dbView==='skills'?selected:'',categories:()=>{hydrate();return Object.keys(SKILL_TAGS)}};
})();
