/* Apple Music playback uses MusicKit without an embedded player. */
(() => {
 const sections={class:'Classes',skill:'Skills',project:'Projects'};
 let music=null,loading=null,connecting=null,configuredToken='',queue=Promise.resolve(),generation=0,connectionRevision=0;
 let queuedKey='',section='',statusText='',library=[],panel=null,wantsPlayback=false;
 const privateMode=()=>globalThis.SessionWorkspace?.mode==='private';
 const preferences=()=>recall('sb.music',{});
 const tokenKey=()=> 'sessiontv.musickit.'+(globalThis.SessionCloud?.user?.id||'local');
 const savedToken=()=>{try{return localStorage.getItem(tokenKey())||''}catch{return ''}};
 function requirePrivate(){if(!privateMode())throw new Error('Sign in to connect Apple Music.');}
 function currentSection(){return (TV.mode==='guide'?TV.guideCat:null)||current?.mood||'class';}
 function mapping(kind){const configured=preferences().playlists?.[kind];if(configured)return configured;const old=typeof playlistUrl==='function'?playlistUrl(kind):'';return old?{url:old,name:sections[kind]}:null;}
 function validateURL(value){
  if(!value)return '';
  let url;try{url=new URL(value)}catch{throw new Error('Paste an Apple Music playlist share link.');}
  if(url.protocol!=='https:'||url.hostname!=='music.apple.com'||!(/^\/(?:[a-z]{2}\/)?playlist\//i.test(url.pathname)||/^\/library\/playlists?\//.test(url.pathname))||url.username||url.password)throw new Error('Use a playlist link from music.apple.com.');
  url.search='';url.hash='';return url.href;
 }
 function message(text){statusText=text;updatePanel();renderPlayer();}
 function authorized(){return !!music?.isAuthorized;}
 function playing(){return !!music?.isPlaying;}
 async function loadSDK(){
  if(globalThis.MusicKit)return MusicKit;
  if(loading)return loading;
  loading=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='https://js-cdn.music.apple.com/musickit/v3/musickit.js';script.async=true;
   function cleanup(){clearTimeout(timeout);document.removeEventListener('musickitloaded',ready);script.onload=null;script.onerror=null;}
   function fail(text){cleanup();script.remove();loading=null;reject(new Error(text));}
   function ready(){if(!globalThis.MusicKit)return;cleanup();resolve(MusicKit);}
   const timeout=setTimeout(()=>fail('Apple Music took too long to initialize. Try connecting again.'),20000);
   document.addEventListener('musickitloaded',ready);
   script.onload=ready;
   script.onerror=()=>fail('Apple Music could not load. Check your connection and try again.');
   document.head.appendChild(script);
  });return loading;
 }
 function playbackChanged(){
  if(!authorized()){wantsPlayback=false;queuedKey='';}
  updatePanel();renderPlayer();
 }
 function playbackError(error){
  wantsPlayback=false;generation++;
  message(error?.message||'Apple Music playback failed. Check your subscription and press Play to try again.');
 }
 function drmUnsupported(){
  wantsPlayback=false;generation++;music?.pause();
  message('Full Apple Music playback is unavailable in this browser. Check protected-content permissions.');
 }
 const musicEvents={playbackStateDidChange:playbackChanged,nowPlayingItemDidChange:playbackChanged,authorizationStatusDidChange:playbackChanged,mediaPlaybackError:playbackError,drmUnsupported};
 function attachEvents(){for(const [name,handler]of Object.entries(musicEvents))music.addEventListener(name,handler);}
 function detachEvents(){for(const [name,handler]of Object.entries(musicEvents))music?.removeEventListener(name,handler);}
 async function connect(token){
  requirePrivate();if(connecting)return connecting;
  const revision=connectionRevision;
  connecting=(async()=>{
   const value=String(token||savedToken()).trim();
   if(!value||value.includes('PRIVATE KEY')||value.split('.').length!==3)throw new Error('Add a MusicKit developer token to connect Apple Music.');
   message('Connecting Apple Music…');
   const SDK=await loadSDK();requirePrivate();
   if(revision!==connectionRevision)throw new Error('Apple Music connection cancelled.');
   if(!music){
    await SDK.configure({developerToken:value,app:{name:'SessionTV',build:'1.0'},declarativeMarkup:false});requirePrivate();
    if(revision!==connectionRevision)throw new Error('Apple Music connection cancelled.');
    music=SDK.getInstance();configuredToken=value;attachEvents();
   }
   else if(value!==configuredToken)throw new Error('Disconnect Apple Music before replacing its developer token.');
   await music.authorize();requirePrivate();
   if(revision!==connectionRevision)throw new Error('Apple Music connection cancelled.');
   if(!authorized())throw new Error('Apple Music sign-in was cancelled. Click Connect Apple Music to try again.');
   try{localStorage.setItem(tokenKey(),value)}catch{}
   message('Apple Music connected');return music;
  })();
  try{return await connecting}catch(error){message(error.message||'Apple Music could not connect.');throw error}finally{connecting=null;updatePanel()}
 }
 async function disconnect(){
  generation++;connectionRevision++;wantsPlayback=false;queuedKey='';
  if(music){await music.pause();await music.unauthorize();}
  try{localStorage.removeItem(tokenKey())}catch{}
  detachEvents();music=null;configuredToken='';library=[];message('Apple Music disconnected');updateLibrary();
 }
 async function loadLibrary(){
  requirePrivate();if(!authorized())throw new Error('Connect Apple Music to select library playlists.');
  await music.authorize();requirePrivate();if(!authorized())throw new Error('Authorize Apple Music to load your playlists.');
  const items=[],visited=new Set();let next='/v1/me/library/playlists?limit=100';
  while(next){
   if(visited.has(next))throw new Error('Apple Music returned a repeated playlist page. Try loading playlists again.');
   visited.add(next);
   const result=await music.api.music(next),body=result.data;
   items.push(...(body?.data||[]));
   next=body?.next||'';
   if(next&&!next.startsWith('/v1/me/library/playlists'))throw new Error('Apple Music returned an unexpected playlist page.');

  }
  library=items.map(item=>({id:item.id,name:item.attributes?.name||'Untitled playlist',url:item.attributes?.url||''}));updateLibrary();message(library.length+' library playlists loaded');
 }
 function desiredKey(value){return value?.libraryId?'library:'+value.libraryId:value?.url||'';}
 function schedulePlaylist(kind,play){
  const revision=++generation,value=mapping(kind),key=desiredKey(value);
  queue=queue.catch(()=>{}).then(async()=>{
   if(revision!==generation)return;
   requirePrivate();if(!authorized())throw new Error('Connect Apple Music in Session Preferences.');
   if(!key){await music.pause();queuedKey='';wantsPlayback=false;throw new Error('Choose a '+sections[kind]+' playlist in Session Preferences.');}
   if(key!==queuedKey){
    await music.pause();if(revision!==generation)return;
    await music.setQueue(value.libraryId?{playlist:value.libraryId}:{url:validateURL(value.url)});
    if(revision!==generation)return;
    queuedKey=key;
   }
   if(revision!==generation)return;
   if(play){await music.play();if(revision!==generation||!privateMode())await music.pause();}
   statusText='';updatePanel();renderPlayer();
  }).catch(error=>{if(revision!==generation)return;wantsPlayback=false;message(error.message||'Playback could not start. Press Play to try again.');});
  return queue;
 }
 async function control(action){
  requirePrivate();if(!authorized())throw new Error('Connect Apple Music in Session Preferences.');
  if(action==='play'){
   if(playing()){generation++;wantsPlayback=false;await music.pause();renderPlayer();}
   else{wantsPlayback=true;await schedulePlaylist(currentSection(),true);}
  }else{
   await queue;
   if(action==='next')await music.skipToNextItem();
   if(action==='prev')await music.skipToPreviousItem();
   wantsPlayback=playing();renderPlayer();
  }
 }
 function syncSection(){
  const next=currentSection();if(next===section)return;section=next;
  if(wantsPlayback&&authorized()&&preferences().autoSwitch!==false)schedulePlaylist(next,true);
  renderPlayer();
 }
 function renderPlayer(){
  const note=document.getElementById('song-note');if(!note)return;
  const value=mapping(currentSection()),item=music?.nowPlayingItem;
  const name=item?.title||item?.attributes?.name||value?.name||(value?'Section playlist':'Choose a playlist');
  const label=authorized()?(playing()?'Now playing':'Apple Music'):'Apple Music';
  const icons={prev:'|◀',play:playing()?'Ⅱ':'▶',next:'▶|'};
  note.replaceChildren();const heading=document.createElement('b');heading.textContent=label;const title=document.createElement('div');title.className='sn-name';title.textContent=statusText||name;title.title=title.textContent;
  const controls=document.createElement('div');controls.className='sn-ctl';
  for(const [action,icon]of Object.entries(icons)){const button=document.createElement('button');button.type='button';button.dataset.sn=action;button.textContent=icon;button.disabled=!privateMode()||!authorized();button.setAttribute('aria-label',action==='play'?(playing()?'Pause':'Play'):action==='prev'?'Previous song':'Next song');controls.appendChild(button);}
  note.append(heading,title,controls);
 }
 function updatePanel(){
  if(!panel?.isConnected)return;
  panel.querySelector('[data-music-status]').textContent=statusText||(authorized()?'Apple Music connected':'Connect Apple Music to play your section playlists.');
  panel.querySelector('[data-music-disconnect]').disabled=!music;
  panel.querySelector('[data-music-library]').disabled=!authorized();
  panel.querySelector('[data-music-connect]').disabled=!!connecting;
 }
 function updateLibrary(){
  if(!panel?.isConnected)return;
  for(const kind of Object.keys(sections)){
   const select=panel.querySelector('[data-library="'+kind+'"]'),value=mapping(kind);
   select.replaceChildren(new Option('Select a library playlist',''));
   const choices=library.slice();
   if(value?.libraryId&&!choices.some(item=>item.id===value.libraryId))choices.push({id:value.libraryId,name:value.name||'Saved library playlist'});
   for(const playlist of choices)select.add(new Option(playlist.name,playlist.id));
   select.value=value?.libraryId||'';
  }
 }
 function mountSettings(container){
  if(!container)return;container.hidden=!privateMode();if(!privateMode())return;
  if(container.querySelector('.music-preferences')){panel=container.querySelector('.music-preferences');updatePanel();return;}
  const form=document.createElement('form');form.className='music-preferences';
  form.innerHTML='<h3>Apple Music</h3><label>MusicKit developer token<input name="developerToken" type="password" autocomplete="off" placeholder="Paste your signed developer token"></label><p class="small">Full playback requires a MusicKit developer token and your Apple Music subscription.</p><details><summary>Apple Music setup</summary><ol><li>Use an Apple Developer account to create a MusicKit media identifier and signing key.</li><li>Generate a signed developer token and paste that token above.</li><li>Click Connect Apple Music, sign in, then choose a playlist for each section.</li></ol><a href="https://developer.apple.com/help/account/capabilities/create-a-media-identifier-and-private-key/" target="_blank" rel="noopener noreferrer">Open Apple’s setup guide</a></details><div class="music-actions"><button type="button" class="btn" data-music-connect>Connect Apple Music</button><button type="button" class="btn" data-music-disconnect>Disconnect</button><button type="button" class="btn" data-music-library>Load my playlists</button></div><p role="status" data-music-status></p><label class="music-switch"><input name="autoSwitch" type="checkbox"> Switch playlists with section</label><div class="music-sections"></div><button type="submit" class="btn">Save playlists</button>';
  const fields=form.querySelector('.music-sections');
  for(const [kind,label]of Object.entries(sections)){
   const section=document.createElement('section');section.className='music-section';
   const heading=document.createElement('h4');heading.textContent=label;
   const urlLabel=document.createElement('label');urlLabel.textContent='Playlist share link';const input=document.createElement('input');input.name=kind;input.type='url';input.placeholder='https://music.apple.com/…/playlist/…';input.value=mapping(kind)?.url||'';urlLabel.appendChild(input);
   const selectLabel=document.createElement('label');selectLabel.textContent='Library playlist';const select=document.createElement('select');select.dataset.library=kind;selectLabel.appendChild(select);
   select.onchange=()=>{if(select.value)input.value='';};input.oninput=()=>{if(input.value)select.value='';};
   section.append(heading,urlLabel,selectLabel);fields.appendChild(section);
  }
  form.elements.developerToken.value=savedToken();form.elements.autoSwitch.checked=preferences().autoSwitch!==false;
  container.replaceChildren(form);panel=form;updatePanel();updateLibrary();
  form.querySelector('[data-music-connect]').onclick=()=>connect(form.elements.developerToken.value).catch(()=>{});
  form.querySelector('[data-music-disconnect]').onclick=()=>disconnect().catch(error=>message(error.message));
  form.querySelector('[data-music-library]').onclick=()=>loadLibrary().catch(error=>message(error.message));
  form.onsubmit=event=>{
   event.preventDefault();try{
    requirePrivate();const playlists={};
    for(const kind of Object.keys(sections)){
     const id=form.querySelector('[data-library="'+kind+'"]').value,item=library.find(value=>value.id===id)||(mapping(kind)?.libraryId===id?{id,name:mapping(kind).name}:null);
     if(item)playlists[kind]={libraryId:item.id,name:item.name};
     else{const url=validateURL(form.elements[kind].value.trim());if(url)playlists[kind]={url,name:sections[kind]+' playlist'};}
    }
    store('sb.music',{playlists,autoSwitch:form.elements.autoSwitch.checked});message('Section playlists saved');
    if(wantsPlayback&&authorized())schedulePlaylist(currentSection(),true);
   }catch(error){message(error.message)}
  };
 }
 // Retire the legacy link-opening playback path and simulated controls.
 openPlaylist=()=>{};
 renderSong=renderPlayer;
 const baseWork=renderWork;renderWork=function(){const result=baseWork.apply(this,arguments);syncSection();return result;};
 const baseGuide=renderGuide;renderGuide=function(){const result=baseGuide.apply(this,arguments);syncSection();return result;};
 document.getElementById('song-note')?.addEventListener('click',event=>{
  const button=event.target.closest('[data-sn]');if(!button)return;event.stopImmediatePropagation();event.preventDefault();
  control(button.dataset.sn).catch(error=>{message(error.message);if(typeof toast==='function')toast(error.message)});
 },true);
 function cleanup(){generation++;connectionRevision++;wantsPlayback=false;queuedKey='';if(music)Promise.resolve(music.pause()).catch(()=>{});renderPlayer();}
 addEventListener('pagehide',cleanup);
 addEventListener('sessiontv:auth',()=>{if(!privateMode())cleanup();});
 globalThis.SessionMusic={mountSettings,connect,disconnect,loadLibrary,control,cleanup,syncSection,validateURL};
 syncSection();
})();
