/* ---------- routing: there is only the TV (plus the learning log on top) ---------- */
function go(v){const h=v==='log'?'log':'';if(location.hash.replace('#','')!==h)location.hash=h;else route()}
function route(){
  const v=location.hash.replace('#','')==='log'?'log':'work';
  view=v==='log'?'log':'work';document.body.dataset.view='work';
  $('view-work').hidden=false;$('view-log').hidden=v!=='log';
  ensureSession();tidySession();
  if(current?.tbStarted&&!TV.tbSeen){TV.tbSeen=true;wrapping=true}
  if(v==='log')renderLog();
  renderWork();
  if(current&&!TV.booted){TV.booted=true;const t=T(current.active);if(t&&!current.themeId){current.themeId=pickTheme(current.mood).id}
    if(t&&!wrapping)playCut(activeTheme(),chNum(t))}
}
window.addEventListener('hashchange',route);
// redraw after records change
function refresh(){
  if(current&&!CATS.includes(current.mood))migrateSession(current);ensureSession();if(view==='log')renderLog();renderWork();
  try{const t=T(current&&current.active);if(t&&typeOf(t)==='project'&&!$('pp').hidden)ppRender(t)}catch(e){}
}
$('log-back').onclick=()=>go('work');
window.addEventListener('resize',()=>{renderPanel()});

/* ---------- boot: load the records and keep the screen in sync with them ---------- */
route();
(async()=>{
  const c=window.sessionPlatform;
  if(!c){toast('The local board could not start. Please reload.');return}
  const [d,s]=await Promise.all([c.use('db'),c.use('sample')]);db=d;sample=s;
  if(!db){toast('Please allow browser storage and reload.');return}
  const slow=setTimeout(()=>{if(!loaded.tasks)toast('Still waiting for your tasks. Check your connection.')},10000);
  db.collection('tasks').onSnapshot(snap=>{
    {const all=snap.docs.map(x=>({id:x.id,...x.data()}));archived=all.filter(t=>t.status==='archived');tasks=all.filter(t=>t.status!=='archived')}
    if(!snap.metadata.fromCache||tasks.length){loaded.tasks=true;clearTimeout(slow)}
    refresh();
  },()=>{loaded.tasks=true;clearTimeout(slow);refresh()});
  db.collection('sessions').orderBy('date','desc').limit(200).onSnapshot(snap=>{sessions=snap.docs.map(x=>({id:x.id,...x.data()}));loaded.sessions=true;if(view==='log')renderLog()},()=>{loaded.sessions=true});
  db.doc('state/current').onSnapshot(snap=>{
    if(snap.metadata.hasPendingWrites)return;
    const remote=snap.exists?snap.data():null;
    if(remote&&(!current||current.startedAt!==remote.startedAt))current=JSON.parse(JSON.stringify(remote)); // stored docs are read-only; work on a copy
    if(!remote&&current&&loaded.state)current=null;
    if(current){current.timeOn=current.timeOn||{};current.cur=current.cur||{};current.practiced=current.practiced||[];current.alloc=current.alloc||{};migrateSession(current)}
    loaded.state=true;route();
  },()=>{loaded.state=true;route()});
  db.doc('settings/main').onSnapshot(snap=>{settings=snap.exists?snap.data():{};if(view==='work')renderWork()},()=>{});
})();
// a session started before the redesign: fold Skill Practice + Skill Development into Skills, moods into pages
function migrateSession(c){
  if(CATS.includes(c.mood)&&c.alloc.practice==null&&c.alloc.develop==null)return;
  const a=c.alloc;c.alloc={class:a.class||0,skill:(a.skill||0)+(a.practice||0)+(a.develop||0),project:a.project||0};
  const ord=[];(c.order||CATS).map(mapOldCat).forEach(k=>{if(CATS.includes(k)&&!ord.includes(k))ord.push(k)});CATS.forEach(k=>{if(!ord.includes(k))ord.push(k)});c.order=ord;
  const act=T(c.active);c.mood=act?typeOf(act):mapOldCat(c.mood);if(!CATS.includes(c.mood))c.mood='class';
  c.cur={class:null,skill:null,project:null,[c.mood]:c.active||null};
}
