/* Public demo snapshot allowlist. Shared by the browser (SessionDemoSnapshot), scripts/publish-preview.mjs
   and the local companion, which validates every published snapshot again before writing demo-data.js.
   Only the fields named here are published. Everything else, including chats, prompts, Canvas data,
   computer folders, account ids and session recaps, is dropped. */
(function(root){
 'use strict';
 const KEY='sessiontv.database.v1';
 const TASK_FIELDS=['track','title','course','cat','goal','status','order','due','dueTime','leadDays','level','phase','reps','lastPracticed','doneAt'];
 const SPRINT_FIELDS=['num','goal','start','end','status','step'];
 const SPRINT_ITEM_FIELDS=['id','pts','who'];
 const SESSION_FIELDS=['date','minutes','track'];
 const CLASS_FIELDS=['code','name'];
 const SKILL_CHANNEL_FIELDS=['level','reps','lastPracticed','editor'];
 const SECTIONS=['class','skill','project'];
 const ASSIGNEES=['','me','ai'];
 const PREFERENCE_KEYS=['sb.classes','sb.skillCategories','sb.skills','sb.skillChannels','sb.sectionThemes','sb.sectionCharacters'];
 const MAX_TEXT=4000,MAX_NAME=300,MAX_RECORDS=5000,MAX_LIST=500;
 const SETTINGS={main:{portfolioUrl:'https://tannermayfield.dev/',autoOpen:false}};
 // __proto__ would set the prototype when demo-data.js is parsed as an object literal.
 const ID={test:id=>typeof id==='string'&&/^[\w-]{1,200}$/.test(id)&&id!=='__proto__'};

 const fail=message=>{throw new Error(message)};
 const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const hasOwn=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
 const entries=(value,label)=>{if(value==null)return [];if(!isObject(value))fail('Invalid '+label+'.');const list=Object.entries(value);if(list.length>MAX_RECORDS)fail('Too many '+label+'.');return list};
 function scalar(value,key,max=MAX_TEXT){
  if(value===null||typeof value==='boolean')return value;
  if(typeof value==='number'){if(!Number.isFinite(value))fail('Invalid public field: '+key);return value}
  if(typeof value==='string'){if(value.length>max)fail('Public field is too long: '+key);return value}
  return fail('Invalid public field: '+key);
 }
 const select=(value,fields)=>Object.fromEntries(fields.filter(key=>hasOwn(value,key)).map(key=>[key,scalar(value[key],key)]));
 const text=(value,max=MAX_NAME)=>typeof value==='string'&&value.trim()&&value.length<=max&&value!=='__proto__'?value:null;
 const texts=(value,max=MAX_NAME)=>Array.isArray(value)?value.slice(0,MAX_LIST).map(item=>text(item,max)).filter(item=>item!==null):[];

 function sprint(value){
  if(!isObject(value))return null;
  const record=select(value,SPRINT_FIELDS);
  record.items=(Array.isArray(value.items)?value.items.slice(0,MAX_LIST):[]).map(item=>typeof item==='string'?scalar(item,'items'):isObject(item)?select(item,SPRINT_ITEM_FIELDS):null).filter(item=>item!==null);
  return record;
 }
 function project(value){
  const record=select(value,['name']);
  if(Array.isArray(value.skills))record.skills=texts(value.skills);
  const current=sprint(value.sprint);if(current)record.sprint=current;
  if(Array.isArray(value.past))record.past=value.past.slice(0,MAX_LIST).map(sprint).filter(Boolean);
  if(Array.isArray(value.taskOrder))record.taskOrder=value.taskOrder.slice(0,MAX_RECORDS).filter(id=>typeof id==='string'&&ID.test(id));
  if(isObject(value.taskAssignments))record.taskAssignments=Object.fromEntries(entries(value.taskAssignments,'assignments').filter(([id,who])=>ID.test(id)&&ASSIGNEES.includes(who)));
  return record;
 }
 function session(value){
  if(typeof value.date!=='string'||Number.isNaN(Date.parse(value.date)))return null;
  const record=select(value,SESSION_FIELDS);
  if(isObject(value.byTrack))record.byTrack=Object.fromEntries(Object.entries(value.byTrack).filter(([key,minutes])=>/^[\w-]{1,40}$/.test(key)&&key!=='__proto__'&&typeof minutes==='number'&&Number.isFinite(minutes)));
  return record;
 }
 function collection(source,label,build){
  const out=[];
  for(const [id,value] of entries(source,label)){
   if(!ID.test(id)||!isObject(value))fail('Invalid '+label+' record.');
   const record=build(value);if(record)out.push([id,record]);
  }
  return Object.fromEntries(out);
 }
 function database(original){
  if(!isObject(original))fail('Invalid database.');
  return {
   tasks:collection(original.tasks,'tasks',task=>select(task,TASK_FIELDS)),
   projects:collection(original.projects,'projects',project),
   sessions:collection(original.sessions,'sessions',session),
   state:{},
   settings:JSON.parse(JSON.stringify(SETTINGS))
  };
 }
 const named=(value,build)=>Object.fromEntries(entries(isObject(value)?value:{},'records').map(([key,item])=>[text(key),build(item)]).filter(([key,item])=>key!==null&&item!==null));
 const section=value=>Object.fromEntries(SECTIONS.filter(key=>isObject(value)&&text(value[key],200)!==null).map(key=>[key,value[key]]));
 const PREFERENCES={
  'sb.classes':value=>named(value,item=>isObject(item)?select(item,CLASS_FIELDS):{}),
  'sb.skillCategories':value=>texts(value),
  'sb.skills':value=>named(value,item=>texts(item)),
  'sb.skillChannels':value=>Object.fromEntries(entries(isObject(value)?value:{},'skill levels').filter(([id,item])=>typeof id==='string'&&id.startsWith('skill:')&&id.length<=600&&isObject(item)).map(([id,item])=>[id,select(item,SKILL_CHANNEL_FIELDS)])),
  'sb.sectionThemes':section,
  'sb.sectionCharacters':section
 };
 function preferences(read){
  const out=[];
  for(const key of PREFERENCE_KEYS){const value=read(key);if(value!==undefined)out.push([key,PREFERENCES[key](value)])}
  return Object.fromEntries(out);
 }
 const parse=raw=>{if(typeof raw!=='string')return undefined;try{return JSON.parse(raw)}catch{return undefined}};
 const timestamp=value=>typeof value==='string'&&!Number.isNaN(Date.parse(value))?new Date(value).toISOString():new Date().toISOString();

 // Full backup (from SessionCloud.exportBackup or a backup file) to a public snapshot.
 function publicSnapshot(backup,{publishedAt}={}){
  if(backup?.format!=='session-tv-backup'||backup.version!==1||!isObject(backup.values)||typeof backup.values[KEY]!=='string')fail('Choose a Session TV JSON backup.');
  return {version:1,source:'owner',publishedAt:timestamp(publishedAt),database:database(JSON.parse(backup.values[KEY])),preferences:preferences(key=>hasOwn(backup.values,key)?parse(backup.values[key]):undefined)};
 }
 // Re-apply the allowlist to a snapshot that is already in public form.
 function sanitizeSnapshot(snapshot){
  if(!isObject(snapshot)||snapshot.version!==1||snapshot.source!=='owner'||!isObject(snapshot.database))fail('Invalid demo snapshot.');
  if(snapshot.preferences!==undefined&&!isObject(snapshot.preferences))fail('Invalid demo preferences.');
  const values=snapshot.preferences||{};
  return {version:1,source:'owner',publishedAt:timestamp(snapshot.publishedAt),database:database(snapshot.database),preferences:preferences(key=>hasOwn(values,key)?values[key]:undefined)};
 }
 const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':isObject(value)?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}':JSON.stringify(value);
 // Reject any snapshot carrying a field or record the allowlist would drop.
 function validateSnapshot(snapshot){
  const clean=sanitizeSnapshot(snapshot);
  const extra=Object.keys(snapshot).filter(key=>!['version','source','publishedAt','database','preferences'].includes(key));
  if(extra.length||typeof snapshot.publishedAt!=='string'||Number.isNaN(Date.parse(snapshot.publishedAt)))fail('The demo snapshot has fields outside the public allowlist.');
  if(canonical({database:clean.database,preferences:clean.preferences})!==canonical({database:snapshot.database,preferences:snapshot.preferences||{}}))fail('The demo snapshot has fields outside the public allowlist.');
  return clean;
 }
 function renderDemoFile(snapshot){
  const clean=validateSnapshot(snapshot);
  return '// Public read-only snapshot published by the owner. Chats, prompts, Canvas data, folders and account ids are excluded.\nwindow.SessionTVDemo = '+JSON.stringify(clean,null,1).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';\n';
 }
 // What the review dialog lists before publishing.
 function summary(snapshot){
  const db=snapshot.database,prefs=snapshot.preferences||{};
  const tasks=Object.values(db.tasks),kind=task=>task.track==='class'?'class':task.track==='practice'||task.track==='develop'?'skill':'project';
  const title=value=>String(value||'Untitled');
  const groups=[
   ['Class assignments',tasks.filter(task=>kind(task)==='class').map(task=>title(task.title)+(task.course?' — '+task.course:''))],
   ['Skill tools',tasks.filter(task=>kind(task)==='skill').map(task=>title(task.title)+(task.course?' — '+task.course:''))],
   ['Project tasks',tasks.filter(task=>kind(task)==='project').map(task=>title(task.title)+(task.course?' — '+task.course:''))],
   ['Projects',Object.values(db.projects).map(project=>title(project.name))],
   ['Classes',Object.entries(prefs['sb.classes']||{}).map(([key,value])=>value.code&&value.name?value.code+' — '+value.name:key)],
   ['Skill categories',prefs['sb.skillCategories']||[]],
   ['Custom skills',Object.entries(prefs['sb.skills']||{}).flatMap(([category,names])=>names.map(name=>category+' › '+name))],
   ['Skill levels',Object.entries(prefs['sb.skillChannels']||{}).map(([id,value])=>id.split(':').slice(1).map(part=>{try{return decodeURIComponent(part)}catch{return part}}).join(' › ')+(value.level?' — '+(['','New','Learned','Experienced','Mastered'][value.level]||'New'):''))],
   ['Section themes',Object.entries(prefs['sb.sectionThemes']||{}).map(([key,value])=>key+': '+value)],
   ['Section characters',Object.entries(prefs['sb.sectionCharacters']||{}).map(([key,value])=>key+': '+value)],
   ['Study sessions (date, minutes and time split only)',Object.values(db.sessions).map(item=>String(item.date).slice(0,10)+(item.minutes?' · '+item.minutes+' min':''))]
  ];
  return groups.map(([label,items])=>({label,count:items.length,items}));
 }
 const api={KEY,TASK_FIELDS,SPRINT_FIELDS,SPRINT_ITEM_FIELDS,SESSION_FIELDS,CLASS_FIELDS,SKILL_CHANNEL_FIELDS,PREFERENCE_KEYS,publicSnapshot,sanitizeSnapshot,validateSnapshot,renderDemoFile,summary};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.SessionDemoSnapshot=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this);
