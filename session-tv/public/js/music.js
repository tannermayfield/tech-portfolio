/* Free Apple Music embeds live in a persistent TV Radio popup. */
(() => {
 const sections = {class:'Classes', skill:'Skills', project:'Projects'};
 const defaultPlaylists = {
  class:'https://music.apple.com/us/playlist/study/pl.u-vxy6JJxI82jM32P',
  skill:'https://music.apple.com/us/playlist/study/pl.u-vxy6JJxI82jM32P',
  project:'https://music.apple.com/us/playlist/creativity/pl.u-RRbVLGNTebXKMbo'
 };
 const privateMode = () => SessionWorkspace.mode === 'private';
 const preferences = () => recall('sb.music', {});
 let section = '', loadedURL = '', started = false, frame = null;
 function initializePlaylists() {
  if (!privateMode() || preferences().player === 'embed') return;
  const config = preferences();
  const playlists = Object.fromEntries(Object.entries(defaultPlaylists).map(([key,url]) => [key,{url,name:sections[key]+' playlist'}]));
  store('sb.music',{...config,player:'embed',playlists,autoSwitch:true,tryAutoplay:true});
 }
 const radio = document.createElement('dialog');
 radio.id = 'tv-radio';
 radio.className = 'confirm-dlg';
 radio.setAttribute('aria-labelledby', 'radio-heading');
 radio.innerHTML = `<div class="local-panel radio-panel">
  <header class="row spread"><h2 id="radio-heading">TV Radio</h2><button type="button" class="btn ghost" data-radio-close>Close</button></header>
  <div class="radio-station"><span data-radio-section></span><button type="button" class="btn ghost" data-radio-stop>Stop music</button></div>
  <div class="radio-player"></div><p class="small" role="status" data-radio-status></p>
 </div>`;
 document.body.appendChild(radio);
 const player = radio.querySelector('.radio-player');
 const status = radio.querySelector('[data-radio-status]');
 function currentSection() {
  return (TV.mode === 'guide' ? TV.guideCat : null) || current?.mood || 'class';
 }
 function mapping(kind) {
  const saved = preferences().playlists?.[kind];
  if (saved && Object.hasOwn(saved,'url')) return saved;
  const legacy = typeof playlistUrl === 'function' ? playlistUrl(kind) : '';
  return legacy ? {...saved,url:legacy} : {...saved,url:defaultPlaylists[kind] || ''};
 }
 function validateURL(value) {
  if (!value) return '';
  let url;
  try { url = new URL(value); } catch { throw new Error('Paste an Apple Music playlist share link.'); }
  const path = url.pathname.replace(/\/$/, '');
  if (url.protocol !== 'https:' || !['music.apple.com','embed.music.apple.com'].includes(url.hostname) || url.username || url.password || !/^\/(?:[a-z]{2}\/)?playlist\/(?:[^/]+\/)?pl\.[a-z0-9.-]+$/i.test(path)) {
   throw new Error('Use a playlist share link from Apple Music. Library-only links need a shareable playlist link.');
  }
  return 'https://music.apple.com' + path;
 }
 function embedURL(value) {
  const url = new URL(validateURL(value));
  url.hostname = 'embed.music.apple.com';
  if (preferences().tryAutoplay !== false) url.searchParams.set('autoplay', 'true');
  return url.href;
 }
 function renderPlayer() {
  const note = document.getElementById('song-note');
  if (!note) return;
  note.replaceChildren();
  const heading = document.createElement('b'); heading.textContent = 'TV Radio';
  const title = document.createElement('div'); title.className = 'sn-name';
  title.textContent = sections[currentSection()] + ' playlist';
  const controls = document.createElement('div'); controls.className = 'radio-note-controls';
  const open = document.createElement('button'); open.type = 'button'; open.className = 'btn';
  open.textContent = 'Open radio'; open.disabled = !privateMode(); open.onclick = openRadio;
  controls.append(open); note.append(heading,title,controls);
 }
 function loadPlaylist(force = false) {
  radio.querySelector('[data-radio-section]').textContent = sections[currentSection()];
  if (!started || !privateMode()) return;
  let url;
  try { url = mapping(currentSection()).url ? embedURL(mapping(currentSection()).url) : ''; }
  catch (error) { stop(); status.textContent = error.message; return; }
  if (!url) {
   stop();
   status.textContent = 'Add a ' + sections[currentSection()] + ' playlist share link in Session Preferences → Apple Music.';
   return;
  }
  if (!force && url === loadedURL) return;
  loadedURL = url;
  status.textContent = 'Loading Apple Music…';
  const next = document.createElement('iframe');
  next.title = sections[currentSection()] + ' Apple Music player';
  next.allow = 'autoplay; encrypted-media';
  next.setAttribute('sandbox','allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation');
  next.referrerPolicy = 'strict-origin-when-cross-origin';
  next.onload = () => {
   if (frame !== next) return;
   status.textContent = preferences().tryAutoplay !== false
    ? 'Autoplay requested. If music has not started, press Play in Apple’s player.'
    : 'Press Play in Apple’s player. Sign in there for full tracks.';
  };
  next.src = url;
  frame = next;
  player.replaceChildren(next);
 }
 function openRadio() {
  if (!privateMode()) { toast('Sign in to use your section playlists.'); return; }
  initializePlaylists();
  started = true;
  loadPlaylist();
  radio.showModal();
 }
 function stop() {
  started = false;
  frame = null; loadedURL = ''; player.replaceChildren();
  status.textContent = 'Music stopped. Open radio to load the section playlist.';
 }
 function syncSection() {
  const next = currentSection();
  if (section === next) return;
  section = next;
  if (preferences().autoSwitch !== false) loadPlaylist();
  renderPlayer();
 }
 function cleanup() {
  stop(); started = false; radio.close(); renderPlayer();
 }
 function mountSettings(container) {
  if (!container || !privateMode()) return;
  initializePlaylists();
  const config = preferences();
  const form = document.createElement('form'); form.className = 'music-preferences';
  form.innerHTML = `<h3>Apple Music</h3><p class="small">Save playlist share links, then open TV Radio to use Apple’s player.</p>
   <div class="music-sections"></div>
   <label class="music-switch"><input name="autoSwitch" type="checkbox"> Switch playlists with section</label>
   <label class="music-switch"><input name="tryAutoplay" type="checkbox"> Try autoplay when loading a playlist</label>
   <p class="small">Apple may require pressing Play after a playlist changes.</p>
   <div class="music-actions"><button type="submit" class="btn">Save playlists</button><button type="button" class="btn" data-open-radio>Open TV Radio</button></div><p role="status"></p>`;
  for (const [kind,label] of Object.entries(sections)) {
   const card = document.createElement('section'); card.className = 'music-section';
   const heading = document.createElement('h4'); heading.textContent = label;
   const field = document.createElement('label'); field.textContent = 'Playlist share link';
   const input = document.createElement('input'); input.name = kind; input.type = 'url';
   input.placeholder = 'https://music.apple.com/…/playlist/…'; input.value = mapping(kind).url || '';
   field.append(input); card.append(heading,field); form.querySelector('.music-sections').append(card);
   if (mapping(kind).libraryId && !input.value) {
    const hint = document.createElement('p'); hint.className = 'small'; hint.textContent = 'Add a share link for your saved library playlist.'; card.append(hint);
   }
  }
  form.elements.autoSwitch.checked = config.autoSwitch !== false;
  form.elements.tryAutoplay.checked = config.tryAutoplay !== false;
  form.onsubmit = event => {
   event.preventDefault();
   const feedback = form.querySelector('[role=status]');
   try {
    if (!privateMode()) throw new Error('Sign in to save playlists.');
    const playlists = {};
    for (const kind of Object.keys(sections)) {
     const url = validateURL(form.elements[kind].value.trim());
     if (url) playlists[kind] = {...mapping(kind),url,name:sections[kind]+' playlist'};
     else playlists[kind] = {url:''};
    }
    store('sb.music',{...config,playlists,autoSwitch:form.elements.autoSwitch.checked,tryAutoplay:form.elements.tryAutoplay.checked});
    feedback.textContent = 'Section playlists saved.';
    if (started) loadPlaylist();
    renderPlayer();
   } catch (error) { feedback.textContent = error.message; }
  };
  form.querySelector('[data-open-radio]').onclick = openRadio;
  container.replaceChildren(form);
 }
 radio.querySelector('[data-radio-close]').onclick = () => radio.close();
 radio.querySelector('[data-radio-stop]').onclick = stop;
 SessionTV.hooks.after('song:render', renderPlayer);
 SessionTV.hooks.after('work:render', syncSection);
 SessionTV.hooks.after('guide:render', syncSection);
 // Block the original simulated transport handler on the cabinet music plate.
 document.getElementById('song-note')?.addEventListener('click',event => {
  if (event.target.closest('[data-sn]')) { event.preventDefault(); event.stopImmediatePropagation(); openRadio(); }
 },true);
 addEventListener('pagehide',cleanup);
 addEventListener('sessiontv:auth',() => { if (!privateMode()) cleanup(); });
 globalThis.SessionMusic = {mountSettings,openRadio,stop,cleanup,syncSection,validateURL,embedURL};
 initializePlaylists();
 syncSection();
})();
