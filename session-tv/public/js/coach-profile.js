/* The coach profile: who the AI coach is tutoring. Every coach prompt (class, skill, project modes,
   teach-back, the code editor lines) reads it through coachProfile() in core/model.js. It is kept in
   sb.coachProfile; its defaults live in core/preferences.js. The Preferences "Coach" tab calls
   SessionCoachProfile.render(tab) to draw the form. */
(()=>{
 const PRONOUNS=[['he/him','He / him'],['she/her','She / her'],['they/them','They / them']];
 const LIMITS={name:80,school:120,goal:200,focus:200};
 const readOnly=()=>SessionWorkspace.mode==='demo'||!!SessionWorkspace.readOnly;
 const get=()=>{const profile=coachProfile();return {...profile,buildProjects:[...profile.buildProjects]}};
 function set(values){
  if(readOnly())throw new Error('You can view this board but not change it.');
  if(!values||typeof values!=='object')throw new Error('Enter the coach profile.');
  const next=get();
  for(const key of Object.keys(LIMITS))if(values[key]!=null)next[key]=String(values[key]).trim().slice(0,LIMITS[key]);
  if(values.pronouns!=null){if(!PRONOUNS.some(([value])=>value===values.pronouns))throw new Error('Choose he/him, she/her or they/them.');next.pronouns=values.pronouns}
  if(values.buildProjects!=null){
   const list=Array.isArray(values.buildProjects)?values.buildProjects:String(values.buildProjects).split(/\n|,/);
   next.buildProjects=[...new Set(list.map(name=>String(name??'').trim().slice(0,120)).filter(Boolean))].slice(0,40);
  }
  store('sb.coachProfile',next);
  dispatchEvent(new CustomEvent('sessiontv:coach-profile',{detail:get()}));
  return get();
 }
 // project names to offer as "build it myself": every project the board knows plus any already listed
 function projectNames(listed){
  const known=[...tasks,...archived].filter(task=>typeOf(task)==='project'&&task.status!=='archived').map(task=>task.course||'Other');
  return [...new Set([...known,...(globalThis.SessionProjectChats?.names?.()||[]),...listed])].filter(Boolean).sort((a,b)=>a.localeCompare(b));
 }
 function field(form,label,control,hint){
  const wrap=document.createElement('label');wrap.className='coach-profile-field';wrap.append(label,control);
  if(hint){const note=document.createElement('small');note.textContent=hint;wrap.append(note)}
  form.append(wrap);return control;
 }
 function input(name,value,placeholder){const control=document.createElement('input');control.name=name;control.value=value;control.maxLength=LIMITS[name];control.autocomplete='off';if(placeholder)control.placeholder=placeholder;return control}
 function render(container){
  if(!container)return null;
  const profile=get(),locked=readOnly(),form=document.createElement('form');form.dataset.write='disable';
  form.className='coach-profile-form';form.noValidate=true;form.setAttribute('aria-label','Coach profile');
  const intro=document.createElement('p');intro.className='coach-profile-intro';intro.textContent='The AI coach uses this to talk about you, set its examples and decide which projects it should never build for you.';form.append(intro);
  field(form,'Name',input('name',profile.name,'Your first name'));
  const pronouns=document.createElement('select');pronouns.name='pronouns';for(const [value,label] of PRONOUNS)pronouns.append(new Option(label,value,false,value===profile.pronouns));
  field(form,'Pronouns',pronouns);
  field(form,'School or program',input('school',profile.school,'e.g. Information Systems'));
  field(form,'Goal',input('goal',profile.goal,'e.g. a data analyst internship'),'What you are preparing for, written to follow "preparing for".');
  field(form,'Focus skills',input('focus',profile.focus,'e.g. SQL, Python'));
  const group=document.createElement('fieldset');group.className='coach-profile-projects';
  const legend=document.createElement('legend');legend.textContent='Projects I build myself';group.append(legend);
  const note=document.createElement('small');note.textContent='For these projects the coach teaches and hints, but never writes your code or config.';group.append(note);
  const names=projectNames(profile.buildProjects);
  if(!names.length){const empty=document.createElement('p');empty.className='db-empty';empty.textContent='No projects yet.';group.append(empty)}
  for(const name of names){const row=document.createElement('label');row.className='coach-profile-project';const box=document.createElement('input');box.type='checkbox';box.name='buildProjects';box.value=name;box.checked=profile.buildProjects.includes(name);row.append(box,document.createTextNode(' '+name));group.append(row)}
  form.append(group);
  const actions=document.createElement('div');actions.className='row coach-profile-actions';
  const save=document.createElement('button');save.type='submit';save.className='btn';save.dataset.write='';save.textContent='Save coach profile';actions.append(save);form.append(actions);
  const status=document.createElement('p');status.setAttribute('role','status');form.append(status);
  form.querySelectorAll('input,select,button').forEach(control=>control.disabled=locked);
  if(locked)status.textContent='Sign in to your private session to change the coach profile.';
  form.onsubmit=event=>{
   event.preventDefault();if(readOnly())return;
   const data=new FormData(form);
   try{set({name:data.get('name'),pronouns:data.get('pronouns'),school:data.get('school'),goal:data.get('goal'),focus:data.get('focus'),buildProjects:data.getAll('buildProjects')});status.textContent='Saved. The coach uses this from your next message.'}
   catch(error){status.textContent=error.message}
  };
  container.replaceChildren(form);
  return form;
 }
 globalThis.SessionCoachProfile=Object.freeze({get,set,render});
})();
