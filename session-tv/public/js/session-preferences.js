/* Private section identity and integration settings. */
(() => {
 const sections=[['class','Classes','Class tutor'],['skill','Skills','Skills coach'],['project','Projects','Project partner']];
 const defaultPick=pickTheme;
 pickTheme=function(section){
  const selected=recall('sb.sectionThemes',{})[section];
  return (THEMES[section]||[]).find(theme=>theme.id===selected)||defaultPick(section);
 };
 let selectedTab='session-sections';
 function selectTab(id){
  selectedTab=id;
  document.querySelectorAll('[data-session-tab]').forEach(button=>{
   const selected=button.dataset.sessionTab===id;
   button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
   document.getElementById(button.dataset.sessionTab).hidden=!selected;
  });
 }
 function renderSections(){
  const container=document.getElementById('session-sections');container.replaceChildren();
  const themes=recall('sb.sectionThemes',{}),characters=recall('sb.sectionCharacters',{});
  for(const [key,label,character] of sections){
   const section=document.createElement('section');section.className='section-identity';
   const heading=document.createElement('h3');heading.textContent=label;
   const nameLabel=document.createElement('label');nameLabel.textContent='Character name';
   const name=document.createElement('input');name.value=characters[key]||character;name.maxLength=60;name.setAttribute('aria-label',label+' character name');
   name.onchange=()=>{const values=recall('sb.sectionCharacters',{});values[key]=name.value.trim()||character;name.value=values[key];store('sb.sectionCharacters',values)};
   nameLabel.appendChild(name);
   const themeLabel=document.createElement('label');themeLabel.textContent='Background theme';
   const select=document.createElement('select');select.setAttribute('aria-label',label+' background theme');select.add(new Option('Rotate themes',''));
   for(const theme of THEMES[key])select.add(new Option(theme.name,theme.id));
   select.value=themes[key]||'';
   select.onchange=()=>{
    const values=recall('sb.sectionThemes',{});values[key]=select.value;store('sb.sectionThemes',values);
    if(current?.mood===key){current.themeId=pickTheme(key).id;saveState();renderWork();renderSong()}
   };
   themeLabel.appendChild(select);section.append(heading,nameLabel,themeLabel);container.appendChild(section);
  }
 }
 document.querySelectorAll('[data-session-tab]').forEach(button=>{
  button.onclick=()=>selectTab(button.dataset.sessionTab);
  button.onkeydown=event=>{
   const tabs=[...document.querySelectorAll('[data-session-tab]')],index=tabs.indexOf(button);
   let next;
   if(event.key==='ArrowRight')next=tabs[(index+1)%tabs.length];
   if(event.key==='ArrowLeft')next=tabs[(index+tabs.length-1)%tabs.length];
   if(event.key==='Home')next=tabs[0];if(event.key==='End')next=tabs.at(-1);
   if(next){event.preventDefault();selectTab(next.dataset.sessionTab);next.focus()}
  };
 });
 globalThis.SessionPreferences={mount(){
  if(SessionWorkspace.mode!=='private')return;
  renderSections();
  globalThis.SessionSpeech?.mountSettings(document.getElementById('session-voices'));
  globalThis.SessionMusic?.mountSettings(document.getElementById('session-music'));
  globalThis.SessionChatGPT?.mountSettings(document.getElementById('chatgpt-connection'));
  globalThis.SessionCanvas?.mountSettings(document.getElementById('session-canvas'));
  selectTab(selectedTab);
 }};
 selectTab(selectedTab);
})();
