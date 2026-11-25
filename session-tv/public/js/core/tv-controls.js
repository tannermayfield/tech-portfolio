/* ================= TV controller: channels, tuning, knobs, cutscenes, song plate, timer and on-screen display ================= */
document.body.classList.add('tv');
const TV={scheme:recall('sb.scheme'),cutLen:recall('sb.cutLen')?4:0,sub:recall('sb.tvsub'),theme:null,mode:'task',guideCat:null,cut:null,songIdx:0,songT:0};
const MAIN=['class','skill','project'],CH_BASE={class:100,skill:200,project:300},MAIN_LBL={class:'Class',skill:'Skills',project:'Projects'};
const darkMQ=matchMedia('(prefers-color-scheme: dark)');
function applyScheme(){const s=TV.scheme==='auto'?(darkMQ.matches?'dark':'light'):TV.scheme;document.body.dataset.scheme=s;document.documentElement.dataset.theme=s}
darkMQ.addEventListener?.('change',()=>{applyScheme();renderWork()});
applyScheme();

/* ---------- channels ---------- */
// projects with open tasks, in task order
function openProjectNames(){const seen=[];tasks.filter(t=>typeOf(t)==='project'&&t.status!=='done').sort(byOrder).forEach(t=>{const c=t.course||'Other';if(!seen.includes(c))seen.push(c)});return seen}
function subsOf(k){return SessionTV.hooks.run('subs:list',arguments,k=>{
  if(k==='class')return ['Due Date',...gdCourses()];
  if(k==='skill')return Object.keys(SKILL_TAGS);
  const p=[...new Set([...openProjectNames(),...(globalThis.SessionProjectChats?.names()||[])])];return p.length?p:['All'];
})}
function curSub(k){const s=subsOf(k);return s.includes(TV.sub[k])?TV.sub[k]:s[0]}
function listFor(k,sub){
  let l=candidates(k).filter(t=>t.status!=='done');
  if(k==='class')return (sub==='Due Date'?l:l.filter(t=>t.course===sub)).sort(byDue);
  if(k==='skill')return globalThis.SessionSkills?SessionSkills.channels(sub):l.filter(t=>catOf(t)===sub).sort((a,b)=>byOrder(a,b)||skillLevel(a)-skillLevel(b)); // one channel per skill; its tools ride along
  const channel=globalThis.SessionProjectChats?.channel('project:'+pslug(sub));
  if(channel)return [channel,...l.filter(t=>(t.course||'Other')===sub)];
  return sub==='All'?l:l.filter(t=>(t.course||'Other')===sub);
}
function allChannels(k){return k==='class'?listFor('class','Due Date'):subsOf(k).flatMap(s=>listFor(k,s))}
function courseCh(t){const m=t&&typeOf(t)==='class'&&String(t.course||'').match(/(\d{3,4})/);return m?m[1]:''}
function chNum(t){if(!t)return '';if(courseCh(t))return courseCh(t);const k=typeOf(t),i=allChannels(k).findIndex(x=>x.id===t.id);return String(CH_BASE[k]+(i<0?0:i+1))}
function subOfTask(t){const k=typeOf(t);if(k==='class')return curSub('class')==='Due Date'?'Due Date':t.course;if(k==='skill')return catOf(t);return t.course||'Other'}

function ensureSession(){
  if(current||!db||!loaded.state||!loaded.tasks)return;
  const now=Date.now(),k='class',first=listFor(k,curSub(k))[0]||allChannels(k)[0];
  current={startedAt:new Date(now).toISOString(),endAt:null,minutes:0,alloc:{},mood:k,order:CATS.slice(),active:first?.id||null,activeSince:now,timeOn:{},practiced:[],cur:{class:first?.id||null,skill:null,project:null}};
  wrapping=false;coachTurns={};saveState();
}
// an old session whose finish time passed long ago just loses its timer instead of jumping into teach back
function tidySession(){
  if(!current||!current.endAt)return;
  const over=Date.now()-new Date(current.endAt).getTime();
  if(over>2*3600e3&&!current.tbStarted){current.endAt=null;saveState()}
}

/* ---------- themes ---------- */
function pickTheme(k){return SessionTV.hooks.run('theme:pick',arguments,k=>{
  const list=THEMES[k],last=current?.themeId;let pool=list.filter(x=>x.id!==last);if(!pool.length)pool=list;
  return pool[Math.floor(Math.random()*pool.length)];
})}
function themeById(id){for(const k of MAIN){const f=THEMES[k].find(x=>x.id===id);if(f)return f}return null}
function activeTheme(){
  if(wrapping)return TB_THEME;
  if(TV.mode==='guide')return MENU_THEME;
  const t=themeById(current?.themeId);if(t&&current&&THEMES[current.mood]?.includes(t))return t;
  return THEMES[current?.mood||'class'][0];
}

/* ---------- tuning to a channel ---------- */
async function tune(id,opts={}){
  if(!current)return;const t=T(id);
  if(!opts.keepGuide)closeSheets();accumulate();
  if(t){const k=typeOf(t);current.mood=k;current.active=id;current.cur[k]=id}else{current.active=null;if(opts.cat)current.mood=opts.cat}
  current.activeSince=Date.now();
  const th=(opts.themeId&&(THEMES[current.mood]||[]).find(x=>x.id===opts.themeId))||pickTheme(current.mood);current.themeId=th.id;
  saveState();
  await staticBurst();
  renderWork();
  if(t&&opts.cut!==false&&TV.mode!=='guide')playCut(th,chNum(t));
}
function turnMain(dir){
  if(!current)return;stopCut();
  const i=MAIN.indexOf(current.mood),k=MAIN[(i+dir+MAIN.length)%MAIN.length];
  current.cur[current.mood]=current.active;
  // back to the task you had open in that category; if there isn't one, open that category's menu
  const keep=current.cur[k],ok=keep&&allChannels(k).some(x=>x.id===keep);
  if(ok){tune(keep,{cat:k,keepGuide:TV.mode==='guide'});return}
  const inGuide=TV.mode==='guide';
  tune(null,{cat:k,keepGuide:true,cut:false});
  if(inGuide){TV.guideCat=k;renderGuide();renderPanel()}else openGuide();
}
function turnSub(dir){
  if(!current)return;stopCut();
  const k=current.mood,s=subsOf(k),i=s.indexOf(curSub(k)),n=s[(i+dir+s.length)%s.length];
  TV.sub[k]=n;store('sb.tvsub',TV.sub);
  const first=listFor(k,n)[0];
  tune(first?first.id:null,{cat:k});
}
// "Done, next" / "Next Skill" move to the next channel on the same sub-channel
async function markDone(id){
  accumulate();const t=T(id);if(!t)return;
  const practiced=(current.practiced||[]).slice();
  if(isSkill(t)){current.practiced=[...new Set([...practiced,id])]}
  const k=typeOf(t),list=listFor(k,curSub(k)),i=list.findIndex(x=>x.id===id);
  const after=[...list.slice(i+1),...list.slice(0,Math.max(0,i))].find(x=>x.id!==id&&!isDoneNow(x))||allChannels(k).find(x=>x.id!==id&&!isDoneNow(x));
  saveState();
  const msg=after?'Nice. On to the next channel.':'That was the last one here.';
  const undo=()=>{current.practiced=practiced;saveState();renderWork()}; // the save failed: it is not practiced, stay on this channel
  const saved=isSkill(t)
    ?await guard(()=>t.skillChannel?SessionSkills.practice(id):db.doc('tasks/'+id).update({lastPracticed:new Date().toISOString(),reps:(t.reps||0)+1}),msg,undo)
    :await guard(()=>db.doc('tasks/'+id).update({status:'done',doneAt:new Date().toISOString()}),msg,undo);
  if(!saved)return;
  if(after)tune(after.id);else renderWork();
}
function selectTask(id){tune(id)}

/* ---------- static between channels ---------- */
function staticBurst(){
  if(reduce())return Promise.resolve();
  const crt=$('crt'),cv=$('tv-static'),x=cv.getContext('2d');cv.width=160;cv.height=100;
  crt.classList.add('tuning');const t0=performance.now();
  return new Promise(res=>{const f=ts=>{const img=x.createImageData(160,100);for(let i=0;i<img.data.length;i+=4){const v=Math.random()*255|0;img.data[i]=img.data[i+1]=img.data[i+2]=v;img.data[i+3]=255}
    x.putImageData(img,0,0);if(ts-t0<380)requestAnimationFrame(f);else{crt.classList.remove('tuning');res()}};requestAnimationFrame(f)});
}

/* ---------- cutscene ---------- */
function canvasFit(cv,scale=1){const r=cv.getBoundingClientRect(),dpr=Math.min(1.5,window.devicePixelRatio||1,Math.sqrt(1280*720/Math.max(1,r.width*r.height)))*scale;const w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}return {W:w,H:h}}
function playCut(th,ch){
  stopCut();if(!TV.cutLen||reduce())return;
  const crt=$('crt'),cv=$('tv-cut'),x=cv.getContext('2d');
  $('cut-ch').textContent=`Now showing · CH ${ch}`;$('cut-name').textContent=th.name;
  crt.classList.add('cut');const {W,H}=canvasFit(cv);const S=th.init?th.init(W,H):{};
  const dur=TV.cutLen*1000,t0=performance.now();
  const c={raf:0,done:false};TV.cut=c;
  const f=ts=>{if(c.done)return;const el=ts-t0;const {W,H}=canvasFit(cv);x.save();th.draw(x,W,H,el/1000,S);x.restore();
    $('cut-bar').style.width=Math.min(100,el/dur*100)+'%';if(el>=dur){stopCut();return}c.raf=requestAnimationFrame(f)};
  c.raf=requestAnimationFrame(f);
}
function stopCut(){const c=TV.cut;if(!c)return;c.done=true;cancelAnimationFrame(c.raf);TV.cut=null;$('crt').classList.remove('cut');$('cut-bar').style.width='0'}
$('cut-skip').onclick=e=>{e.stopPropagation();stopCut()};
$('tv-cut').onclick=()=>stopCut();
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&TV.cut)stopCut()});

/* ---------- ambient background: the theme's colors drifting slowly behind the screen content ---------- */
const AMB={raf:0,last:0};
function ambLoop(ts){
  AMB.raf=requestAnimationFrame(ambLoop);
  if(document.hidden||TV.cut||ts-AMB.last<66)return;AMB.last=ts;
  const cv=$('tv-amb'),{W,H}=canvasFit(cv,.35),x=cv.getContext('2d'),th=activeTheme(),p=th.pal,t=ts/1000;
  const dark=document.body.dataset.scheme==='dark';
  const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,p[0]);g.addColorStop(1,p[1]);x.fillStyle=g;x.fillRect(0,0,W,H);
  for(let i=0;i<3;i++){const c=p[2+i]||p[2];const bx=W*(.5+.38*Math.sin(t*.07+i*2.1)),by=H*(.5+.34*Math.cos(t*.05+i*1.7)),r=Math.max(W,H)*(.45+.1*Math.sin(t*.1+i));
    const rg=x.createRadialGradient(bx,by,0,bx,by,r);rg.addColorStop(0,c);rg.addColorStop(1,'rgba(0,0,0,0)');x.globalAlpha=.55;x.fillStyle=rg;x.fillRect(0,0,W,H)}
  x.globalAlpha=1;
  if(th.grain){for(let i=0;i<W*H/60;i++){x.fillStyle=`rgba(255,255,255,${Math.random()*.08})`;x.fillRect(Math.random()*W,Math.random()*H,1,1)}
    if(Math.random()<.15){x.fillStyle='rgba(255,255,255,.08)';x.fillRect(Math.random()*W,0,1,H)}}
  if(dark){x.fillStyle='rgba(0,0,0,.35)';x.fillRect(0,0,W,H)}
}
if(!reduce())AMB.raf=requestAnimationFrame(ambLoop);else{requestAnimationFrame(ts=>{ambLoop(ts);cancelAnimationFrame(AMB.raf)})}

/* ---------- control panel ---------- */
function knobLabels(){
  const w=$('kw-main'),ang=[-50,0,50],R=66,C=66;
  w.querySelectorAll('.lbl,.tick').forEach(n=>n.remove());
  MAIN.forEach((k,i)=>{const a=ang[i]*Math.PI/180;
    const l=document.createElement('span');l.className='lbl';l.dataset.k=k;l.textContent=MAIN_LBL[k];const P=[{right:'106px',bottom:'101px'},{left:'66px',bottom:'119px',transform:'translateX(-50%)'},{left:'106px',bottom:'101px'}][i];l.style.transform='none';Object.assign(l.style,P);w.appendChild(l);
    const tk=document.createElement('i');tk.className='tick';tk.dataset.k=k;tk.style.transform=`rotate(${ang[i]}deg) translateY(-48px)`;w.appendChild(tk)});
}
knobLabels();
function renderPanel(){
  if(!current)return;const k=current.mood,i=MAIN.indexOf(k),ang=[-50,0,50][i];
  $('knob-main').setAttribute('aria-label',`Channel knob: ${MAIN_LBL[k]}. Click for the next channel, right-click for the previous one`);
  $('kw-main').querySelectorAll('.lbl,.tick').forEach(n=>n.classList.toggle('on',n.dataset.k===k));
  {const dd=$('dial-disc');if(dd){const prev=+(dd.dataset.r||0),want=i*120;let r=prev+((((want-prev)%360)+360)%360);dd.dataset.r=r;dd.style.transform=`rotate(${r}deg)`;$('knob-main').style.transform=`rotate(${r}deg)`}}
  const s=subsOf(k),si=s.indexOf(curSub(k)),n=s.length,spread=n>1?Math.min(240,(n-1)*50):0,sa=n>1?-spread/2+si*spread/(n-1):0;
  const w=$('kw-sub');w.querySelectorAll('.tick').forEach(x=>x.remove());
  s.forEach((_,j)=>{const a=n>1?-spread/2+j*spread/(n-1):0;const tk=document.createElement('i');tk.className='tick'+(j===si?' on':'');tk.style.transform=`rotate(${a}deg) translateY(-50px)`;w.appendChild(tk)});
  $('knob-sub').style.transform=`rotate(${sa}deg)`;$('knob-sub').setAttribute('aria-label',`Sub-channel knob: ${curSub(k)}. Click for the next sub-channel`);
  $('sub-name').textContent=curSub(k);
  $('btn-menu').setAttribute('aria-pressed',String(TV.mode==='guide'));$('btn-set').setAttribute('aria-pressed',String(TV.mode==='settings'));
}
function bindKnob(el,fn){
  el.onclick=e=>{e.preventDefault();fn(e.shiftKey?-1:1)};
  el.oncontextmenu=e=>{e.preventDefault();fn(-1)};
  el.addEventListener('wheel',e=>{e.preventDefault();if(bindKnob.lock)return;bindKnob.lock=true;setTimeout(()=>bindKnob.lock=false,350);fn(e.deltaY>0?1:-1)},{passive:false});
  el.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();fn(1)}else if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();fn(-1)}};
}
bindKnob($('knob-main'),turnMain);bindKnob($('knob-sub'),turnSub);
$('btn-menu').onclick=()=>{if(TV.mode==='guide')closeSheets();else openGuide()};
$('btn-set').onclick=()=>{if(TV.mode==='settings')closeSheets();else openSettings()};

/* ---------- song plate by the speaker: TV Radio (music.js) draws it through the song:render hook ---------- */
function renderSong(){return SessionTV.hooks.run('song:render',arguments,()=>{})}
setInterval(()=>{if(wrapping)renderSong()},15000);

/* ---------- timer: set a finish time, it counts down hours:minutes left ---------- */
const SEGS={a:'M6 2h28l-5 6H11z',b:'M35 4v29l-6-5V10z',c:'M35 37v29l-6-5V43z',d:'M6 68h28l-5-6H11z',e:'M5 37v29l6-5V43z',f:'M5 4v29l6-5V10z',g:'M8 35l4-4h16l4 4-4 4H12z'};
const DIG={'0':'abcdef','1':'bc','2':'abged','3':'abgcd','4':'fgbc','5':'afgcd','6':'afgedc','7':'abc','8':'abcdefg','9':'abcdfg','-':'g',' ':''};
function segSvg(str,blink){
  let x=4,out='',ci=-1;
  for(const ch of str){ci++;
    if(ch===':'){out+=`<g class="colon"><rect x="${x+3}" y="22" width="6" height="6" class="seg-on"/><rect x="${x+3}" y="44" width="6" height="6" class="seg-on"/></g>`;x+=16;continue}
    const on=DIG[ch]||'';out+=`<g transform="translate(${x} 0)"${blink&&blink.includes(ci)?' class="blink"':''}>`+Object.keys(SEGS).map(s=>`<path d="${SEGS[s]}" class="${on.includes(s)?'seg-on':'seg-off'}"/>`).join('')+`</g>`;x+=44;
  }
  return `<svg viewBox="0 0 ${x+2} 72" aria-hidden="true">${out}</svg>`;
}
function minsLeft(){return current?.endAt?Math.ceil((new Date(current.endAt)-Date.now())/60000):null}
function renderClock(){
  if(!current)return;if(TV.tEdit!=null)return;const m=minsLeft();
  let s='--:--',cap='Set Timer';
  if(m!=null){const v=Math.max(0,m);s=String(Math.floor(v/60)).padStart(2,'0')+':'+String(v%60).padStart(2,'0');cap=`Ends ${fmtClock(new Date(current.endAt)).replace(/\s?[AP]M$/i,'')}`}
  const up=m!=null&&m<=0&&!wrapping;if(up)cap="Time's up · click";
  $('tv-timer').classList.toggle('live',m!=null&&m>0);$('tv-timer').classList.toggle('expired',up);
  const key=s+cap;if($('tv-timer').dataset.k!==key){$('tv-timer').dataset.k=key;$('tv-timer').innerHTML=segSvg(s)+`<span class="cap">${esc(cap)}</span>`;
    $('tv-timer').setAttribute('aria-label',up?"Time's up. Click to start your session review":m==null?'Timer not set. Click to set your finish time':`${Math.floor(Math.max(0,m)/60)} hours ${Math.max(0,m)%60} minutes left. Click to change`)}

}
setInterval(()=>renderClock(),5000);
// the next time the clock shows h12:mm (today or tomorrow, AM or PM)
function finishFrom(h12,mm){
  const now=Date.now(),cands=[];for(const day of [0,1])for(const add of [0,12]){const d=new Date();d.setDate(d.getDate()+day);d.setHours((h12%12)+add,mm,0,0);if(d.getTime()>now+30000)cands.push(d.getTime())}
  return Math.min(...cands);
}

/* ---------- the screen ---------- */
function renderOSD(){
  if(!current)return;const t=T(current.active),k=current.mood;
  $('tv-osd').innerHTML=wrapping?`<span class="ch">CH 000</span><span>TEACH BACK</span><span class="grow"></span>`
    :`<span class="ch">CH ${t?chNum(t):CH_BASE[k]}</span><span>${MAIN_LBL[k].toUpperCase()}</span><span class="sub">· ${esc(curSub(k).toUpperCase())}</span><span class="grow"></span>${t?`<button type="button" id="osd-replay" title="Replay this channel's scene">▶ ${esc(activeTheme().name)}</button>`:''}`;
  if($('osd-replay'))$('osd-replay').onclick=()=>playCut(activeTheme(),chNum(t));
}

/* ---------- live picture-tube interference: fine snow, a rolling bar and thin lines drifting down the screen ---------- */
(function(){
  const crt=$('crt'),cv=document.createElement('canvas');cv.id='tv-noise';cv.setAttribute('aria-hidden','true');crt.insertBefore(cv,crt.querySelector('.crt-fx'));
  const x=cv.getContext('2d'),NW=240,NH=150,nz=document.createElement('canvas');nz.width=NW;nz.height=NH;const nx=nz.getContext('2d'),img=nx.createImageData(NW,NH);
  let last=0,lines=[],bars=[{p:0,speed:1/9,h:.12,a:.05},{p:.55,speed:1/23,h:.05,a:.03}];
  const fill=()=>{const d=img.data;for(let i=0;i<d.length;i+=4){const v=Math.random()*255|0;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255}nx.putImageData(img,0,0)};
  function frame(ts){
    requestAnimationFrame(frame);
    if(document.hidden||document.body.dataset.screenEffect==='off'||ts-last<41)return;const dt=Math.min(.1,(ts-last)/1000);last=ts;
    const {W,H}=canvasFit(cv,.6);x.clearRect(0,0,W,H);
    if(reduce())return;
    const busy=crt.classList.contains('cut');
    fill();x.imageSmoothingEnabled=false;
    // overall snow, faint so the screen stays readable
    x.globalAlpha=busy?.035:(document.body.dataset.scheme==='dark'?.026:.016);x.drawImage(nz,0,0,W,H);
    // rolling bars: brighter, noisier strips that crawl from top to bottom
    for(const b of bars){b.p=(b.p+dt*b.speed)%1.25;const cy=(b.p-.12)*H,bh=b.h*H;
      const g=x.createLinearGradient(0,cy-bh,0,cy+bh);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,`rgba(245,245,245,${b.a})`);g.addColorStop(1,'rgba(255,255,255,0)');
      x.globalAlpha=1;x.fillStyle=g;x.fillRect(0,cy-bh,W,bh*2);
      x.globalAlpha=b.a;x.drawImage(nz,0,(Math.random()*NH*.6)|0,NW,(NH*.25)|0,0,cy-bh*.5,W,bh);
      const dg=x.createLinearGradient(0,cy+bh,0,cy+bh*2.2);dg.addColorStop(0,'rgba(0,0,0,0)');dg.addColorStop(.5,`rgba(0,0,0,${b.a*.9})`);dg.addColorStop(1,'rgba(0,0,0,0)');
      x.globalAlpha=1;x.fillStyle=dg;x.fillRect(0,cy+bh,W,bh*1.2)}
    // thin broken interference lines falling down the tube
    if(Math.random()<.08)lines.push({y:-.02,v:.12+Math.random()*.5,a:.06+Math.random()*.09,h:Math.random()<.7?1:2,seed:Math.random()});
    x.globalAlpha=1;lines=lines.filter(l=>l.y<1.03);
    for(const l of lines){l.y+=l.v*dt;const yy=l.y*H;let xx=0;
      while(xx<W){const seg=W*(.03+Math.random()*.22),gap=W*Math.random()*.06;x.fillStyle=`rgba(${Math.random()<.5?255:220},255,${Math.random()<.5?255:225},${l.a*(.4+Math.random()*.6)})`;x.fillRect(xx,yy,seg,l.h*(W/900+.6));xx+=seg+gap}
      x.fillStyle=`rgba(0,0,0,${l.a*.6})`;x.fillRect(0,yy+l.h*2,W,1)}
    // occasional full-screen flicker
    if(Math.random()<.03){x.fillStyle='rgba(255,255,255,.015)';x.fillRect(0,0,W,H)}
    x.imageSmoothingEnabled=true;
  }
  requestAnimationFrame(frame);
})();

/* ---------- timer editing right on the display: click, the dashes flash, type the finish time ---------- */
TV.tEdit=null;
const tIn=document.createElement('input');
Object.assign(tIn,{id:'timer-in',type:'text',inputMode:'numeric',autocomplete:'off',className:'timer-in',maxLength:4});
tIn.setAttribute('aria-label','Finish time: type hours then minutes, like 430 for 4:30, then press Enter');
$('tv-timer').parentElement.appendChild(tIn);
function drawTimerEdit(){
  const pad=('----'+TV.tEdit).slice(-4),s=pad.slice(0,2)+':'+pad.slice(2);
  const blink=[0,1,3,4].filter((ci,j)=>pad[j]==='-');
  const t=$('tv-timer');t.classList.remove('live');t.classList.add('editing');t.dataset.k='';
  t.innerHTML=segSvg(s,blink)+`<span class="cap">Type Finish Time</span>`;
}
function timerEditStart(){if(!current)return;TV.tEdit='';tIn.value='';tIn.focus({preventScroll:true});drawTimerEdit()}
function timerEditEnd(){TV.tEdit=null;$('tv-timer').classList.remove('editing');$('tv-timer').dataset.k='';if(document.activeElement===tIn)tIn.blur();renderClock()}
function timerBad(){TV.tEdit='';tIn.value='';drawTimerEdit();const t=$('tv-timer');t.classList.remove('bad');void t.offsetWidth;t.classList.add('bad')}
/* a 3-digit time that no 4th digit could turn into a valid time (e.g. 4:30) is accepted right away */
function timerFinal3(d){if(d.length!==3)return false;const h=+d[0],mm=+d.slice(1);if(h<1||mm>59)return false;
  const could4=d[0]==='1'&&'012'.includes(d[1])&&+d[2]<=5;return !could4}
function timerCommit(){
  const b=TV.tEdit;if(b==null)return;
  if(!b){if(current.endAt){current.endAt=null;saveState();toast('Timer cleared')}timerEditEnd();return}
  if(b.length<3){timerBad();return}
  const hh=+b.slice(0,-2),mm=+b.slice(-2);
  if(hh<1||hh>12||mm>59){timerBad();return}
  const end=finishFrom(hh,mm);current.endAt=new Date(end).toISOString();current.tbStarted=null;saveState();timerEditEnd();
  toast(`Session ends in ${fmtMin(Math.ceil((end-Date.now())/60000))}`);
}
tIn.addEventListener('input',()=>{if(TV.tEdit==null)return;const d=tIn.value.replace(/\D/g,'').slice(-4);tIn.value=d;TV.tEdit=d;drawTimerEdit();if(d.length===4||timerFinal3(d))timerCommit()});
tIn.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();timerCommit()}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();timerEditEnd()}});
tIn.addEventListener('blur',()=>{if(TV.tEdit==null)return;if(TV.tEdit.length>=3)timerCommit();else timerEditEnd()});
$('tv-timer').addEventListener('mousedown',e=>{if(TV.tEdit!=null)e.preventDefault()});
$('tv-timer').onclick=e=>{e.stopPropagation();if(TV.tEdit!=null){timerEditEnd();if(!wrapping)startTeachBack();return}
  if($('tv-timer').classList.contains('expired')){$('tv-timer').classList.remove('expired');startTeachBack();return}
  timerEditStart()};
