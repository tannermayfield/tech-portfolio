/* Every sb.* preference key the app keeps in SessionWorkspace.storage, with its default.
   recall(key) with no fallback returns a fresh copy of the default listed here. Values are stored as
   JSON through store()/recall() unless the entry says format:'text' (written with storage.setItem). Add
   new keys here when you add them to the app. Storage location is unchanged: this is a registry only. */
(() => {
 const entries=[
  // Appearance and TV controls
  ['sb.scheme','auto','Light / dark mode: auto, light or dark.'],
  ['sb.cutLen',4,'Channel cutscene length in seconds (0 turns cutscenes off).'],
  ['sb.screenStatic',true,'Screen static on or off: snow, rolling bars, interference lines and scanlines.'],
  ['sb.screenColor','bw','Picture color: "bw" (black and white) or "color".'],
  ['sb.screenEffect',null,'Replaced by sb.screenStatic and sb.screenColor; read once to migrate (false meant static off, color on).'],
  ['sb.tvsub',{},'Last sub-channel chosen per section, e.g. {skill:"Data"}.'],
  ['sb.ttRange','14','Settings → Time Stats range: last, 14 or all.','text'],
  ['sb.sectionThemes',{},'Background theme chosen per section; empty means rotate.'],
  ['sb.sectionCharacters',{},'Character name shown per section.'],
  // Records kept beside the database
  ['sb.classes',{},'Classes by name with description, URL and Canvas link.'],
  ['sb.skillCategories',[],'Custom skill categories added in Settings.'],
  ['sb.skills',{},'Custom skills by category.'],
  ['sb.skillChannels',{},'Per-skill channel state by skill channel id: level, practice stamps and code editor (none, sql, python, js or html; unset uses the default for the skill name).'],
  // AI coach
  ['sb.coachProfile',{name:'Tanner',pronouns:'he/him',school:'BYU Information Systems',goal:'a data analyst co-op interview at Delta Air Lines',focus:'SQL, Python, AWS data pipelines',buildProjects:['Airline Pipeline']},'Who the AI coach tutors: name, pronouns (he/him, she/her or they/them), school or program, goal, focus skills, and the projects the learner builds without AI writing the code.'],
  // Chats
  ['sb.localChats',null,'Work chat turns for the current session, restored after a reload.'],
  ['sb.studyChats',{},'Class and skill study chat histories by task id.'],
  ['sb.studyChatAccount',null,'ChatGPT account the study chats belong to.'],
  ['sb.chatgptAccount',null,'ChatGPT account last connected.'],
  ['sb.chatgptChats',[],'General ChatGPT chats.'],
  ['sb.chatgptPlanWelcome',false,'Whether the ChatGPT plan welcome note was dismissed.'],
  ['sb.projectCodingChats',{},'Plan, Apply and Work Codex chats per project.'],
  ['sb.codexApproval:',null,'Prefix: Codex approval mode per project task (sb.codexApproval:<task>).'],
  // Integrations
  ['sb.music',{},'TV Radio playlists, player and autoplay choices.'],
  ['sb.voice',{baseUrl:'http://127.0.0.1:17493',voices:{}},'Voicebox endpoint and voices per section.'],
  ['sb.canvasAccount',null,'Canvas account id the synced data belongs to.'],
  ['sb.canvasCourses',{},'Canvas course id to class name.'],
  ['sb.canvasExcludedCourses',[],'Canvas course ids excluded from sync.'],
  ['sb.canvasAvailableCourses',null,'Canvas course ids seen in the latest sync.'],
  ['sb.canvasLastSync',null,'Time of the last successful Canvas sync.'],
  ['sb.canvasSync',true,'Daily automatic Canvas sync on or off.'],
  ['sb.canvasAutoSyncDay',null,'Day the automatic Canvas sync last ran.'],
  // Code editor
  ['sb.ws.',null,'Prefix: editor draft per skill (sb.ws.<task>).','text'],
  ['sb.wsW',0,'Code editor panel width in pixels (0 = automatic).','text'],
  ['sb.wsOutH',0,'Code editor output height in pixels (0 = automatic).','text']
 ];
 // Written by the removed planning screen; still included in backups, never read.
 const legacy=['sb.draft2','sb.filters','sb.lvlSort','sb.showSub','sb.tabs2','sb.tlHidden','sb.warpStars','sb.wsGone'];
 const byKey=new Map(entries.map(([key,value,description,format='json'])=>[key,Object.freeze({key,default:value,description,format})]));
 function get(key){if(byKey.has(key))return byKey.get(key);for(const entry of byKey.values())if(entry.key.endsWith('.')||entry.key.endsWith(':')){if(String(key).startsWith(entry.key))return entry}return null}
 function defaultFor(key){const entry=get(key);return entry&&entry.default!==null&&typeof entry.default==='object'?JSON.parse(JSON.stringify(entry.default)):entry?.default}
 globalThis.SessionTV=Object.assign(globalThis.SessionTV||{},{preferences:Object.freeze({get,defaultFor,list:()=>[...byKey.values()],legacy:Object.freeze(legacy)})});
})();
