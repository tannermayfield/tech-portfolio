/* ---------- Settings: Session Database ---------- */
TV.dbView=null;
function renderSettings(){
  if(TV.dbView)return renderDbView(TV.dbView);
  const seg=(name,opts,val)=>`<div class="seg" role="group" aria-label="${name}">${opts.map(([v,l])=>`<button type="button" data-${name}="${v}" aria-pressed="${String(v)===String(val)}">${l}</button>`).join('')}</div>`;
  const live=tasks.filter(t=>t.status!=='archived'),cls=live.filter(t=>typeOf(t)==='class'),sk=live.filter(t=>typeOf(t)==='skill'),pj=live.filter(t=>typeOf(t)==='project');
  const courses=[...new Set(cls.map(t=>t.course).filter(Boolean))],projects=[...new Set(pj.map(t=>t.course||'Other'))];
  const exp=pj.filter(t=>t.status==='done').length;
  const stat=(n,l,v)=>`<button type="button" class="db-stat" data-db="${v}" title="Open ${l}"><b>${n}</b><span>${l}</span></button>`;
  $('set-body').innerHTML=`<div class="set-grid">
    <div class="set-card"><h3>Appearance</h3>${seg('scheme',[['auto','Auto'],['light','Light'],['dark','Dark']],TV.scheme)}</div>
    <div class="set-card"><h3>Channel Cutscenes</h3>${seg('cut',[[4,'On'],[0,'Off']],TV.cutLen)}</div>
    <div class="set-card"><h3>Leave SessionTV</h3><div class="row"><button class="btn primary" id="set-end">Return to Fun Portfolio</button></div><div class="set-note" id="set-leave-note" hidden>Portfolio link not set yet.</div></div>
    <div class="set-card db-card"><h3>My Database</h3>
      <div class="db-stats">${stat(courses.length,'Classes','classes')}${stat(cls.length,'Assignments','classes')}${stat(sk.length,'Skills','skills')}${stat(projects.length,'Projects','projects')}</div>
      <div class="db-btns"><button class="btn" data-db="learning">Learning Logs</button><button class="btn" data-db="experience">Experience Logs</button></div></div>
    ${setTimeCard()}
  </div>`;
  $('set-body').querySelectorAll('[data-scheme]').forEach(b=>b.onclick=()=>{TV.scheme=b.dataset.scheme;store('sb.scheme',TV.scheme);applyScheme();renderSettings()});
  $('set-body').querySelectorAll('[data-cut]').forEach(b=>b.onclick=()=>{TV.cutLen=+b.dataset.cut;store('sb.cutLen',TV.cutLen);renderSettings()});
  $('set-end').onclick=()=>{const u=settings&&settings.portfolioUrl;if(u){window.open(u,'_blank','noopener')}else{const n=$('set-leave-note');if(n)n.hidden=false}};
  if($('tt-range'))$('tt-range').onclick=()=>{const i=TT_RANGES.findIndex(x=>x[0]===TV.ttRange);TV.ttRange=TT_RANGES[(i+1)%TT_RANGES.length][0];try{SessionWorkspace.storage.setItem('sb.ttRange',TV.ttRange)}catch(e){}renderSettings()};
  $('set-body').querySelectorAll('[data-db]').forEach(b=>b.onclick=()=>{if(b.dataset.db==='learning'){closeSheets();go('log');return}TV.dbView=b.dataset.db;renderSettings()});
}
const TT_RANGES=[['last','Last Session'],['14','Last 14 Days'],['all','Lifetime']];
TV.ttRange=(()=>{try{return SessionWorkspace.storage.getItem('sb.ttRange')||'14'}catch(e){return '14'}})();
function byTypeRange(r){
  const out={class:0,skill:0,project:0},cut=r==='14'?Date.now()-14*864e5:0;
  const list=r==='last'?sessions.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,1):sessions;
  for(const s of list){if(cut&&new Date(s.date).getTime()<cut)continue;for(const k in (s.byTrack||{})){const c=mapOldCat(k);if(out[c]!=null)out[c]+=s.byTrack[k]}}
  return out;
}
function setTimeCard(){
  let m={},tot=0;try{m=byTypeRange(TV.ttRange);tot=Object.values(m).reduce((a,b)=>a+b,0)}catch(e){}
  const rl=(TT_RANGES.find(x=>x[0]===TV.ttRange)||TT_RANGES[1])[1];
  const rows=CATS.map(k=>{const v=m[k]||0,p=tot?v/tot:0;return `<div class="tt-row"><div class="tt-top"><span>${esc(TYPES[k].label)}</span><span>${fmtMin(v)} · ${Math.round(p*100)}%</span></div><div class="tt-bar"><i style="width:${Math.min(100,p*100)}%"></i></div></div>`}).join('');
  return `<div class="set-card tt-card"><div class="tt-head"><h3>Time Stats</h3><button type="button" class="tt-range" id="tt-range" title="Change the time range">${rl}</button></div><div class="tt-rows">${rows}</div><div class="tt-tot">Total <b>${fmtMin(tot)}</b></div></div>`;
}
function renderDbView(v){
  const live=tasks.filter(t=>t.status!=='archived'),d=iso=>iso?new Date(iso).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'';
  const row=(t,meta,done)=>`<li><button type="button" class="db-row${done?' done':''}" data-open="${esc(t.id)}"><span class="db-t">${esc(t.title)}</span><span class="db-m">${meta}</span></button></li>`;
  const group=(h,sub,items)=>`<section class="db-grp"><h4>${esc(h)}${sub?` <small>${esc(sub)}</small>`:''}</h4><ul>${items||'<li class="db-empty">Nothing here yet.</li>'}</ul></section>`;
  let title='',body='',add='';
  if(v==='classes'){title='Classes';add='Add assignment';
    const cls=live.filter(t=>typeOf(t)==='class'),courses=[...new Set(cls.map(t=>t.course||'Other'))].sort();
    body=courses.map(c=>{const l=cls.filter(t=>(t.course||'Other')===c).sort((a,b)=>(a.status==='done')-(b.status==='done')||String(a.due||'9').localeCompare(String(b.due||'9')));
      const open=l.filter(t=>t.status!=='done').length;
      return group(c+(GD_COURSE_NAMES[c]?' · '+GD_COURSE_NAMES[c]:''),`${open} open · ${l.length-open} done`,l.map(t=>row(t,t.status==='done'?`Done ${d(t.doneAt)}`:(t.due?esc(fmtDue(t)):'No due date'),t.status==='done')).join(''))}).join('');}
  else if(v==='skills'){title='Skills';add='Add skill';
    const sk=live.filter(t=>typeOf(t)==='skill');
    body=subsOf('skill').map(c=>{const l=sk.filter(t=>catOf(t)===c).sort(byOrder);return group(c,`${l.length} skill${l.length===1?'':'s'}`,l.map(t=>row(t,`${LVL_TAG(skillLevel(t))} · ${esc(agoLabel(t.lastPracticed))}`)).join(''))}).join('');}
  else if(v==='projects'){title='Projects';add='Add project task';
    const pj=live.filter(t=>typeOf(t)==='project'),names=[...new Set(pj.map(t=>t.course||'Other'))];
    body=names.map(n=>{const l=pj.filter(t=>(t.course||'Other')===n).sort((a,b)=>(a.status==='done')-(b.status==='done')||byOrder(a,b));const open=l.filter(t=>t.status!=='done').length;
      return group(n,`${open} open · ${l.length-open} done`,l.map(t=>row(t,t.status==='done'?`Done ${d(t.doneAt)}`:(t.phase?esc(t.phase):'Open'),t.status==='done')).join(''))}).join('');}
  else if(v==='experience'){title='Experience Logs';
    const l=live.filter(t=>typeOf(t)==='project'&&t.status==='done').sort((a,b)=>String(b.doneAt||'').localeCompare(String(a.doneAt||'')));
    body=`<p class="db-note">Proof of your skills: every project task you finish lands here, newest first.</p>`+(l.length?group('Finished project work',`${l.length} entr${l.length===1?'y':'ies'}`,l.map(t=>row(t,`${esc(t.course||'Project')} · ${t.doneAt?'Done '+d(t.doneAt):'Done'}${t.goal?' · '+esc(t.goal):''}`,true)).join('')):`<p class="db-empty">Nothing yet. Finish a project task and it shows up here as proof of the work.</p>`);}
  $('set-body').innerHTML=`<div class="db-view"><div class="db-head"><button type="button" class="btn ghost" id="db-back">‹ Back</button><h3>${title}</h3>${add?`<button type="button" class="btn" id="db-add">+ <span class="db-al">${add}</span><span class="db-as">Add</span></button>`:''}</div><div class="db-list">${body}</div></div>`;
  $('db-back').onclick=()=>{TV.dbView=null;renderSettings()};
  if($('db-add'))$('db-add').onclick=()=>{closeSheets();openDrawer('add-drawer')};
  $('set-body').querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openTask(b.dataset.open));
}
