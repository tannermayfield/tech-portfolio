/* ---------- wrap up: the teach-back after a session, then save it to the learning log ---------- */
function touched(){
  if(!current)return [];const start=new Date(current.startedAt).getTime();
  return tasks.filter(t=>(current.timeOn[t.id]||0)>=60000||(current.practiced||[]).includes(t.id)||(t.status==='done'&&t.doneAt&&new Date(t.doneAt).getTime()>=start)).sort((x,y)=>CATS.indexOf(typeOf(x))-CATS.indexOf(typeOf(y)));
}
/* skills to teach back: only main skills (SQL, AWS…), each checked once in a short chat with AI coach */
let wrapCtl=null,extracting=false,wrapBusy=false;
function wrapState(){
  const list=touched();current.wrap=current.wrap||{};const W=current.wrap;
  if(W.v!==2){W.v=2;W.ms={};W.sel=null;W.extracted=false}
  list.forEach(t=>{const n=mainSkillName(t);if(n){const m=W.ms[n]||(W.ms[n]={s:'todo',turns:[],from:[]});if(!m.from.includes(t.id))m.from.push(t.id)}});
  if(!W.sel||!W.ms[W.sel])W.sel=Object.keys(W.ms)[0]||null;
  return W;
}
async function extractSkills(){
  const W=current.wrap,list=touched().filter(t=>!isSkill(t)),names=tasks.filter(isSkill).map(t=>t.title);
  if(W.extracted||extracting)return;if(!sample||!list.length||!names.length){W.extracted=true;return}
  extracting=true;renderWrap();
  const learner=coachProfile().name||'Learner';
  const lines=list.map(t=>{const turns=(coachTurns[chatKey(t)]||current.skillChats?.[t.id]?.turns||[]).slice(-6).map(x=>`${x.role==='user'?learner:'AI coach'}: ${x.content.slice(0,300)}`).join('\n');
    return `id ${t.id} | ${TYPES[typeOf(t)].label} | ${t.title}${t.course?` | ${t.course}`:''}${t.goal&&typeOf(t)!=='class'?` | goal: ${t.goal}`:''}${turns?`\nChat during the session:\n${turns}`:''}`}).join('\n\n');
  const prompt=coachSay`${learner} just finished a work session. His skill list is exactly: ${names.map(n=>`"${n}"`).join(', ')}.\nFor each item below, pick which of those skills he actually used or practiced in it (0 to 3, only names from the list, spelled exactly). Pick none if no skill on the list really applies.\n\n${lines}\n\nReply with only a JSON object mapping each id to an array of skill names.`;
  try{
    const {text}=await sample(prompt,{cache:true});
    const obj=JSON.parse(text.slice(text.indexOf('{'),text.lastIndexOf('}')+1));
    for(const id in obj){if(!Array.isArray(obj[id]))continue;
      obj[id].map(String).filter(n=>names.includes(n)).slice(0,3).forEach(n=>{const m=W.ms[n]||(W.ms[n]={s:'todo',turns:[],from:[]});if(!m.from.includes(id))m.from.push(id)})}
    W.extracted=true;if(!W.sel)W.sel=Object.keys(W.ms)[0]||null;saveState();
  }catch(e){W.extracted=e.code!=='rate_limited'&&e.code!=='network'?true:false}
  finally{extracting=false;renderWrap()}
}
function renderWrap(){
  const list=touched(),W=wrapState(),names=Object.keys(W.ms);
  const nSk=k=>names.filter(n=>W.ms[n].from.some(id=>{const t=T(id);return t&&typeOf(t)===k})).length;
  $('wrap-summary').innerHTML=`<div class="wrap-tot">${CATS.map(k=>{const n=nSk(k);return `<div><span>${MOODS[k].label}</span><b>${fmtMin(spentInType(k))}</b><small class="wt-sk">${n} skill${n===1?'':'s'}</small></div>`}).join('')}</div>`+
    (extracting?`<div class="wrap-prog" style="margin-top:12px">Finding the skills you used…</div>`:'')+
    (names.length?`<div class="wrap-skills">`+names.map(n=>{const m=W.ms[n],from=m.from.map(id=>T(id)).filter(t=>t&&!(isSkill(t)&&mainSkillName(t)===n&&t.title===n)).map(t=>t.title);
      const mins=m.from.reduce((s,id)=>s+(current.timeOn[id]||0),0)/60000;
      return `<button class="skill-btn" data-n="${esc(n)}" data-s="${m.s}" aria-current="${W.sel===n}"><span class="sk-dot" aria-hidden="true">${m.s==='solid'?'✓':m.s==='review'?'↺':''}</span><span class="sk-txt"><b>${esc(n)}</b>${from.length?`<small>${esc(from.join(' · '))}</small>`:''}</span><span class="wt-m">${mins>=1?fmtMin(mins):''}</span></button>`}).join('')+`</div>`
    :(list.length&&!extracting?'<p class="muted" style="margin:12px 0 0">No skills from your list came up this session.</p>':!list.length?'<p class="muted" style="margin:12px 0 0">Nothing logged yet.</p>':''));
  $('wrap-summary').querySelectorAll('.skill-btn').forEach(b=>b.onclick=()=>{W.sel=b.dataset.n;saveState();renderWrap()});
  $('conf').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.c===confidence)));
  renderWrapChat();
  if(!W.extracted&&!extracting)extractSkills();
}
function curSkill(){const W=current?.wrap;if(!W||!W.sel||!W.ms?.[W.sel])return {};return {n:W.sel,sk:W.ms[W.sel],from:W.ms[W.sel].from.map(id=>T(id)).filter(Boolean)}}
function nextSkill(){
  const W=current.wrap,names=Object.keys(W.ms||{}),at=names.indexOf(W.sel);
  return [...names.slice(at+1),...names.slice(0,Math.max(0,at))].find(n=>W.ms[n].s==='todo')||null;
}
let wrapRenderedKey='';
function renderWrapChat(){
  const {n,sk,from}=curSkill();
  $('wc-acts-slot').innerHTML='';$('wc-head').hidden=!sk;
  if(!sk){$('wc-head').innerHTML='';$('wc-log').innerHTML=extracting?`<div class="msg ai"><div class="ai-name">${CLAUDE_MARK} AI coach</div>Looking through what you worked on to find the skills you used…</div>`:'<div class="msg ai intro muted">Nothing to check from this session. You can still save it to your log.</div>';$('wc-form').hidden=true;return}
  $('wc-form').hidden=false;
  if(!wrapBusy)$('wc-send').disabled=false;
  const key=n+':'+sk.turns.length;
  if(wrapBusy&&key===wrapRenderedKey)return;
  wrapRenderedKey=key;
  const used=from.filter(t=>t.title!==n).map(t=>t.title);
  const intro=sample?'':`<div class="msg ai intro"><div class="ai-name">${CLAUDE_MARK} AI coach</div>Explain what you did with <b>${esc(n)}</b> this session${used.length?` (${esc(used.join(', '))})`:''}, the way you would to an interviewer: what you used, why, and what you'd do differently.<br><br><span class="muted">AI coaching is optional. See Settings → AI Connections for connection status. What you write is still saved with this session.</span></div>`;
  $('wc-log').innerHTML=intro+sk.turns.map(x=>x.role==='user'?`<div class="msg me">${esc(x.content)}</div>`:`<div class="msg ai"><div class="ai-name">${CLAUDE_MARK} AI coach</div>${esc(x.content)}</div>`).join('');
  $('wc-log').scrollTop=$('wc-log').scrollHeight;
  if(sample&&!sk.turns.length&&!wrapBusy)askSkill('');
}
async function askSkill(text){
  const {n,sk,from}=curSkill();if(!sk)return;text=(text||'').trim();
  if(text){sk.turns.push({role:'user',content:text});$('wc-input').value='';$('wc-input').style.height='auto';saveState()}
  if(!sample){renderWrapChat();return}
  wrapCtl?.abort();const ctl=wrapCtl=new AbortController();
  wrapBusy=true;wrapRenderedKey='';renderWrapChat();
  const el=document.createElement('div');el.className='msg ai';el.innerHTML=`<div class="ai-name">${CLAUDE_MARK} AI coach</div><span>Thinking…</span>`;$('wc-log').appendChild(el);const span=el.lastChild;$('wc-send').disabled=true;
  const answers=sk.turns.filter(x=>x.role==='user').length;
  const profile=coachProfile(),learner=profile.name||'Learner';
  const work=from.map(t=>{const turns=(coachTurns[chatKey(t)]||current.skillChats?.[t.id]?.turns||[]).slice(-6).map(x=>`  ${x.role==='user'?learner:'AI coach'}: ${String(x.show||x.content).slice(0,240)}`).join('\n');return `- ${t.title} (${TYPES[typeOf(t)].label}${t.course?`, ${t.course}`:''})${turns?`\n${turns}`:''}`}).join('\n');
  const rules=coachSay`You are checking whether ${coachLearner(profile)}, can teach back one skill from the work session he just finished. He learns by explaining things back.\nSkill: ${n}\nWhere he used it this session:\n${work||'- (no details)'}\n\nKeep it a quick conversation: no more than 3 questions in total. Start by asking him to explain what he did with ${n} this session in his own words, tied to the concrete work above. After each answer, say briefly what was right, correct anything wrong or vague directly, then ask one sharper follow-up like an interviewer would, about a specific concept within ${n} that came up. Once he has shown he understands it, or after his third answer, finish with a one-sentence takeaway and put exactly "VERDICT: solid" or "VERDICT: review" on the last line. Never answer your own question for him. Plain text, under 90 words per reply.${answers>=3?coachSay`\n\nHe has answered three times. Wrap up now with the takeaway and the verdict line.`:''}`;
  try{
    const {text:out}=await sample([{role:'user',content:rules},...sk.turns.slice(-10)],{cache:false,signal:ctl.signal,onText:({text})=>{span.textContent=text.replace(/\n?\s*VERDICT:\s*\w*\s*$/i,'');$('wc-log').scrollTop=$('wc-log').scrollHeight}});
    const m=out.match(/VERDICT:\s*(solid|review)/i);
    sk.turns.push({role:'assistant',content:out.replace(/\n?\s*VERDICT:\s*\w+\s*$/i,'').trim()});
    if(m&&sk.s==='todo')sk.s=m[1].toLowerCase();
    saveState();
  }catch(e){
    if(e.code==='cancelled')return;
    span.textContent=['not_granted','sampling_disabled','not_declared','capability_disabled','capability_removed'].includes(e.code)?'AI coach isn\'t available on this board right now.':e.code==='rate_limited'?'Too many requests. Wait a bit and try again.':'That didn\'t go through. Try again.';
    if(text)sk.turns.pop();
  }finally{if(wrapCtl===ctl){wrapBusy=false;$('wc-send').disabled=false;wrapRenderedKey='';renderWrap()}}
}
$('wc-form').onsubmit=e=>{e.preventDefault();askSkill($('wc-input').value)};
$('wc-input').addEventListener('input',e=>{const t=e.target;t.style.height='auto';t.style.height=Math.min(140,t.scrollHeight)+'px'});
$('wc-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();askSkill($('wc-input').value)}});
function wrapRecap(){
  const W=current?.wrap;if(!W||!W.ms)return {recap:'',feedback:'',skills:[]};
  const rows=Object.keys(W.ms).map(n=>{const m=W.ms[n];return {n,s:m.s,turns:m.turns,from:m.from.map(id=>T(id)?.title).filter(x=>x&&x!==n)}});
  const lab={solid:'solid',review:'review later',todo:'not checked'};
  return {skills:rows.map(r=>({skill:r.n,status:r.s,from:r.from,said:r.turns.filter(x=>x.role==='user').map(x=>x.content),turns:r.turns})),
    recap:rows.map(r=>{const mine=r.turns.filter(x=>x.role==='user').map(x=>'  '+x.content).join('\n');return `${r.n} (${lab[r.s]})${r.from.length?`, from ${r.from.join(', ')}`:''}${mine?'\n'+mine:''}`}).join('\n\n'),
    feedback:rows.filter(r=>r.turns.length).map(r=>`${r.n}\n`+r.turns.map(x=>`${x.role==='user'?'You':'AI coach'}: ${x.content}`).join('\n')).join('\n\n')};
}
$('back-to-work').onclick=()=>{wrapCtl?.abort();wrapBusy=false;current.activeSince=Date.now();current.tbStarted=null;wrapping=false;saveState();renderWork()};
$('conf').querySelectorAll('button').forEach(b=>b.onclick=()=>{confidence=+b.dataset.c;renderWrap()});
$('finish-btn').onclick=async()=>{
  if(!current)return;
  const list=touched(),byTrack={class:0,skill:0,project:0};
  const rc=wrapRecap();
  let total=0;for(const id in current.timeOn){const t=T(id);const m=current.timeOn[id]/60000;total+=m;if(t)byTrack[typeOf(t)]+=m}
  for(const k in byTrack)byTrack[k]=Math.round(byTrack[k]);
  const dom=Object.keys(byTrack).sort((a,b)=>byTrack[b]-byTrack[a])[0];
  await guard(async()=>{
    const live=touched().filter(t=>isSkill(t)&&coachTurns[t.id]?.length&&!current.skillChats?.[t.id]);live.forEach(t=>saveSkillChat(t.id));
    await db.collection('sessions').add({date:new Date().toISOString(),minutes:Math.round(total),byTrack,track:dom,skillChats:current.skillChats||{},
      tasks:list.map(t=>({id:t.id,title:t.title,done:isDoneNow(t)})),projectTime:globalThis.SessionProjectChats?.timeTotals()||{},recap:rc.recap,feedback:rc.feedback,skills:rc.skills,confidence});
    await db.doc('state/current').delete();
  },'Saved to your learning log');
  current=null;wrapping=false;confidence=0;go('work');
};
$('discard-btn').onclick=async e=>{
  $('discard-dlg').showModal();
};
$('dd-cancel').onclick=()=>$('discard-dlg').close();
// Finish: one prompt that says how many skills are still untaught, then save or discard (discard asks again)
$('wrap-finish').onclick=()=>{
  if(!current)return;const W=current.wrap||{},all=Object.values(W.ms||{});
  const left=all.filter(sk=>!(sk.turns||[]).some(x=>x.role==='user')).length,n=all.length,s=k=>k===1?'':'s';
  $('fd-msg').innerHTML=!n?'There were no skills to teach back this session.'
    :left?`You still have <b>${left}</b> of ${n} skill${s(n)} you haven't taught back yet. You can keep going and explain ${left===1?'it':'them'}, or finish now.`
    :`You taught back all ${n} skill${s(n)} from this session.`;
  $('finish-dlg').showModal();
};
$('fd-cancel').onclick=()=>$('finish-dlg').close();
$('fd-save').onclick=()=>{$('finish-dlg').close();$('finish-btn').click()};
$('fd-discard').onclick=()=>{$('finish-dlg').close();$('discard-dlg').showModal()};
$('discard-dlg').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close()});
$('dd-ok').onclick=async()=>{
  $('discard-dlg').close();
  await guard(()=>db.doc('state/current').delete(),'Session discarded');current=null;wrapping=false;go('work');
};

/* ---------- teach back when the session ends ---------- */
async function startTeachBack(){
  if(!current||wrapping)return;closeSheets();stopCut();accumulate();
  current.tbStarted=Date.now();saveState();
  const crt=$('crt');
  if(!reduce()){crt.classList.add('standby');const cv=$('tv-cut'),x=cv.getContext('2d');crt.classList.add('cut');$('cut-ch').textContent='Your session is over';$('cut-name').textContent='Time to teach it back';
    const t0=performance.now();await new Promise(res=>{const f=ts=>{const {W,H}=canvasFit(cv);TB_THEME.draw(x,W,H,(ts-t0)/1000,{});if(ts-t0<3800)requestAnimationFrame(f);else res()};requestAnimationFrame(f)});
    crt.classList.remove('standby','cut')}
  wrapping=true;renderWork();
}
