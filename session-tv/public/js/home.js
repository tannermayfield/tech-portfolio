/* Show power-on once per tab, and restore its screen after a reload. */
(() => {
 const home = $('tv-home');
 const key='sessiontv.tabNavigation';
 const owner=()=>SessionWorkspace.mode+':'+(globalThis.SessionCloud?.user?.id||'visitor');
 let started=false;
 function remember(){if(!started)return;try{sessionStorage.setItem(key,JSON.stringify({started:true,owner:owner(),mode:TV.mode,dbView:TV.dbView,guideCat:TV.guideCat}))}catch{}}
 addEventListener('pagehide',remember);

 function showHome() {
  stopCut(); document.body.classList.add('tv-home-active'); home.hidden = false;
  $('tv-home-start').focus({preventScroll:true});
 }
 $('tv-home-start').onclick = () => {
  started=true;
  document.body.classList.remove('tv-home-active'); home.hidden = true;
  accumulate();
  current.cur[current.mood] = current.active;
  current.mood = 'class';
  current.active = current.cur.class || firstOpenIn('class');
  current.activeSince = Date.now();
  saveState();
  renderWork();
  openGuide();
  TV.guideCat = 'class';
  renderGuide();
  renderPanel();
  const guide = $('tv-guide');
  guide.tabIndex = -1;
  guide.focus({preventScroll:true});
 };
 let saved;try{saved=JSON.parse(sessionStorage.getItem(key)||'null')}catch{}
 if(saved?.started){
  started=true;document.body.classList.remove('tv-home-active');home.hidden=true;
  if(saved.owner===owner()&&saved.mode==='settings'){TV.dbView=['classes','skills','projects','assignments','experience'].includes(saved.dbView)?saved.dbView:null;openSettings()}
  else if(saved.owner===owner()&&saved.mode==='task'){closeSheets();renderWork()}
  else {openGuide();if(saved.owner===owner()&&['class','skill','project'].includes(saved.guideCat)){TV.guideCat=saved.guideCat;renderGuide();renderPanel()}}
 }else showHome();
})();
