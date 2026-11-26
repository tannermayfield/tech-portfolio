/* ---------- Settings: preferences, time stats and My Database ---------- */
TV.dbView=null;
/* Settings remembers where you came from and returns there on exit (see closeSheets) */
function openSettings(){return SessionTV.hooks.run('settings:open',arguments,()=>{
  stopCut();sheetSnap();if(TV.mode!=='settings'){TV.preSet={mode:TV.mode,cat:TV.guideCat};TV.dbView=null}TV.mode='settings';$('tv-guide').classList.remove('open');$('tv-settings').classList.add('open');renderSettings();renderPanel();
})}
$('set-x').onclick=()=>closeSheets();
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&TV.mode!=='task'&&view!=='log')closeSheets()});
function settingsHeader(title, add, onAdd){
  const header=$('tv-settings').querySelector('.sheet-head');
  header.querySelector('h2').innerHTML='Settings'+(title?' <span class="settings-chevron" aria-hidden="true">&gt;</span> <span>'+esc(title)+'</span>':'');
  header.querySelector('#db-add')?.remove();
  const back=$('set-x');
  back.classList.toggle('btn',!!title);
  back.innerHTML=title?'← Back':'×';
  back.setAttribute('aria-label',title?'Back to settings':'Close settings');
  back.onclick=()=>{if(TV.dbView){TV.dbView=null;renderSettings()}else closeSheets()};
  if(add){const button=document.createElement('button');button.type='button';button.id='db-add';button.className='btn';button.dataset.write='';button.textContent='+ '+add;button.onclick=onAdd;header.insertBefore(button,back)}
}
function renderSettings(){return SessionTV.hooks.run('settings:render',arguments,()=>{
  if(TV.dbView)return renderDbView(TV.dbView);
  settingsHeader();
  const live=tasks.filter(t=>t.status!=='archived'),cls=live.filter(t=>typeOf(t)==='class'),sk=live.filter(t=>typeOf(t)==='skill'),pj=live.filter(t=>typeOf(t)==='project');
  const courses=[...new Set([...cls.map(t=>t.course).filter(Boolean),...Object.keys(recall('sb.classes'))])],projects=[...new Set([...pj.map(t=>t.course||'Other'),...Object.values(PROJ.data).map(p=>p.name).filter(Boolean)])];
  const exp=pj.filter(t=>t.status==='done').length;
  const stat=(n,l,v)=>`<button type="button" class="db-stat" data-db="${v}" title="Open ${l}"><b>${n}</b><span>${l}</span></button>`;
  $('set-body').innerHTML=`<div class="set-grid">
    <div class="set-card"><h3>Account</h3><div class="row">${SessionWorkspace.mode==='private'?'<button class="btn" id="account-settings-open">Account settings</button>':''}<button class="btn" id="local-open" data-session-action="${SessionWorkspace.mode==='private'?'logout':'login'}">${SessionWorkspace.mode==='private'?'Sign out':'Sign in'}</button></div></div>
    <div class="set-card preferences-card"><h3>Preferences</h3><div class="row"><button class="btn" id="preferences-open">Open Preferences</button></div></div>
    <div class="set-card"><h3>Exit SessionTV</h3><div class="row"><a class="btn" id="session-exit" href="https://tannermayfield.dev/#projects">Return to portfolio</a></div></div>
    <div class="set-card connections-card"><h3>Connections</h3><div id="session-connection-summary" aria-live="polite"></div></div>
    ${setTimeCard()}
    <div class="set-card db-card"><h3>My Database</h3>
      <div class="db-stats">${stat(courses.length,'Classes','classes')}${stat(globalThis.SessionSkills?SessionSkills.count():new Set([...Object.values(SKILL_TAGS).flat(),...sk.map(t=>t.course||'Other')]).size,'Skills','skills')}${stat(projects.length,'Projects','projects')}<button type="button" class="db-stat resume-placeholder" disabled title="Coming later"><span>Resume &amp; Portfolio</span><small>Coming later</small></button></div>
      </div>
  </div>`;
  if($('tt-range'))$('tt-range').onclick=()=>{const i=TT_RANGES.findIndex(x=>x[0]===TV.ttRange);TV.ttRange=TT_RANGES[(i+1)%TT_RANGES.length][0];try{SessionWorkspace.storage.setItem('sb.ttRange',TV.ttRange)}catch(e){}
    const card=$('tt-range').closest('.tt-card');
    const next=document.createElement('template');
    next.innerHTML=setTimeCard();
    for(const selector of ['.tt-range','.tt-rows','.tt-tot']){
      card.querySelector(selector).innerHTML=next.content.querySelector(selector).innerHTML;
    }
  };
  $('set-body').querySelectorAll('[data-db]').forEach(b=>b.onclick=()=>{if(b.dataset.db==='learning'){closeSheets();go('log');return}TV.dbView=b.dataset.db;renderSettings()});
})}
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
function renderDbView(v){return SessionTV.hooks.run('dbView:render',arguments,v=>{
  const live=tasks.filter(t=>t.status!=='archived'),d=iso=>iso?new Date(iso).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'';
  const row=(t,meta,done)=>`<li><button type="button" class="db-row${done?' done':''}" data-open="${esc(t.id)}"><span class="db-t">${esc(t.title)}</span><span class="db-m">${meta}</span></button></li>`;
  const group=(h,sub,items)=>`<section class="db-grp"><h4>${esc(h)}${sub?` <small>${esc(sub)}</small>`:''}</h4><ul>${items||'<li class="db-empty">Nothing here yet.</li>'}</ul></section>`;
  let title='',body='',add='';
  if(v==='classes'||v==='assignments'){title='Classes';add='Add class';
    const cls=live.filter(t=>typeOf(t)==='class'),courses=[...new Set([...cls.map(t=>t.course||'Other'),...Object.keys(recall('sb.classes'))])].sort();
    body=courses.map(c=>{const l=cls.filter(t=>(t.course||'Other')===c).sort((a,b)=>(a.status==='done')-(b.status==='done')||String(a.due||'9').localeCompare(String(b.due||'9')));
      const open=l.filter(t=>t.status!=='done').length;
      return `<section class="db-grp class-section"><div class="class-section-head"><h4>${esc(courseLabel(c))}<small>${open} open · ${l.length-open} done</small></h4><button type="button" class="btn" data-add-assignment="${esc(c)}" data-write>+ Add assignment</button></div><ul>${l.map(t=>row(t,t.status==='done'?`Done ${d(t.doneAt)}`:(t.due?esc(fmtDue(t)):'No due date'),t.status==='done')).join('')||'<li class="db-empty">No assignments yet.</li>'}</ul></section>`}).join('');}
  else if(v==='skills'){title='Skills';add='Add skill';
    // Category → one row per skill (stage, counters, code editor, actions, like Classes) → its tools as chips below.
    // skill-categories.js adds the category chips and wires the editor select and Edit.
    const sk=live.filter(t=>typeOf(t)==='skill'),edits=SessionWorkspace.mode==='demo'?' disabled':'';
    const when=iso=>{const a=agoLabel(iso);return a==='Not practiced yet'?'Never':a.replace(/^Practiced /,'').replace(/^./,x=>x.toUpperCase())};
    const counter=(n,label)=>`<span><b>${esc(n)}</b><small>${esc(label)}</small></span>`;
    body=subsOf('skill').map(c=>{const inCat=sk.filter(t=>catOf(t)===c),skills=globalThis.SessionSkills?.channels(c)||(SKILL_TAGS[c]||[]).map(s=>({id:skillChannelId(c,s),title:s,course:s,cat:c,track:'develop',level:1,reps:0,lastPracticed:null}));
      const rows=skills.map(s=>{const l=inCat.filter(t=>(t.course||'Other')===s.course).sort((a,b)=>(a.status==='done')-(b.status==='done')||byOrder(a,b)),kind=wsEditorOf(c,s.course)||'none';
        return `<section class="skill-settings-row" data-skill="${esc(s.course)}" data-skill-id="${esc(s.id)}">
          <div class="class-identity skill-identity"><strong title="${esc(c+' › '+s.course)}">${esc(skShort(s))}</strong>${lvlBox(s)}</div>
          <div class="class-counters skill-counters">${counter(l.length,l.length===1?'Tool':'Tools')}${counter(s.reps||0,s.reps===1?'Practice session':'Practice sessions')}${counter(when(s.lastPracticed),'Last practiced')}</div>
          <label class="skill-editor-pick" data-write><span>Code editor</span><select data-skill-editor="${esc(s.id)}" aria-label="Code editor for ${esc(s.course)}" data-write${edits}>${WS_CHOICES.map(([v,label])=>`<option value="${v}"${v===kind?' selected':''}>${esc(label)}</option>`).join('')}</select></label>
          <button type="button" class="btn skill-add-tool" data-add-tool="${esc(s.course)}" data-tool-category="${esc(c)}" data-write${edits}>+ Add tool</button>
          <button type="button" class="btn skill-edit" data-edit-skill="${esc(s.id)}" aria-label="Edit skill ${esc(s.course)}" data-write${edits}>Edit</button>
          <ul class="skill-tools" aria-label="Tools for ${esc(s.course)}">${l.map(t=>`<li><button type="button" class="skill-tool${t.status==='done'?' done':''}" data-open="${esc(t.id)}" style="--lc:${LVL_COLORS[skillLevel(t)]}" title="${esc(LVL_NAMES[skillLevel(t)]+' · '+agoLabel(t.lastPracticed))}"><span>${esc(t.title)}</span><small>${LVL_TAG(skillLevel(t))}</small></button></li>`).join('')||'<li class="db-empty">No tools yet.</li>'}</ul>
        </section>`}).join('');
      return `<div class="skill-category" data-skill-category="${esc(c)}">${rows||'<p class="db-empty">No skills in this category yet. Add one with + Add skill.</p>'}</div>`}).join('');}
  else if(v==='projects'){title='Projects';add='Create project';
    const pj=live.filter(t=>typeOf(t)==='project'),names=[...new Set(pj.map(t=>t.course||'Other'))];
    body=names.map(n=>{const l=pj.filter(t=>(t.course||'Other')===n).sort((a,b)=>(a.status==='done')-(b.status==='done')||byOrder(a,b));const open=l.filter(t=>t.status!=='done').length;
      return group(n,`${open} open · ${l.length-open} done`,l.map(t=>row(t,t.status==='done'?`Done ${d(t.doneAt)}`:(t.phase?esc(t.phase):'Open'),t.status==='done')).join(''))}).join('');}
  else if(v==='experience'){title='Experience Logs';
    const l=live.filter(t=>typeOf(t)==='project'&&t.status==='done').sort((a,b)=>String(b.doneAt||'').localeCompare(String(a.doneAt||'')));
    body=`<p class="db-note">Proof of your skills: every project task you finish lands here, newest first.</p>`+(l.length?group('Finished project work',`${l.length} entr${l.length===1?'y':'ies'}`,l.map(t=>row(t,`${esc(t.course||'Project')} · ${t.doneAt?'Done '+d(t.doneAt):'Done'}${t.goal?' · '+esc(t.goal):''}`,true)).join('')):`<p class="db-empty">Nothing yet. Finish a project task and it shows up here as proof of the work.</p>`);}
  settingsHeader(title,add,()=>SessionAddForms.open(v==='classes'||v==='assignments'?'class':v==='skills'?'skill':'project'));
  $('set-body').innerHTML=`<div class="db-view"><div class="db-list">${body||'<p class="db-empty">Nothing here yet.</p>'}</div></div>`;
  $('set-body').querySelectorAll('[data-add-assignment]').forEach(button=>button.onclick=()=>SessionAddForms.open('assignment',button.dataset.addAssignment));
  $('set-body').querySelectorAll('[data-add-tool]').forEach(button=>button.onclick=()=>SessionAddForms.open('tool',button.dataset.addTool,button.dataset.toolCategory));
  $('set-body').querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openTask(b.dataset.open));
})}
