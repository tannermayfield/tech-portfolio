/* ---------- the Menu and Settings sheets over the TV screen ---------- */
/* swapping straight from one sheet to another: no crossfade, so the work screen never peeks through */
function sheetSnap(){const g=$('tv-guide'),st=$('tv-settings');if(!(g.classList.contains('open')||st.classList.contains('open')))return;
  g.classList.add('snap');st.classList.add('snap');requestAnimationFrame(()=>requestAnimationFrame(()=>{g.classList.remove('snap');st.classList.remove('snap')}))}
function openGuide(){return SessionTV.hooks.run('guide:open',arguments,()=>{
  stopCut();sheetSnap();TV.mode='guide';TV.guideCat=current?.mood||'class';$('tv-settings').classList.remove('open');$('tv-guide').classList.add('open');renderGuide();renderPanel();renderSong();
})}
/* closing Settings returns to where you came from (the Menu, or the channel) */
function closeSheets(){
  if(TV.mode==='task')return;
  const back=TV.mode==='settings'?TV.preSet:null;TV.preSet=null;
  if(back&&back.mode==='guide'){stopCut();sheetSnap();TV.mode='guide';if(back.cat)TV.guideCat=back.cat;$('tv-settings').classList.remove('open');$('tv-guide').classList.add('open');renderGuide();renderPanel();renderSong();return}
  TV.mode='task';$('tv-guide').classList.remove('open');$('tv-settings').classList.remove('open');renderPanel();renderSong()}
$('guide-x').onclick=()=>closeSheets();

/* ---------- the Menu: a cable-style listings grid for Class, an on-demand option menu for Skills and Projects ---------- */
TV.gSel=TV.gSel||{};TV.gOff=null;TV.gFilter='All';TV.gHover=null;
/* class names come from the user's own classes (Settings → My Database → Classes), never a built-in list; use courseLabel. */
/* a class's code and name: "CS 101 — Computing" → {code:'CS 101',name:'Computing'}; name is '' when only the code is known */
function courseFields(key){
  const k=String(key||''),f=globalThis.SessionClasses?.fields?SessionClasses.fields(k):{},parts=k.split(' — ');
  const code=String(f.code||parts[0]).trim(),name=String(f.name||parts.slice(1).join(' — ')).trim();
  return {code,name:name&&name!==code&&name!==k?name:''};
}
/* how a class reads in lists: "CS 101 · Computing", or just the code when it has no separate name */
function courseLabel(key){const {code,name}=courseFields(key);return name?code+' · '+name:code}
const gdYmd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const gdVis=()=>{const w=$('crt').getBoundingClientRect().width;return w<600?2:w<1000?3:4};
function gdClock(){
  if(current?.mood==='class'){const t=T(TV.gSel.class);if(!t)return '';if(!t.due)return 'No due date';const d=dueAt(t)||parseDay(t.due);return `Due ${d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})} · ${fmtClock(d)}`}
  const d=new Date();return `${d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})} · ${fmtClock(d)}`}
function gdCourses(){if(globalThis.SessionClasses?.names)return SessionClasses.names();return [...new Set([...Object.keys(recall('sb.classes')),...tasks.filter(t=>typeOf(t)==='class'&&t.status!=='archived').map(t=>t.course||'Other')])].sort()}
function gdDays(){
  const all=candidates('class'),today=gdYmd(new Date());let lo=today,hi=gdYmd(new Date(Date.now()+6*864e5));
  all.forEach(t=>{if(!t.due)return;if(t.status!=='done'&&t.due<lo)lo=t.due;if(t.due>hi)hi=t.due});
  const out=[],d=parseDay(lo);while(gdYmd(d)<=hi&&out.length<120){out.push(gdYmd(d));d.setDate(d.getDate()+1)}
  if(all.some(t=>!t.due))out.push('none');return out;
}
function gdCellItems(course,day){return candidates('class').filter(t=>(t.course||'Other')===course&&(day==='none'?!t.due:t.due===day)).sort((a,b)=>(a.dueTime||'23:59').localeCompare(b.dueTime||'23:59'))}
function gdShortTime(hm){const [h,m]=(hm||'23:59').split(':').map(Number);return `${(h%12)||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`}
function gdDefaultSel(k){
  const s=TV.gSel[k];
  if(k==='class'){const all=candidates('class');if(s&&all.some(t=>t.id===s))return s;const a=T(current?.active);if(a&&typeOf(a)==='class')return a.id;return (listFor('class','Due Date')[0]||all[0])?.id||null}
  if(k==='skill'){const l=gdSkills();if(s&&l.some(t=>t.id===s))return s;const a=T(current?.active);if(a&&typeOf(a)==='skill'&&l.some(t=>t.id===a.id))return a.id;return l[0]?.id||null}
  const p=gdProjects();if(s&&p.includes(s))return s;const a=T(current?.active);if(a&&typeOf(a)==='project')return a.course||p[0];return p[0]||null;
}
/* in the Skills menu the category is already shown, so "Python for Data" under Data reads as just "Python" */
/* menu shows the stage name: NEW, LEARNED, EXPERIENCED or MASTERED */
function lvlTag(t){return LVL_TAG(skillLevel(t))}
function skShort(t){const c=catOf(t)||'';const q=c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const r=String(t.title||'').replace(new RegExp('\\s+for\\s+'+q+'$','i'),'').replace(new RegExp('\\s*\\('+q+'\\)$','i'),'');return r||t.title}
function gdFilt(){const subs=subsOf('skill');if(!subs.includes(TV.gFilter)){const a=T(current&&current.cur&&current.cur.skill);TV.gFilter=a&&subs.includes(catOf(a))?catOf(a):subs[0]}return TV.gFilter}
function gdSkills(){const all=allChannels('skill'),f=gdFilt();return all.filter(t=>catOf(t)===f)}
function gdProjects(){return subsOf('project').filter(p=>p!=='All')}
function gdProjLine(p){const n=listFor('project',p).filter(task=>!task.projectChannel).length;return n?`${n} open task${n===1?'':'s'}`:'Plan · Apply · Work'}

function gdInfoHTML(k){
  const sel=TV.gSel[k];
  if(k==='class'){const t=T(sel);if(!t)return `<div class="gd-sel"><div class="gd-t">Nothing listed</div></div><div class="gd-desc">Add an assignment and it shows up here on its due date.</div><div class="gd-det-row"><button type="button" class="btn gd-det" data-act="homework">Homework Overview</button></div>`;
    const d=dueFor(t),done=t.status==='done';
    return `<div class="gd-sel"><div class="gd-t">${esc(t.title)}</div></div>
      <div class="gd-desc">${esc(d.text)}${done?' · submitted':''}</div>
      <div class="gd-det-row"><button type="button" class="btn gd-det" data-act="homework">Homework Overview</button></div>
      <div class="gd-acts">${done?'':`<button type="button" class="btn primary" data-act="tune">Tune in ▸</button>`}${t.canvas?'':`<button type="button" class="btn" data-act="sub">${done?'Mark not submitted':'Mark submitted'}</button>`}</div>`}
  if(k==='skill'){const t=T(sel);if(!t)return `<div class="gd-sel"><div class="gd-t">No skills here</div></div><div class="gd-desc">Pick another category, or add a skill from Settings.</div>`;
    const n=skillLevel(t);
    return `<div class="gd-sel"><div class="gd-t">${esc(skShort(t))}</div></div>
      <div class="gd-desc">${esc(catOf(t))} · ${lvlTag(t)} · ${esc(agoLabel(t.lastPracticed))}${t.goal?` — ${esc(t.goal.charAt(0).toUpperCase()+t.goal.slice(1))}.`:''}</div>
      <div class="gd-acts"><button type="button" class="btn primary" data-act="tune">Open chat ▸</button></div>`}
  const p=sel;if(!p)return `<div class="gd-sel"><div class="gd-t">No projects yet</div></div><div class="gd-desc">Create a project from Settings → My Database → Projects.</div>`;
  const l=listFor('project',p);
  const ps=projectSkills(p);
  return `<div class="gd-sel"><div class="gd-t">${esc(p)}</div></div>
    <div class="gd-pskills">${ps.length?'Skills applied: '+esc(ps.join(', ')):'<span class="gd-psk none">No skills applied yet</span>'}</div>
    <div class="gd-desc">${l.some(task=>!task.projectChannel)?`Open tasks: ${l.filter(task=>!task.projectChannel).length}`:'Plan, Apply and Work chats'}</div>
    <div class="gd-acts"><button type="button" class="btn primary" data-act="tune">Work on it ▸</button></div>`;
}
function gdBindInfo(k){
  const box=$('gd-info-sel');if(!box)return;
  box.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{const a=b.dataset.act,sel=TV.gSel[k];
    if(a==='tune')gdTune(k,sel);
    else if(a==='sub')toggleSubmitted(sel).then(()=>renderGuide());
    else if(a==='homework')SessionHomework.open();
    else if(a==='info')openTask(sel);
    else if(a==='past')openPast()});
}
function gdPickPip(k){const list=THEMES[k]||THEMES.class,cur=TV.pipPick;let n=list[Math.floor(Math.random()*list.length)];if(list.length>1)while(n.id===cur)n=list[Math.floor(Math.random()*list.length)];TV.pipPick=n.id;const s=document.querySelector('#tv-guide .gd-pip span');if(s)s.textContent=`CH ${gdPipCh(k)} · ${n.name}`}
function gdPipCh(k){return (k==='class'&&courseCh(T(TV.gSel[k])))||CH_BASE[k]}
/* the tooltip on the item a first click selected: a second click on it opens it (every menu) */
const GD_AGAIN='Click again to open';
const gdAgain=on=>on?` title="${GD_AGAIN}"`:'';
function gdSetSel(k,v,rerender){
  const chg=k==='class'&&TV.gSel[k]!==v;
  TV.gSel[k]=v;if(chg)gdPickPip(k);
  document.querySelectorAll('#tv-guide [data-gid]').forEach(b=>{const on=b.dataset.gid===v;b.classList.toggle('sel',on);if(on)b.title=GD_AGAIN;else b.removeAttribute('title')});
  const box=$('gd-info-sel');if(box){box.innerHTML=gdInfoHTML(k);gdBindInfo(k)}
  const ck=$('gd-clock');if(ck)ck.textContent=gdClock();
}
function gdTune(k,sel){
  if(k==='project'){const l=listFor('project',sel);TV.sub.project=sel;store('sb.tvsub',TV.sub);closeSheets();
    if(l[0])tune(l[0].id);else{tune(null,{cat:'project'});toast(`No open tasks in ${sel} yet. Add one from Settings.`)}return}
  const t=T(sel);if(!t)return;
  TV.sub[k]=k==='class'?curSub('class'):subOfTask(t);store('sb.tvsub',TV.sub);const pip=k==='class'&&TV.pipPick&&(THEMES[k]||[]).some(x=>x.id===TV.pipPick)?TV.pipPick:null;closeSheets();tune(sel,pip?{themeId:pip}:{});
}

function renderGuide(){return SessionTV.hooks.run('guide:render',arguments,()=>{
  const g=$('tv-guide');if(!g||!current)return;
  const k=current.mood;TV.gSel[k]=gdDefaultSel(k);
  const keepScroll=g.querySelector('.gd-pills')?.scrollTop||0;
  const th=themeById(current.themeId)||THEMES[k][0];
  const what=k==='class'?'Classwork':k==='skill'?'Skills':'Projects';
  let body='',hint='';
  if(k==='class'){
    const days=gdDays(),N=Math.min(gdVis(),days.length),courses=gdCourses(),today=gdYmd(new Date());
    if(TV.gOff==null){const ti=days.indexOf(today);TV.gOff=ti<0?0:ti}
    TV.gDays=days;TV.gN=N;
    TV.gWide=TV.gWide||new Set();
    const maxN=d=>Math.max(0,...courses.map(c=>gdCellItems(c,d).length));
    const W=days.map(d=>TV.gWide.has(d)&&maxN(d)>2?Math.max(1.5,maxN(d)/2+.25):1);TV.gW=W;
    // expanding/collapsing never moves the view: the left-most day stays put and the wide day grows to the right
    TV.gFocus=null;TV.gOff=Math.max(0,Math.min(TV.gOff,gdMaxOff()));
    const tot=W.reduce((s,x)=>s+x,0),tr=`width:${tot/N*100}%;transform:translateX(-${gdOffPct()}%)`;
    const cwOf=j=>`width:${W[j]/tot*100}%`;
    const dayLbl=d=>{if(d==='none')return 'NO DATE';const x=parseDay(d);const s=`${x.toLocaleDateString(undefined,{weekday:'short'}).toUpperCase()} ${x.getMonth()+1}/${x.getDate()}`;return d===today?`TODAY <small>${x.getMonth()+1}/${x.getDate()}</small>`:s};
    body=`<div class="gd-grid" id="gd-grid">
      <div class="gd-row gd-hdr"><div class="gd-ch"><button type="button" data-slide="-1" aria-label="Earlier days">◀</button><button type="button" data-today>Today</button></div>
        <div class="gd-vp"><div class="gd-track" style="${tr}">${days.map((d,j)=>`<div class="gd-day${d===today?' today':''}" style="${cwOf(j)}">${dayLbl(d)}</div>`).join('')}</div></div>
        <div class="gd-end"><button type="button" data-slide="1" aria-label="Later days">▶</button></div></div>
      ${courses.map((c,i)=>`<div class="gd-row"><div class="gd-ch"><b>${esc(courseFields(c).code||c)}</b><small>${esc(courseFields(c).name||('CH '+(101+i)))}</small></div>
        <div class="gd-vp"><div class="gd-track" style="${tr}">${days.map((d,j)=>{const all=gdCellItems(c,d),wide=TV.gWide.has(d),items=all.length>2&&!wide?all.slice(0,2):all;
          const more=all.length>2?(wide?`<button type="button" class="gd-more-btn" data-less="${d}" aria-label="Show fewer">&lt;</button>`:`<button type="button" class="gd-more-btn" data-more="${d}" aria-label="Show ${all.length-2} more">+${all.length-2}</button>`):'';
          return `<div class="gd-cell${d===today?' today':''}" style="${cwOf(j)}">${items.length?items.map(t=>{const late=t.status!=='done'&&dueAt(t)&&dueAt(t)<new Date();
            return `<button type="button" class="gd-prog${t.id===TV.gSel.class?' sel':''}${t.status==='done'?' done':''}${late?' late':''}" data-gid="${esc(t.id)}"${gdAgain(t.id===TV.gSel.class)}><span class="pt">${esc(t.title)}</span><small>${d==='none'?'ANYTIME':gdShortTime(t.dueTime)}</small></button>`}).join('')+more:'<span class="gd-empty"></span>'}</div>`}).join('')}</div></div>
        <div class="gd-end"></div></div>`).join('')}
    </div>`;
    hint='Slide ◀ ▶ through the days · click a show twice to tune in';
  }else{
    const opts=k==='skill'?gdSkills():gdProjects();
    const filt=k==='skill'?`<div class="gd-filt" role="group" aria-label="Category">${(gdFilt(),subsOf('skill')).map(c=>`<button type="button" data-filt="${esc(c)}" aria-pressed="${TV.gFilter===c}">${esc(c)}</button>`).join('')}</div>`:'';
    const pills=opts.length?opts.map(o=>k==='skill'
      ?`<button type="button" class="gd-pill${o.id===TV.gSel.skill?' sel':''}" data-gid="${esc(o.id)}"${gdAgain(o.id===TV.gSel.skill)}><span class="pn">${esc(skShort(o))}</span><i class="lv">${lvlTag(o)}</i></button>`
      :`<button type="button" class="gd-pill gd-proj${o===TV.gSel.project?' sel':''}" data-gid="${esc(o)}"${gdAgain(o===TV.gSel.project)}><span class="pn">${esc(o)}</span><small class="ps">${gdProjLine(o)}</small></button>`).join('')
      :`<p class="gd-none">Nothing on demand here yet.</p>`;
    body=`<div class="gd-menu">${filt}<div class="gd-pills${k==='project'?' gd-projs':''}" id="gd-pills">${pills}</div><div class="gd-more" id="gd-more"></div></div>`;
    hint=k==='skill'?'Pick a skill to open its chat with AI coach':'Pick a project, then plan the work with AI coach';
  }
  g.innerHTML=`<button type="button" class="gd-x" id="gd-x">EXIT ✕</button>
    <div class="gd-top"><div class="gd-info"><div class="gd-brand"><span class="gd-logo">Session<b>TV</b></span><span class="gd-what">${what}</span><span class="gd-clock" id="gd-clock">${gdClock()}</span></div><div id="gd-info-sel" style="display:flex;flex-direction:column;gap:6px">${gdInfoHTML(k)}</div></div>
      <div class="gd-pip"><canvas id="gd-pip"></canvas><span>CH ${gdPipCh(k)} · ${esc(((TV.pipPick&&(THEMES[k]||[]).find(x=>x.id===TV.pipPick))||th).name)}</span></div></div>
    <div class="gd-body">${body}</div>
    <div class="gd-ad"><b>Session TV</b><span>${hint}</span></div>`;
  $('gd-x').onclick=()=>closeSheets();gdBindInfo(k);
  g.querySelectorAll('[data-more],[data-less]').forEach(b=>b.onclick=e=>{e.stopPropagation();const d=b.dataset.more||b.dataset.less;if(b.dataset.more){TV.gWide.add(d);TV.gFocus=d}else{TV.gWide.delete(d);TV.gFocus=null}renderGuide()});
  g.querySelectorAll('[data-gid]').forEach(b=>{
    // first click shows it on the info board, a second click on the same one tunes in (every menu)
    b.onclick=()=>{const v=b.dataset.gid;if(TV.gSel[k]!==v){gdSetSel(k,v);return}gdTune(k,v)};
    b.onfocus=()=>{if(b.matches(':focus-visible'))gdSetSel(k,b.dataset.gid)};
  });
  g.querySelectorAll('[data-filt]').forEach(b=>b.onclick=()=>{TV.gFilter=b.dataset.filt;TV.gSel.skill=null;renderGuide()});
  g.querySelectorAll('[data-slide]').forEach(b=>b.onclick=()=>gdSlide(+b.dataset.slide));
  g.querySelector('[data-today]')?.addEventListener('click',()=>{const i=TV.gDays.indexOf(gdYmd(new Date()));gdSlideTo(i<0?0:i)});
  const pl=$('gd-pills');if(pl){pl.scrollTop=keepScroll;const more=()=>{$('gd-more').textContent=pl.scrollTop+pl.clientHeight<pl.scrollHeight-4?'▼':''};pl.onscroll=more;requestAnimationFrame(more)}
  if(k==='class')gdArrows();
  gdSwipe();gdPip();
})}
/* furthest you can slide: the last start day that still fills the screen (wide days count for more) */
function gdMaxOff(){const W=TV.gW||[],N=TV.gN||3;let i=W.length-1,sum=0;
  while(i>=0){sum+=W[i];if(sum>=N-.01)return i;i--}return 0}
function gdOffPct(){const W=TV.gW||[],tot=W.reduce((s,x)=>s+x,0)||1;return W.slice(0,TV.gOff||0).reduce((s,x)=>s+x,0)/tot*100}
function gdSlideTo(i){
  TV.gOff=Math.max(0,Math.min(i,gdMaxOff()));
  document.querySelectorAll('#tv-guide .gd-track').forEach(tr=>tr.style.transform=`translateX(-${gdOffPct()}%)`);gdArrows();
}
function gdSlide(n){gdSlideTo((TV.gOff||0)+n)}
function gdArrows(){const days=TV.gDays||[],N=TV.gN||3;const p=document.querySelector('#tv-guide [data-slide="-1"]'),n=document.querySelector('#tv-guide [data-slide="1"]');if(p)p.disabled=TV.gOff<=0;if(n)n.disabled=TV.gOff>=gdMaxOff()}
function gdSwipe(){
  const grid=$('gd-grid');if(!grid)return;let x0=null;
  grid.onpointerdown=e=>{if(e.pointerType!=='mouse')x0=e.clientX};
  grid.onpointerup=e=>{if(x0==null)return;const dx=e.clientX-x0;x0=null;if(Math.abs(dx)>40)gdSlide(dx<0?1:-1)};
  // one swipe = one day: a trackpad swipe keeps sending scroll events (momentum) after the fingers lift,
  // so a swipe only counts once, and the next one waits until those events have stopped
  grid.onwheel=e=>{
    if(Math.abs(e.deltaX)<=Math.abs(e.deltaY))return;e.preventDefault();
    const W=TV.gWh||(TV.gWh={acc:0,used:false,t:0}),d=Math.abs(e.deltaX),dir=Math.sign(e.deltaX),now=e.timeStamp;
    clearTimeout(W.t);W.t=setTimeout(()=>{W.acc=0;W.used=false},140);
    if(W.used){
      // after a day moves, ignore the rest of that swipe (the finger part and the coasting after it).
      // A smoothed speed is tracked; a new swipe only counts once the coasting has faded to under half its peak
      // and the movement then surges well above the smoothed speed (or turns around).
      const prev=W.ema,surge=W.fading&&d>prev*2&&d>12,flip=W.fading&&dir!==W.dir&&d>8;
      W.ema=prev*.7+d*.3;W.peak=Math.max(W.peak,W.ema);if(W.ema<W.peak*.5)W.fading=true;
      if(now-W.at>250&&(surge||flip)){W.used=false;W.acc=0}else return;
    }
    W.acc+=e.deltaX;
    if(Math.abs(W.acc)>30){W.used=true;W.dir=dir;W.at=now;W.ema=d;W.peak=d;W.fading=false;gdSlide(W.acc>0?1:-1)}
  };
}
// keyboard: arrows move through the listings or the menu, Enter tunes in
document.addEventListener('keydown',e=>{
  if(TV.mode!=='guide'||!current||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter'].includes(e.key))return;
  if(e.target.closest&&e.target.closest('input,textarea,select'))return;
  const k=current.mood,sel=TV.gSel[k];
  if(e.key==='Enter'){if(e.target.closest&&e.target.closest('button'))return;e.preventDefault();if(sel)gdTune(k,sel);return}
  e.preventDefault();
  if(k==='class'){
    const t=T(sel),courses=gdCourses(),days=TV.gDays||[];
    if(!t){gdSlide(e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0);return}
    const dayOf=x=>x.due?days.indexOf(x.due):days.length-1;
    const row=c=>days.flatMap(d=>gdCellItems(c,d));
    let next=null;
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){const r=row(t.course||'Other'),i=r.findIndex(x=>x.id===t.id);next=r[i+(e.key==='ArrowRight'?1:-1)];if(!next){gdSlide(e.key==='ArrowRight'?1:-1);return}}
    else{const ci=courses.indexOf(t.course||'Other');for(let j=ci+(e.key==='ArrowDown'?1:-1);j>=0&&j<courses.length;j+=(e.key==='ArrowDown'?1:-1)){const r=row(courses[j]);if(r.length){const di=dayOf(t);next=r.slice().sort((a,b)=>Math.abs(dayOf(a)-di)-Math.abs(dayOf(b)-di))[0];break}}}
    if(next){gdSetSel(k,next.id);const di=dayOf(next),N=TV.gN||3;if(di<TV.gOff)gdSlideTo(di);else if(di>=TV.gOff+N)gdSlideTo(di-N+1);document.querySelector(`#tv-guide [data-gid="${CSS.escape(next.id)}"]`)?.focus({preventScroll:true})}
    return;
  }
  const btns=[...document.querySelectorAll('#tv-guide .gd-pill')];if(!btns.length)return;
  const cols=getComputedStyle($('gd-pills')).gridTemplateColumns.split(' ').length;
  let i=btns.findIndex(b=>b.dataset.gid===sel);if(i<0)i=0;
  i+= e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:e.key==='ArrowDown'?cols:-cols;
  i=Math.max(0,Math.min(btns.length-1,i));btns[i].focus();btns[i].scrollIntoView({block:'nearest'});
});
// the picture-in-picture preview plays the channel's scene in the corner
function gdPip(){
  if(TV.pip)return;const loop=ts=>{
    if(TV.mode!=='guide'||!current){TV.pip=0;return}
    TV.pip=requestAnimationFrame(loop);if(ts-(TV.pipLast||0)<55)return;TV.pipLast=ts;
    const cv=$('gd-pip');if(!cv||!cv.offsetWidth)return;
    const th=(TV.pipPick&&themeById(TV.pipPick)&&(THEMES[current.mood]||[]).some(x=>x.id===TV.pipPick)?themeById(TV.pipPick):null)||themeById(current.themeId)||THEMES[current.mood][0];const {W,H}=canvasFit(cv,.8);
    if(TV.pipTh!==th.id||TV.pipW!==W){TV.pipTh=th.id;TV.pipW=W;TV.pipS=th.init?th.init(W,H):{};TV.pipT0=ts-8000}
    const x=cv.getContext('2d');x.save();th.draw(x,W,H,(ts-TV.pipT0)/1000,TV.pipS);x.restore();
    const c=$('gd-clock');if(c&&ts-(TV.clkLast||0)>1000){TV.clkLast=ts;c.textContent=gdClock()}
  };TV.pip=requestAnimationFrame(loop);
}
addEventListener('resize',()=>{if(TV.mode==='guide'&&current?.mood==='class'&&gdVis()!==TV.gN)renderGuide()});

