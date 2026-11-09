/* settings remembers where you came from and returns there on exit */
/* swapping straight from one sheet to another: no crossfade, so the work screen never peeks through */
function sheetSnap(){const g=$('tv-guide'),st=$('tv-settings');if(!(g.classList.contains('open')||st.classList.contains('open')))return;
  g.classList.add('snap');st.classList.add('snap');requestAnimationFrame(()=>requestAnimationFrame(()=>{g.classList.remove('snap');st.classList.remove('snap')}))}
function openGuide(){stopCut();sheetSnap();TV.mode='guide';TV.guideCat=current?.mood||'class';$('tv-settings').classList.remove('open');$('tv-guide').classList.add('open');renderGuide();renderPanel();renderSong()}
function openSettings(){stopCut();sheetSnap();if(TV.mode!=='settings'){TV.preSet={mode:TV.mode,cat:TV.guideCat};TV.dbView=null}TV.mode='settings';$('tv-guide').classList.remove('open');$('tv-settings').classList.add('open');renderSettings();renderPanel()}
function closeSheets(){
  if(TV.mode==='task')return;
  const back=TV.mode==='settings'?TV.preSet:null;TV.preSet=null;
  if(back&&back.mode==='guide'){stopCut();sheetSnap();TV.mode='guide';if(back.cat)TV.guideCat=back.cat;$('tv-settings').classList.remove('open');$('tv-guide').classList.add('open');renderGuide();renderPanel();renderSong();return}
  TV.mode='task';$('tv-guide').classList.remove('open');$('tv-settings').classList.remove('open');renderPanel();renderSong()}
