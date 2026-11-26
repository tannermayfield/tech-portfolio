/* Preferences: one tabbed popup for appearance, section identity, voices, music, Canvas, AI connections and
   the coach profile. Appearance works for every visitor; the other tabs need a private workspace. */
(() => {
 const sections=[['class','Classes','Class tutor'],['skill','Skills','Skills coach'],['project','Projects','Project partner']];
 SessionTV.hooks.wrap('theme:pick',(next,section)=>{
  const selected=recall('sb.sectionThemes')[section];
  return (THEMES[section]||[]).find(theme=>theme.id===selected)||next(section);
 });

 // ---------- appearance ----------
 // "TV Screen Effect" (sb.screenEffect) used to switch static and the black-and-white filter together.
 // Split it once into sb.screenStatic and sb.screenColor so existing users keep their look.
 const legacyEffect=recall('sb.screenEffect');
 if(legacyEffect!=null){
  if(recall('sb.screenStatic',null)==null)store('sb.screenStatic',legacyEffect!==false);
  if(recall('sb.screenColor',null)==null)store('sb.screenColor',legacyEffect===false?'color':'bw');
 }
 TV.screenStatic=recall('sb.screenStatic')!==false;
 TV.screenColor=recall('sb.screenColor')==='color'?'color':'bw';
 function applyScreen(){document.body.dataset.screenStatic=TV.screenStatic?'on':'off';document.body.dataset.screenColor=TV.screenColor}
 applyScreen();
 const appearance=[
  ['scheme','Light / dark mode','Auto follows your computer’s setting.',[['auto','Auto'],['light','Light'],['dark','Dark']],()=>TV.scheme,value=>{TV.scheme=value;store('sb.scheme',value);applyScheme()}],
  ['screenStatic','Screen static','Snow, rolling bars, interference lines and scanlines on the picture tube.',[['on','On'],['off','Off']],()=>TV.screenStatic?'on':'off',value=>{TV.screenStatic=value==='on';store('sb.screenStatic',TV.screenStatic);applyScreen()}],
  ['screenColor','Color','Show the picture in color or in black and white.',[['color','Color'],['bw','Black & white']],()=>TV.screenColor,value=>{TV.screenColor=value==='color'?'color':'bw';store('sb.screenColor',TV.screenColor);applyScreen()}],
  ['cut','Channel cutscenes','A short title card when you change channels.',[['4','On'],['0','Off']],()=>String(TV.cutLen),value=>{TV.cutLen=Number(value);store('sb.cutLen',TV.cutLen)}]
 ];

 // ---------- the dialog ----------
 const tabs=[
  ['appearance','Appearance','Light or dark mode, the picture tube and channel cutscenes.',false],
  ['sections','Sections','The character name and background theme for each section.',true],
  ['voices','Voices','Voicebox voices for reading replies aloud in each section.',true],
  ['music','Apple Music','Playlists for TV Radio in each section.',true],
  ['canvas','Canvas','Import classes, assignments and deadlines from BYU Canvas.',true],
  ['ai','AI Connections','ChatGPT, Codex and the local companion on your computer.',true],
  ['coach','Coach','What your coach knows about you and how it helps.',false]
 ];
 const inner={sections:'session-sections',voices:'session-voices',music:'session-music',canvas:'session-canvas'};
 const dialog=document.createElement('dialog');dialog.id='preferences';dialog.className='confirm-dlg preferences-dlg';dialog.setAttribute('aria-labelledby','preferences-heading');
 const seg=([name,label,help,options])=>`<div class="prefs-row"><div class="prefs-row-text"><h4 id="pref-label-${name}">${label}</h4><p id="pref-help-${name}">${help}</p></div><div class="seg" role="group" aria-labelledby="pref-label-${name}" aria-describedby="pref-help-${name}">${options.map(([value,text])=>`<button type="button" data-pref="${name}" data-value="${value}" aria-pressed="false">${text}</button>`).join('')}</div></div>`;
 const body=key=>key==='appearance'?appearance.map(seg).join('')+'<p class="prefs-note" id="pref-private-note">Sign in to set section names, voices, music, Canvas and AI connections.</p>'
  :key==='ai'?`<section class="prefs-group"><h4>Status</h4><div class="connection-summary" data-connection-summary aria-live="polite"></div></section>
   <section class="prefs-group" id="chatgpt-connection"></section>
   <section class="prefs-group" id="ai-connections"><h4>Codex &amp; local AI companion</h4><p class="prefs-status" id="companion-status" role="status"></p>
    <form id="companion-controls" class="prefs-inline" data-write><label for="companion-code">Pairing code</label><div class="prefs-actions"><input id="companion-code" autocomplete="off" type="password"><button class="btn" id="companion-pair" type="submit">Pair companion</button><button class="btn" id="companion-check" type="button">Check status</button><button class="btn ghost" id="companion-guide" type="button">Setup guide</button></div></form></section>`
  :key==='coach'?'<div id="pref-coach-body"></div>'
  :`<div id="${inner[key]}"></div>`;
 dialog.innerHTML=`<div class="prefs"><header class="prefs-head"><h2 id="preferences-heading">Preferences</h2><button class="btn ghost" id="preferences-close" type="button">Close</button></header>
  <div class="prefs-body"><div class="prefs-tabs" role="tablist" aria-label="Preferences" aria-orientation="vertical">${tabs.map(([key,label])=>`<button type="button" role="tab" id="pref-tab-${key}" aria-controls="pref-panel-${key}" aria-selected="false" tabindex="-1" data-pref-tab="${key}">${label}</button>`).join('')}</div>
  <div class="prefs-panels">${tabs.map(([key,label,lede])=>`<section class="prefs-panel" role="tabpanel" id="pref-panel-${key}" aria-labelledby="pref-tab-${key}" tabindex="0" hidden><header class="prefs-panel-head"><h3>${label}</h3><p>${lede}</p></header>${body(key)}</section>`).join('')}</div></div></div>`;
 document.body.appendChild(dialog);
 const q=selector=>dialog.querySelector(selector),tabButtons=[...dialog.querySelectorAll('[role=tab]')];
 const privateMode=()=>SessionWorkspace.mode==='private';
 let selected='appearance',opener=null;

 function syncAppearance(){for(const button of dialog.querySelectorAll('[data-pref]')){const entry=appearance.find(([name])=>name===button.dataset.pref);button.setAttribute('aria-pressed',String(entry[4]()===button.dataset.value))}}
 dialog.addEventListener('click',event=>{const button=event.target.closest('[data-pref]');if(!button)return;appearance.find(([name])=>name===button.dataset.pref)[5](button.dataset.value);syncAppearance()});

 const known=key=>tabs.some(tab=>tab[0]===key),available=key=>known(key)&&(!tabs.find(tab=>tab[0]===key)[3]||privateMode());
 function select(key,focus=false){
  if(!available(key))key='appearance';selected=key;
  for(const button of tabButtons){const on=button.dataset.prefTab===key;button.setAttribute('aria-selected',String(on));button.tabIndex=on?0:-1;$('pref-panel-'+button.dataset.prefTab).hidden=!on}
  if(focus)$('pref-tab-'+key).focus();
  if(key==='coach')renderCoach();
  if(key==='ai')showCompanion();
 }
 for(const button of tabButtons){
  button.onclick=()=>select(button.dataset.prefTab);
  button.onkeydown=event=>{
   const visible=tabButtons.filter(tab=>!tab.hidden),index=visible.indexOf(button),keys={ArrowDown:1,ArrowRight:1,ArrowUp:-1,ArrowLeft:-1};
   let next=null;
   if(event.key in keys)next=visible[(index+keys[event.key]+visible.length)%visible.length];
   else if(event.key==='Home')next=visible[0];else if(event.key==='End')next=visible.at(-1);
   if(next){event.preventDefault();select(next.dataset.prefTab,true)}
  };
 }

 function renderSections(){
  const container=$('session-sections');container.replaceChildren();
  const themes=recall('sb.sectionThemes'),characters=recall('sb.sectionCharacters');
  for(const [key,label,character] of sections){
   const section=document.createElement('section');section.className='section-identity';
   const heading=document.createElement('h4');heading.textContent=label;
   const nameLabel=document.createElement('label');nameLabel.textContent='Character name';
   const name=document.createElement('input');name.value=characters[key]||character;name.maxLength=60;name.dataset.write='';name.setAttribute('aria-label',label+' character name');
   name.onchange=()=>{const values=recall('sb.sectionCharacters');values[key]=name.value.trim()||character;name.value=values[key];store('sb.sectionCharacters',values)};
   nameLabel.appendChild(name);
   const themeLabel=document.createElement('label');themeLabel.textContent='Background theme';
   const picker=document.createElement('select');picker.dataset.write='';picker.setAttribute('aria-label',label+' background theme');picker.add(new Option('Rotate themes',''));
   for(const theme of THEMES[key])picker.add(new Option(theme.name,theme.id));
   picker.value=themes[key]||'';
   picker.onchange=()=>{
    const values=recall('sb.sectionThemes');values[key]=picker.value;store('sb.sectionThemes',values);
    if(current?.mood===key){current.themeId=pickTheme(key).id;saveState();renderWork();renderSong()}
   };
   themeLabel.appendChild(picker);section.append(heading,nameLabel,themeLabel);container.appendChild(section);
  }
 }
 function renderCoach(){
  const panel=$('pref-coach-body');
  if(typeof globalThis.SessionCoachProfile?.render==='function'){try{globalThis.SessionCoachProfile.render(panel)}catch(error){panel.textContent=error.message||'Coach profile could not load.'}}
  else{const note=document.createElement('p');note.className='prefs-note';note.textContent='Coach profile is not available.';panel.replaceChildren(note)}
 }

 // ---------- Codex companion: show the last known status and refresh it quietly ----------
 let companionText='';
 function companionStatus(text){companionText=text;if($('companion-status').textContent!==text)$('companion-status').textContent=text}
 async function checkCompanion(){
  if(!SessionCloud.user)return;
  try{const value=await SessionCompanion.status();companionStatus(value.error||(!value.connected?'Computer disconnected':value.busy?'Codex is working':value.signedIn?'Computer connected · Codex ready':'Computer connected · Sign in to Codex'))}
  catch(error){companionStatus('Disconnected: '+error.message)}
 }
 function showCompanion(){if(!privateMode())return;if(!companionText)companionStatus('Checking computer connection…');checkCompanion()}
 $('companion-controls').onsubmit=async event=>{event.preventDefault();const button=$('companion-pair');button.disabled=true;try{await SessionCompanion.pair($('companion-code').value);$('companion-code').value='';await checkCompanion();globalThis.SessionConnections?.refresh(true)}catch(error){companionStatus(error.message)}finally{button.disabled=false}};
 $('companion-check').onclick=()=>{checkCompanion();globalThis.SessionConnections?.refresh(true)};
 $('companion-guide').onclick=()=>globalThis.SessionConnections?.setup();
 addEventListener('sessiontv:auth',()=>{companionText='';$('companion-status').textContent=''});

 function mount(){
  const signedIn=privateMode();
  for(const button of tabButtons)button.hidden=!available(button.dataset.prefTab);
  $('pref-private-note').hidden=signedIn;
  syncAppearance();
  if(signedIn){
   renderSections();
   globalThis.SessionSpeech?.mountSettings($('session-voices'));
   globalThis.SessionMusic?.mountSettings($('session-music'));
   globalThis.SessionChatGPT?.mountSettings($('chatgpt-connection'));
   globalThis.SessionCanvas?.mountSettings($('session-canvas'));
  }
  select(selected);
  globalThis.SessionConnections?.refresh();
 }
 function open(tab){
  if(tab)selected=String(tab).replace(/^(pref-tab-|session-)/,'');
  if(!dialog.open)opener=document.activeElement;
  mount();dialog.showModal();$('pref-tab-'+selected).focus();
 }
 $('preferences-close').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{$('companion-code').value='';if(opener?.isConnected)opener.focus({preventScroll:true});opener=null});
 SessionTV.hooks.after('settings:render',()=>{if(!TV.dbView&&$('preferences-open'))$('preferences-open').onclick=()=>open()});
 select(selected);
 globalThis.SessionPreferences={open,mount,select,get selected(){return selected}};
})();
