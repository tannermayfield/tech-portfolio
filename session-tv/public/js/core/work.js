/* ---------- the work screen: session time, the chat header and the AI coach chat ---------- */
function accumulate(){
  if(!current)return;const now=Date.now();
  if(current.active&&current.activeSince){const d=Math.min(now-current.activeSince,150*60000);current.timeOn[current.active]=(current.timeOn[current.active]||0)+Math.max(0,d)}
  current.activeSince=now;
}
const isDoneNow=t=>t&&(isSkill(t)?(current.practiced||[]).includes(t.id):t.status==='done');
function firstOpenIn(mood,skip){return candidates(mood).find(t=>t.id!==skip&&!isDoneNow(t))?.id||null}
function spentInType(k){
  let ms=0;for(const id in current.timeOn){const t=T(id);if(t&&typeOf(t)===k)ms+=current.timeOn[id]}
  const a=T(current.active);if(a&&typeOf(a)===k&&current.activeSince)ms+=Math.min(Date.now()-current.activeSince,150*60000);
  return ms/60000;
}

/* ---------- session actions ---------- */
let stateQ=Promise.resolve();
function saveState(){if(!db||!current)return;const snap=JSON.parse(JSON.stringify(current));stateQ=stateQ.then(()=>db.doc('state/current').set(snap)).catch(()=>toast('Couldn\'t save the session. Check your connection.'))}
const playlistUrl=m=>settings[m+'Url']||(m==='class'?settings.grindUrl:m==='project'?settings.creativeUrl:'')||'';

// keep the skill's conversation (including the teach-back) with the session; it's saved to the learning log at the end
function saveSkillChat(id){
  const turns=(coachTurns[id]||[]).slice(-30).map(x=>({role:x.role,content:String(x.show||x.content).slice(0,1500)}));
  if(!turns.length)return;current.skillChats=Object.assign({},current.skillChats,{[id]:{title:T(id)?.title||'',main:mainSkillName(T(id))||null,turns,at:new Date().toISOString()}});saveState();
}

/* ---------- coach ---------- */
// one chat per project: every task in a project shares the project's conversation
const chatKey=t=>t?(typeOf(t)==='project'?'proj:'+(t.course||'Other'):t.id):null;
const CLAUDE_MARK='<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="#D97757" d="M12 2l1.6 6.2L20 6.6l-4.6 4.6L22 12l-6.6.8 4.6 4.6-6.4-1.6L12 22l-1.6-6.2L4 17.4l4.6-4.6L2 12l6.6-.8L4 6.6l6.4 1.6z"/></svg>';
function renderCoachLog(){return SessionTV.hooks.run('coach:render',arguments,()=>{
  const t=T(current?.active),turns=coachTurns[chatKey(t)]||[];
  const intro=t&&typeOf(t)==='project'?projectIntro(t):t?`<div class="msg ai intro"><div class="ai-name">${CLAUDE_MARK} AI coach</div>${t.goal&&typeOf(t)!=='class'?`Goal: <b>${esc(t.goal)}</b>.<br><br>`:''}${esc(ruleOf(t))}${sample?' Ask for a hint, a practice problem, or explain your thinking and I\'ll push back.':'<br><br><span class="muted">AI coaching is optional. See Settings → AI Connections for connection status.</span>'}</div>`:'';
  $('coach-log').innerHTML=intro+turns.map(x=>x.role==='user'?`<div class="msg me">${fmtMsg(x.show||x.content,false)}</div>`:`<div class="msg ai"><div class="ai-name">${CLAUDE_MARK} AI coach</div>${fmtMsg(x.content,true)}${x.lines&&x.lines.length?`<br><button type="button" class="flag-chip" data-flags="${x.lines.join(',')}">Marked line${x.lines.length>1?'s':''} ${fmtLines(x.lines)} in your editor</button>`:''}</div>`).join('');
  $('coach-log').querySelectorAll('[data-usecode]').forEach(b=>b.onclick=()=>{if(!WS.ed)return;WS.ed.set(b.nextElementSibling.textContent);wsSave();WS.ed.focus()});
  $('coach-log').querySelectorAll('[data-flags]').forEach(b=>b.onclick=()=>{if(WS.ed)wsFlag(b.dataset.flags.split(',').map(Number))});
  $('coach-log').scrollTop=$('coach-log').scrollHeight;
  if(t&&typeOf(t)==='project'&&projMode(t)==='work')ppRender(t); // re-render the project panel when a reply finishes
})}
// plain text with fenced code blocks; AI coach's code blocks get a "Put in editor" button when the editor is open.
// Project plan mode: ADD_TASK / EDIT_TASK lines become buttons under the reply.
function fmtMsg(text,ai){
  // retired project markup: <teach> tags show inline, sprint commands are dropped
  text=String(text).replace(/<\/?teach>/gi,'').replace(/^[ \t]*(SPRINT_GOAL|SPRINT_ADD):.*$/gim,'');
  if(!ai)return esc(text);
  const acts=[];
  text=text.replace(/^[ \t]*(ADD_TASK|EDIT_TASK):[ \t]*(.+)$/gim,(m,k,rest)=>{acts.push([k.toUpperCase(),rest.split('|').map(x=>x.trim())]);return ''}).replace(/\n{3,}/g,'\n\n').trim();
  const markdown=text.replace(/([.!?])(?=#{1,6}\s)/g,'$1\n\n');
  let html=DOMPurify.sanitize(marked.parse(markdown,{gfm:true,breaks:true}),{
    ALLOWED_TAGS:['p','br','strong','em','del','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote','pre','code','table','thead','tbody','tr','th','td','a','hr'],
    ALLOWED_ATTR:['href','title','class','align','start']
  });
  html=html.replace(/<table>/g,'<div class="markdown-table"><table>').replace(/<\/table>/g,'</table></div>');
  html=html.replace(/<pre>/g,(ai&&WS.ed?'<button type="button" class="use-code" data-usecode>Put in editor ↗</button>':'')+'<pre class="code">');
  return '<div class="markdown-body">'+html+'</div>'+projectActions(acts);
}

async function sendCoach(text,show){return SessionTV.hooks.run('coach:send',arguments,async(text,show)=>{
  text=(text||'').trim();const t=T(current?.active);if(!text||!sample||!t)return;
  coachCtl?.abort();const ctl=coachCtl=new AbortController();
  const ck=chatKey(t),turns=coachTurns[ck]=coachTurns[ck]||[];
  turns.push(show?{role:'user',content:text,show}:{role:'user',content:text});if(!show){$('coach-input').value='';$('coach-input').style.height='auto'}renderCoachLog();
  const wrapEl=document.createElement('div');wrapEl.className='msg ai';wrapEl.innerHTML=`<div class="ai-name">${CLAUDE_MARK} AI coach</div><span></span>`;const el=wrapEl.lastChild;el.textContent='Thinking…';$('coach-log').appendChild(wrapEl);$('coach-send').disabled=true;
  const type=typeOf(t),wrapUp=type==='skill'&&current.wrapUp?.[t.id];
  // every line about the learner comes from the coach profile (name, school, goal, focus and pronouns)
  const profile=coachProfile();
  const rules=`You are a tutor for ${coachLearner(profile)}${profile.focus?` (${profile.focus})`:''}. ${coachSay`He learns best by explaining things back.`} ${type==='project'?coachVoice(COACH_RULES['proj_'+projMode(t)]):COACH_RULES[isPipe(t)?'pipeline':type]}${type==='project'?coachVoice(projectCtx(t)):`\nCurrent item (${TYPES[type].label}): ${t.title}${t.course?` (${t.course})`:''}`}${type==='skill'?coachSay`\nHis self-rated stage on this skill: ${LVL_NAMES[skillLevel(t)]} (stages: New, Learned, Experienced, Mastered).`:''}${t.goal&&type!=='project'?coachSay`\nGoal: he should be able to explain ${t.goal}`:''}${coachSay`\n\nKeep replies under 200 words unless a problem needs a schema. Plain text, no markdown headings. End with a question that makes him think when it fits.`}${wsRulesFor(t)}${wrapUp?coachSay`\n\nTEACH-BACK MODE: He clicked Wrap Up for this skill. Stop teaching, quizzing and giving new problems. Ask him to teach you the skill in his own words, as if explaining it to an interviewer: what it is, when to use it, a concrete example (ideally from what he did today), and a common mistake. Then respond to his explanation: say what he got right, name any gaps or errors in one or two sentences, and ask him to fill just those gaps. Keep it to a short back-and-forth, and when his explanation is solid, tell him he can click Next Skill.`:''}`;
  try{
    const {text:out}=await sample([{role:'user',content:rules},...turns.slice(-12).map(x=>({role:x.role,content:x.content}))],{cache:false,signal:ctl.signal,onText:({text})=>{el.textContent=text.replace(/\n?\s*LINES:[^\n]*$/i,'');$('coach-log').scrollTop=$('coach-log').scrollHeight}});
    const lm=out.match(/\n?\s*LINES:\s*([^\n]*)\s*$/i),lines=lm?parseLines(lm[1]):[];
    turns.push({role:'assistant',content:lm?out.slice(0,lm.index).trim():out,lines});
    if(lines.length&&WS.ed&&WS.id===t.id)wsFlag(lines);
    renderCoachLog();
  }catch(e){
    if(e.code==='cancelled'){el.textContent=e.text||'(stopped)'}
    else if(['not_granted','sampling_disabled','not_declared','capability_disabled','capability_removed'].includes(e.code)){el.textContent='AI coach isn\'t available on this board right now.'}
    else{el.textContent=(e.text?e.text+'\n\n':'')+(e.code==='rate_limited'?'Too many requests. Wait a bit and try again.':'That didn\'t go through. Try again.');turns.pop()}
  }finally{$('coach-send').disabled=false}
})}
$('coach-form').onsubmit=e=>{e.preventDefault();sendCoach($('coach-input').value)};
$('coach-input').addEventListener('input',e=>{const t=e.target;t.style.height='auto';t.style.height=Math.min(160,t.scrollHeight)+'px'});
$('coach-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendCoach($('coach-input').value)}});

function renderWork(){return SessionTV.hooks.run('work:render',arguments,()=>{
  if(!current){$('tv-osd').innerHTML='<span class="ch">CH --</span><span>WARMING UP…</span>';return}
  document.body.dataset.mood='tv';
  renderPanel();renderOSD();renderSong();
  $('work-main').hidden=wrapping;$('wrapup').hidden=!wrapping;
  if(TV.mode==='guide')renderGuide();
  if(wrapping){wsMount(null);renderWrap();renderClock();return}
  const t=T(current.active),f=$('focus');
  wsMount(t&&typeOf(t)==='skill'?t:null);ppMount(t);ppNoSignal(!t);
  if(!t){f.innerHTML=`<div class="signal-lost" role="status"><div class="signal-bars" aria-hidden="true"></div><h2>Signal lost</h2><p>Choose a channel from Menu</p></div>`;$('coach-log').innerHTML='';$('coach-quick').innerHTML='';$('coach-form').hidden=true;renderClock();return}
  const type=typeOf(t),doneNow=isDoneNow(t);
  const doneBtn=doneNow?(isSkill(t)?`<span class="small" style="color:var(--ok)">Practiced ✓</span>`:`<button class="btn" id="undo-done">Mark not done</button>`)
    :isSkill(t)?(current.wrapUp?.[t.id]?`<button class="btn primary" id="done-btn" title="Save this conversation and move to the next skill">Next Skill</button>`:`<button class="btn primary" id="wrapup-btn" title="Stop practicing and teach back what you know">Wrap Up</button>`)
    :`<button class="btn primary" id="done-btn" title="Mark this assignment done and go back to the channel menu">Done</button>`;
  const head=type==='project'?(t.course||'Project'):t.title;
  f.innerHTML=`<div class="chat-title"><h2 title="${esc(head)}">${esc(head)}</h2></div>
    <div class="row chat-actions">${type==='skill'?`<span class="lvl-wrap">${lvlCtl(t)}</span>`:''}${type==='class'?`<button class="btn ghost" id="info-btn" title="Assignment details">Details</button>`:''}${type==='project'?projModeSeg(t):doneBtn}</div>`;
  if($('done-btn'))$('done-btn').onclick=()=>{if(isSkill(t)){saveSkillChat(t.id);markDone(t.id)}else doneToMenu(t.id)};
  if($('wrapup-btn'))$('wrapup-btn').onclick=()=>{current.wrapUp=Object.assign({},current.wrapUp,{[t.id]:true});saveState();renderWork();
    sendCoach('I\'m ready to wrap up this skill. Stop teaching and quizzing me, and ask me to teach it back to you.','Wrap up: I\'ll teach it back.')};
  if($('undo-done'))$('undo-done').onclick=()=>guard(()=>db.doc('tasks/'+t.id).update({status:'todo',doneAt:null}));
  if($('info-btn'))$('info-btn').onclick=()=>openTask(t.id);
  bindRows(f);
  $('coach-wrap').hidden=false;$('coach-form').hidden=!sample;$('coach-quick').innerHTML='';
  renderCoachLog();renderClock();
})}

/* "Signal Lost" test card when nothing is tuned in */
function noSigSVG(){
  const ray=(cx,cy,r0,r1,ang,n,spread,w)=>{let d='';for(let i=0;i<n;i++){const a=(ang+(i-(n-1)/2)*spread)*Math.PI/180;d+=`M${(cx+Math.cos(a)*r0).toFixed(1)} ${(cy+Math.sin(a)*r0).toFixed(1)}L${(cx+Math.cos(a)*r1).toFixed(1)} ${(cy+Math.sin(a)*r1).toFixed(1)}`}return `<path d="${d}" stroke-width="${w}"/>`};
  const dial=(cx,cy,R,w)=>{const s=R/360;let g=`<circle cx="${cx}" cy="${cy}" r="${R}" stroke-width="${w*1.4}" fill="var(--ns-paper)"/>`;
    for(const a of [0,90,180,270])g+=ray(cx,cy,R*.24,R*.94,a,11,1.5,w*.9);
    for(const r of [.2,.17,.14,.11])g+=`<circle cx="${cx}" cy="${cy}" r="${R*r}" stroke-width="${w}" fill="${r===.2?'var(--ns-paper)':'none'}"/>`;
    for(const [r,a0] of [[.55,20],[.68,24],[.8,28]])for(const q of [0,90,180,270]){const a1=(q+a0)*Math.PI/180,a2=(q+90-a0)*Math.PI/180;
      g+=`<path d="M${cx+Math.cos(a1)*R*r} ${cy+Math.sin(a1)*R*r}A${R*r} ${R*r} 0 0 1 ${cx+Math.cos(a2)*R*r} ${cy+Math.sin(a2)*R*r}" stroke-width="${w*.8}" stroke-dasharray="${18*s} ${14*s}" fill="none"/>`}
    g+=`<path d="M${cx-R*.7} ${cy-R*.7}L${cx+R*.7} ${cy+R*.7}M${cx+R*.7} ${cy-R*.7}L${cx-R*.7} ${cy+R*.7}" stroke-width="${w*.6}" opacity=".7"/>`;return g};
  let grid='';for(let x=0;x<=1600;x+=100)grid+=`M${x} 0V1000`;for(let y=0;y<=1000;y+=100)grid+=`M0 ${y}H1600`;
  const sq=[[0,300],[100,200],[300,200],[700,0],[1100,0],[1200,200],[1300,400],[0,500],[500,600],[1100,700],[1400,500],[200,900],[900,800],[1500,300],[600,100],[1300,900],[400,900]].map(([x,y])=>`<rect x="${x}" y="${y}" width="100" height="100"/>`).join('');
  const txt=(y,t,size)=>`<text x="800" y="${y}" text-anchor="middle" font-size="${size}" class="ns-t">${t}</text>`;
  return `<svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><filter id="ns-grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .3  0 0 0 0 .25  0 0 0 .55 0"/></filter></defs>
    <rect width="1600" height="1000" fill="var(--ns-paper)"/>
    <g fill="var(--ns-ink)" opacity=".13">${sq}</g>
    <path d="${grid}" stroke="var(--ns-ink)" stroke-width="2" opacity=".18"/>
    <g stroke="var(--ns-ink)" fill="none">${dial(800,500,380,4)}${dial(190,190,125,3)}${dial(1410,190,125,3)}${dial(190,810,125,3)}${dial(1410,810,125,3)}</g>
    ${txt(250,'SIGNAL LOST',128)}${txt(845,'PLEASE OPEN THE MENU',74)}
    <rect width="1600" height="1000" filter="url(#ns-grain)" opacity=".5"/>
  </svg>`;
}
function ppNoSignal(on){
  let el=$('nosig');
  if(!on){if(el)el.hidden=true;$('work-main').classList.remove('nosig-on');return}
  if(!el){el=document.createElement('button');el.type='button';el.id='nosig';el.className='nosig';el.setAttribute('aria-label','Signal lost. Please open the menu');el.innerHTML=noSigSVG();el.onclick=()=>openGuide();$('work-main').appendChild(el)}
  el.hidden=false;$('work-main').classList.add('nosig-on');
}
