/* ---------- learning log ---------- */
function recentByType(){
  const cut=Date.now()-14*864e5,out={class:0,skill:0,project:0};
  for(const s of sessions){if(new Date(s.date).getTime()<cut)continue;for(const k in (s.byTrack||{})){const c=mapOldCat(k);if(out[c]!=null)out[c]+=s.byTrack[k]}}
  return out;
}
// every time a main skill came up: teach-backs after sessions and practice chats during them
function skillHistory(){
  const H={},add=(n,e)=>{if(!n)return;(H[n]=H[n]||[]).push(e)};
  for(const s of sessions){
    const date=s.date;
    (s.skills||[]).forEach(k=>{
      if(k.said||k.from){add(k.skill,{date,kind:'Teach-back',status:k.status,said:k.said||[],turns:k.turns||[],from:k.from||[]})}
      else{const t=tasks.concat(archived).find(x=>x.title===k.task);const n=mainSkillName(t);if(n)add(n,{date,kind:'Teach-back',status:k.status,said:[],turns:[],from:[k.task],topic:k.skill})}
    });
    for(const id in (s.skillChats||{})){const c=s.skillChats[id];const n=c.main||mainSkillName(T(id));
      add(n,{date:c.at||date,kind:'Practice chat',said:(c.turns||[]).filter(x=>x.role==='user').map(x=>x.content),turns:c.turns||[],from:c.title&&c.title!==n?[c.title]:[]})}
  }
  for(const n in H)H[n].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  return H;
}
function renderLogSkills(){
  const box=$('log-skills');if(!box)return;
  if(!loaded.sessions){box.innerHTML='';return}
  const H=skillHistory(),mains=tasks.filter(isSkill).sort((a,b)=>skillLevel(b)-skillLevel(a)||a.title.localeCompare(b.title));
  const names=[...mains.map(t=>t.title),...Object.keys(H).filter(n=>!mains.some(t=>t.title===n))];
  const lab={solid:'✓ Solid',review:'↺ Review',todo:'Not checked'};
  const fmtD=d=>new Date(d).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  box.innerHTML=`<h2 class="log-h">Skills</h2><div class="ls-list">`+names.map(n=>{const t=mainSkillTask(n),E=H[n]||[];
    return `<details class="ls"><summary><b>${esc(n)}</b><span class="ls-m">${t?`${LVL_TAG(skillLevel(t))} · `:''}${E.length?`${E.length} time${E.length===1?'':'s'} · last ${fmtD(E[0].date)}`:'not talked about yet'}</span></summary>`+
      (E.length?E.map(e=>`<div class="ls-e"><div class="ls-h">${fmtD(e.date)} · ${e.kind}${e.status?` · ${lab[e.status]||e.status}`:''}${e.from.length?` · ${esc(e.from.join(', '))}`:''}</div>${e.topic?`<div class="small muted">${esc(e.topic)}</div>`:''}${e.said.length?e.said.map(x=>`<p class="ls-said">${esc(x)}</p>`).join(''):'<div class="small muted">Nothing written.</div>'}${e.turns.length?`<details class="ls-full"><summary>Full conversation</summary><div class="feedback">${e.turns.map(x=>`${x.role==='user'?'You':'AI coach'}: ${esc(x.content||x.show||'')}`).join('\n\n')}</div></details>`:''}</div>`).join('')
        :'<div class="small muted ls-e">Once you teach this back after a session or practice it in a chat, what you said shows up here.</div>')+`</details>`}).join('')+`</div>`;
}
function renderLog(){
  renderLogSkills();
  const m=recentByType(),tot=Object.values(m).reduce((a,b)=>a+b,0);
  $('bal').innerHTML=CATS.map(k=>{const p=tot?m[k]/tot:0;return `<div style="display:flex;flex-direction:column;gap:4px"><div class="bal-top"><span>${TYPES[k].label}</span><span>${fmtMin(m[k])} · ${Math.round(p*100)}%</span></div><div class="hbar"><i style="width:${Math.min(100,p*100)}%;background:${COLOR[k]}"></i></div></div>`}).join('');
  if(!loaded.sessions){$('log').innerHTML='<div class="muted small">Loading…</div>';return}
  $('log').innerHTML=sessions.length?sessions.map(s=>{
    const d=fmtDay(new Date(s.date));
    const bt={};for(const k in (s.byTrack||{})){const c=mapOldCat(k);bt[c]=(bt[c]||0)+s.byTrack[k]}
    const moods=CATS.filter(k=>bt[k]>0).map(k=>` · ${fmtMin(bt[k])} ${MOODS[k].label.toLowerCase()}`).join('');
    return `<div class="entry"><span class="due">${esc(d)} · ${fmtMin(s.minutes)}${moods}${s.confidence?` · confidence ${s.confidence}/5`:''}</span>
      <div style="font-weight:600">${esc((s.tasks||[]).map(t=>t.title).join(' · ')||'Session')}</div>
      ${s.recap?`<div class="recap-text">${esc(s.recap)}</div>`:'<div class="muted small">No teach-back written.</div>'}
      ${s.feedback?`<details><summary>Skill checks with AI coach</summary><div class="feedback" style="margin-top:6px">${esc(s.feedback)}</div></details>`:''}
      ${s.skillChats&&Object.keys(s.skillChats).length?`<details><summary>Skill practice chats (${Object.keys(s.skillChats).length})</summary>${Object.values(s.skillChats).map(c=>`<div class="feedback" style="margin-top:6px"><b>${esc(c.title)}</b>\n${c.turns.map(x=>`${x.role==='user'?'You':'AI coach'}: ${esc(x.content)}`).join('\n\n')}</div>`).join('')}</details>`:''}</div>`;
  }).join(''):'<p class="muted" style="margin:0">Your first teach-back shows up here after you finish a session.</p>';
}
// clicking outside the log or pressing Escape closes it
$('view-log').addEventListener('click',e=>{if(e.target===$('view-log'))go('work')});
window.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(document.activeElement&&document.activeElement.id==='timer-in')return;if(view==='log')go('work')});
