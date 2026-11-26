/* Small shared helpers: DOM lookup, escaping, preferences storage, toasts, dates and saving. */
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// preferences live in SessionWorkspace.storage as JSON; every sb.* key and its default is listed in core/preferences.js
function store(k,v){try{SessionWorkspace.storage.setItem(k,JSON.stringify(v))}catch(e){}}
function recall(k,d){
  const fallback=()=>arguments.length<2?SessionTV.preferences.defaultFor(k):d;
  try{const v=SessionWorkspace.storage.getItem(k);return v==null?fallback():JSON.parse(v)}catch(e){return fallback()}
}
// the message strip at the bottom of the screen
let toastTimer=0;
function toast(m){const el=$('toast');if(!el)return;el.textContent=m;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,6500)}
addEventListener('sessiontv:error',event=>toast(event.detail));
const reduce=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function fmtMin(m){m=Math.max(0,Math.round(m||0));const h=Math.floor(m/60),r=m%60;return h?(r?`${h}h ${String(r).padStart(2,'0')}m`:`${h}h`):`${r}m`}
/* Dates and times, one format app-wide: "Thu, Nov 26 · 11:59 PM", "Thu, Nov 26" or "11:59 PM" */
const fmtClock=d=>d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}).replace(/\s+/g,' ');
const fmtDay=d=>d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
function parseDay(s){if(!s)return null;const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function today(){const d=new Date();d.setHours(0,0,0,0);return d}
function daysUntil(s){const d=parseDay(s);return d?Math.round((d-today())/864e5):null}
function fmtTime(hm){const [h,m]=hm.split(':').map(Number);const d=new Date();d.setHours(h,m,0,0);return fmtClock(d)}
// a record's due date (and time, when it has one): "Thu, Nov 26 · 11:59 PM"
function fmtDue(t){if(!t?.due)return 'No due date';const d=parseDay(String(t.due));if(!d||!Number.isFinite(d.getTime()))return String(t.due);return fmtDay(d)+(/^\d{1,2}:\d{2}$/.test(t.dueTime||'')?' · '+fmtTime(t.dueTime):'')}
function dueAt(t){const d=parseDay(t.due);if(!d)return null;const [h,m]=(t.dueTime||'23:59').split(':').map(Number);d.setHours(h,m,0,0);return d}
function dueLabel(t){
  const n=daysUntil(t.due);if(n==null)return {text:'No date',cls:''};
  const tm=t.dueTime?` · ${fmtTime(t.dueTime)}`:'';
  const d=fmtDay(parseDay(t.due));
  const past=dueAt(t)<new Date();
  if(n<0||(n===0&&past&&t.dueTime))return {text:`${d}${tm} · late`,cls:'late'};
  if(n===0)return {text:`Today${tm}`,cls:'late'};
  if(n===1)return {text:`Tomorrow${tm}`,cls:'soon'};
  return {text:`${d}${tm}${n<7?` · ${n}d`:''}`,cls:n<=3?'soon':''};
}
function agoLabel(iso){if(!iso)return 'Not practiced yet';const d=Math.floor((Date.now()-new Date(iso).getTime())/864e5);return d<=0?'Practiced today':d===1?'Practiced yesterday':`Practiced ${d}d ago`}
const byOrder=(a,b)=>(a.order??999)-(b.order??999);
function byDue(a,b){const x=(a.due||'9999-12-31')+(a.dueTime||'23:59'),y=(b.due||'9999-12-31')+(b.dueTime||'23:59');return x<y?-1:x>y?1:byOrder(a,b)}
/* Save a change. Pass undo when the UI already shows the change (an optimistic update): if the save
   fails, undo puts the old values back (and re-renders) before the error toast. Resolves to true when saved. */
async function guard(fn,ok,undo){
  const fail=message=>{try{undo&&undo()}catch(e){console.error(e)}toast(message);return false};
  if(!db)return fail('Saving is unavailable in this view.');
  try{await fn();if(ok)toast(ok);return true}
  catch(e){return fail(e?.code==='invalid_argument'?'You can view this board but not change it.':'Couldn\'t save. Try again in a moment.')}
}
