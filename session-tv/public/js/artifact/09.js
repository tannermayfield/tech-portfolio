/* ---------- project side panel: Plan = sprint, Apply = skills, Work = AI coach's teaching ---------- */
const PROJ={data:{},sub:false};
const pslug=n=>String(n||'project').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'project';
function projData(n){return PROJ.data[pslug(n)]||{}}
(function sub(){if(PROJ.sub)return;if(!db){setTimeout(sub,500);return}PROJ.sub=true;
  try{db.collection('projects').onSnapshot(snap=>{const o={};snap.docs.forEach(d=>o[d.id]=d.data());PROJ.data=o;const t=T(current&&current.active);if(t&&typeOf(t)==='project')renderWork();if(TV.mode==='guide'&&current?.mood==='project')renderGuide();if(TV.mode==='settings'&&TV.dbView==='projects')renderSettings()},()=>{})}catch(e){}})();
async function projSave(n,patch){const id=pslug(n),cur=PROJ.data[id]||{},next=Object.assign({},cur,patch,{name:n});PROJ.data[id]=next;
  const t=T(current&&current.active);if(t)ppRender(t);
  await guard(()=>db.doc('projects/'+id).set(next));}
function sprintOf(n){return projData(n).sprint||null}
function projExtraCtx(t){
  const n=t.course||'Project',m=projMode(t),sp=sprintOf(n);
  let out='';
  if(sp){const items=spItems(sp).map(it=>({t:T(it.id),pts:it.pts})).filter(x=>x.t);out+=`\n${sp.status==='active'?'Current sprint':'Sprint being planned (not started yet)'}${sp.goal?` goal: ${sp.goal}`:' (no goal set yet)'}${sp.end?` · ends ${sp.end}`:''}\nSprint tasks: ${items.map(x=>`${x.t.title}${x.pts?` [${x.pts} pts]`:''}${x.t.status==='done'?' (done)':''}`).join('; ')||'none yet'}`}
  {const mine=sp&&sp.status==='active'?spItems(sp).filter(i=>i.who===(m==='work'?'ai':'me')).map(i=>T(i.id)).filter(x=>x&&x.status!=='done'):[];
   if(m==='apply'&&mine.length)out+=`\nSprint tasks assigned to HIM (he builds these himself, you only hint): ${mine.map(x=>x.title).join('; ')}`;
   if(m==='work'&&mine.length)out+=`\nSprint tasks assigned to YOU (AI coach builds these, teaching as you go): ${mine.map(x=>x.title).join('; ')}. Work on these, starting with the first, unless he asks otherwise. Do not build the tasks assigned to him.`;}
  if(m==='apply'){const f=(current.projApply||{})[n];if(f)out+=`\nHe chose to apply this skill right now: ${f}. Keep him focused on using ${f} in the project.`;else out+='\nHe has not picked a skill to apply yet; you can suggest one from the project skills.'}
  return out;
}
function ppMount(t){
  const on=!!(t&&typeOf(t)==='project'&&!wrapping);
  $('pp').hidden=!on;if(!on){$('pp-detail').hidden=true;$('work-mid').classList.remove('pp-on');return}
  $('work-mid').classList.add('split');$('work-mid').classList.add('pp-on');
  ppRender(t);
}
function ppRender(t){
  if($('pp').hidden)return;const n=t.course||'Project',m=projMode(t);
  $('pp').dataset.mode=m;$('pp-body').classList.remove('pp-fit');const _mid=document.querySelector('#pp .pp-mid'),_st=_mid?_mid.scrollTop:0;
  if(m==='plan')ppSprint(t,n);else if(m==='apply')ppSkills(t,n);else ppTeach(t,n);
  {const m2=document.querySelector('#pp .pp-mid');if(m2&&_st)m2.scrollTop=_st}
  ppSyncHead();
}
// keep the panel header exactly as tall as the chat header beside it
function ppSyncHead(){const f=$('focus'),h=document.querySelector('#pp .pp-head');if(!f||!h||$('pp').hidden)return;h.style.height='';h.style.minHeight='';requestAnimationFrame(()=>{const fh=f.getBoundingClientRect().height,hh=h.getBoundingClientRect().height;const H=Math.max(fh,hh);h.style.height=H+'px';if(hh<fh)return;f.style.minHeight=H+'px'})}
addEventListener('resize',()=>ppSyncHead());
function fmtShort(d){if(!d)return '';const x=parseDay(d);return x.toLocaleDateString(undefined,{month:'short',day:'numeric'})}
function addDays(d,k){const x=d?parseDay(d):new Date();x.setDate(x.getDate()+k);return gdYmd(x)}
function ppSprint(t,n){
  const sp=sprintOf(n),all=projectTasks(n);
  $('pp-title').textContent=sp?`Sprint ${sp.num||1}`:'Sprint';
  if(!sp){$('pp-acts').innerHTML='';$('pp-body').innerHTML=`<div class="pp-empty">No sprint yet. A sprint is a short block of work (1–2 weeks) with one goal and a few tasks that get you there.<br><br><button type="button" class="btn primary" id="pp-start">Start a sprint</button></div>`;
    $('pp-start').onclick=()=>projSave(n,{sprint:{num:1,goal:'',start:gdYmd(new Date()),end:addDays(null,14),items:[]}});return}
  const items=(sp.items||[]).map(id=>T(id)).filter(Boolean),done=items.filter(x=>x.status==='done').length;
  const avail=all.filter(x=>x.status!=='done'&&!(sp.items||[]).includes(x.id));
  $('pp-acts').innerHTML=`<span class="pp-dates">${fmtShort(sp.start)} – ${fmtShort(sp.end)}</span>`;
  $('pp-body').innerHTML=`<div class="pp-lbl">Sprint goal</div>
    <textarea class="pp-goal" id="pp-goal" rows="2" placeholder="What should be true when this sprint ends?">${esc(sp.goal||'')}</textarea>
    <div class="pp-lbl">Sprint tasks <span>${done}/${items.length} done</span></div>
    <div class="pp-prog"><i style="width:${items.length?done/items.length*100:0}%"></i></div>
    <ul class="pp-list">${items.map(x=>`<li class="${x.status==='done'?'done':''}"><label><input type="checkbox" data-spdone="${esc(x.id)}" ${x.status==='done'?'checked':''}><span>${esc(x.title)}</span></label><button type="button" class="pp-x" data-sprm="${esc(x.id)}" title="Remove from sprint" aria-label="Remove from sprint">×</button></li>`).join('')||'<li class="pp-none">No tasks in this sprint yet.</li>'}</ul>
    <div class="pp-add"><select id="pp-pick"><option value="">+ Add a project task…</option>${avail.map(x=>`<option value="${esc(x.id)}">${esc(x.title)}</option>`).join('')}</select></div>
    <div class="pp-add"><input id="pp-new" placeholder="+ New task for this sprint" autocomplete="off"></div>
    <div class="pp-foot"><button type="button" class="btn ghost" id="pp-next">End sprint &amp; start next</button></div>`;
  const save=patch=>projSave(n,{sprint:Object.assign({},sp,patch)});
  $('pp-goal').onchange=e=>save({goal:e.target.value.trim()});
  $('pp-body').querySelectorAll('[data-spdone]').forEach(c=>c.onchange=()=>guard(()=>db.doc('tasks/'+c.dataset.spdone).update(c.checked?{status:'done',doneAt:new Date().toISOString()}:{status:'todo',doneAt:null})));
  $('pp-body').querySelectorAll('[data-sprm]').forEach(b=>b.onclick=()=>save({items:(sp.items||[]).filter(i=>i!==b.dataset.sprm)}));
  $('pp-pick').onchange=e=>{if(e.target.value)save({items:[...(sp.items||[]),e.target.value]})};
  $('pp-new').onkeydown=async e=>{if(e.key!=='Enter')return;const v=e.target.value.trim();if(!v)return;e.target.value='';
    const order=Math.max(0,...tasks.filter(x=>typeOf(x)==='project').map(x=>x.order||0))+1;const doc={track:'project',title:v,course:n,goal:'',status:'todo',order};if(isPipe(doc))doc.phase='Other';
    const id='p'+Date.now().toString(36);await guard(()=>db.doc('tasks/'+id).set(doc));save({items:[...(sp.items||[]),id]})};
  if(!sp.goal&&!items.length){$('pp-next').disabled=true;$('pp-next').title='Set a goal or add tasks first'}
  $('pp-next').onclick=e=>{const b=e.currentTarget;if(!b.dataset.sure){b.dataset.sure='1';b.textContent='Click again to end sprint';setTimeout(()=>{if(b.isConnected){delete b.dataset.sure;b.innerHTML='End sprint &amp; start next'}},3000);return}const left=items.filter(x=>x.status!=='done').map(x=>x.id);projSave(n,{sprint:{num:(sp.num||1)+1,goal:'',start:gdYmd(new Date()),end:addDays(null,14),items:left},past:[...(projData(n).past||[]),Object.assign({},sp,{closed:new Date().toISOString()})]})};
}
function ppSkills(t,n){
  const names=((settings&&settings.projectSkills)||{})[n]||[],focus=(current.projApply||{})[n];
  $('pp-title').textContent='Skills to apply';$('pp-acts').innerHTML='';
  $('pp-body').innerHTML=names.length?`<div class="pp-note">Pick the skill you want to practice on this project. AI coach will keep you on it with hints only.</div><ul class="pp-skills">${names.map(nm=>{const st=mainSkillTask(nm);return `<li><button type="button" class="pp-skill${nm===focus?' on':''}" data-psk="${esc(nm)}"><span>${esc(nm)}</span><small>${st?LVL_TAG(skillLevel(st)):''}${nm===focus?' · CURRENT':''}</small></button></li>`}).join('')}</ul>`
    :`<div class="pp-empty">No skills are listed for this project yet. Tell AI coach which skills it uses, or add them later.</div>`;
  $('pp-body').querySelectorAll('[data-psk]').forEach(b=>b.onclick=()=>ppSkillDetail(t,n,b.dataset.psk));
}
function ppSkillDetail(t,n,nm){
  const st=mainSkillTask(nm),subs=st?archived.filter(a=>a.mainId===st.id):[],focus=(current.projApply||{})[n]===nm;
  const d=$('pp-detail');d.hidden=false;
  d.innerHTML=`<div class="ppd-head"><button type="button" class="btn ghost" id="ppd-back">‹ Back</button><h2>${esc(nm)}</h2>${st?`<span class="ppd-stage">${LVL_TAG(skillLevel(st))}</span>`:''}</div>
    <div class="ppd-body">
      ${st&&st.goal?`<p class="ppd-goal">Goal: be able to explain ${esc(st.goal)}.</p>`:''}
      <p class="ppd-goal">On <b>${esc(n)}</b>, you'll use ${esc(nm)} in the tasks where it fits. Pick it and AI coach will keep you on it with hints only while you build.</p>
      <h3>${subs.length?'What to work on':'Ideas'}</h3>
      <ul class="ppd-subs">${subs.length?subs.sort(byOrder).map(x=>`<li><b>${esc(x.title)}</b>${x.goal?`<span>${esc(x.goal)}</span>`:''}</li>`).join(''):'<li>Ask AI coach in the chat which part of the project uses this skill most, and start there.</li>'}</ul>
    </div>
    <div class="ppd-foot"><button type="button" class="btn primary" id="ppd-use">${focus?'Keep working on this skill':'Apply this skill'}</button></div>`;
  $('ppd-back').onclick=()=>{d.hidden=true};
  $('ppd-use').onclick=()=>{current.projApply=Object.assign({},current.projApply,{[n]:nm});saveState();d.hidden=true;ppRender(t);
    if(!focus&&sample)sendCoach(`I want to apply ${nm} on this project now. Where should I start? Give me a hint, not the answer.`,`Apply: ${nm}`)};
}
function ppTeach(t,n){
  $('pp-title').textContent="AI coach's notes";$('pp-acts').innerHTML='';
  const turns=(coachTurns['proj:'+n]||[]).filter(x=>x.role==='assistant');
  const blocks=[];turns.forEach((x,i)=>{const re=/<teach>([\s\S]*?)<\/teach>/gi;let m;while((m=re.exec(x.content)))blocks.push({i,txt:m[1].trim()})});
  $('pp-body').innerHTML=blocks.length?blocks.slice().reverse().map((b,k)=>`<div class="pp-teach${k===0?' new':''}">${_fmtMsg(b.txt,false)}</div>`).join('')
    :`<div class="pp-empty">As AI coach builds the project on the left, it explains what it's doing and why here. Then it quizzes you in the chat.</div>`;
}
// keep teaching out of the chat column; show a pointer instead
const _fmtMsg2=fmtMsg;
fmtMsg=function(text,ai){
  if(ai&&/<teach>/i.test(String(text))){text=String(text).replace(/\s*<teach>[\s\S]*?(<\/teach>|$)\s*/gi,'\n[[TEACH]]\n')}
  return _fmtMsg2(text,ai).replace(/\[\[TEACH\]\]/g,'<span class="pp-ptr">→ Explained in AI coach\'s notes</span>');
};
// re-render the notes when a reply finishes (cheap: on every chat render)
const _rcl=renderCoachLog;
renderCoachLog=function(){_rcl();const t=T(current&&current.active);if(t&&typeOf(t)==='project'&&projMode(t)==='work')ppRender(t)};
// plan actions: sprint goal / add to sprint
const _fmtMsg3=fmtMsg;
fmtMsg=function(text,ai){
  if(!ai)return _fmtMsg3(text,ai);
  const acts=[];const clean=String(text).replace(/^[ \t]*(SPRINT_GOAL|SPRINT_ADD):[ \t]*(.+)$/gim,(m,k,r)=>{acts.push([k.toUpperCase(),r.trim()]);return ''});
  let html=_fmtMsg3(clean,ai);
  if(acts.length)html+=`<div class="pa-acts">${acts.map(([k,v])=>{const key=k+':'+v,done=TV.pApplied.has(key);const tt=k==='SPRINT_ADD'?T(v):null;
    return `<div class="pa-act"><span><b>${k==='SPRINT_GOAL'?'Sprint goal':'Add to sprint'}:</b> ${esc(k==='SPRINT_ADD'?(tt?tt.title:v):v)}</span><button type="button" class="btn" data-spact="${esc(key)}" ${done||(k==='SPRINT_ADD'&&!tt)?'disabled':''}>${done?'Done ✓':k==='SPRINT_GOAL'?'Set goal':'Add'}</button></div>`}).join('')}</div>`;
  return html;
};
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('[data-spact]');if(!b||b.disabled)return;
  const t=T(current&&current.active);if(!t)return;const n=t.course||'Project',key=b.dataset.spact,i=key.indexOf(':'),k=key.slice(0,i),v=key.slice(i+1);
  const sp=sprintOf(n)||{num:1,status:'draft',step:1,goal:'',start:gdYmd(new Date()),end:'',items:[]};
  if(k==='SPRINT_GOAL')projSave(n,{sprint:Object.assign({},sp,{goal:v})});
  else if(!spItems(sp).some(i=>i.id===v))projSave(n,{sprint:Object.assign({},sp,{items:[...spItems(sp),{id:v,pts:0}]})});
  TV.pApplied.add(key);b.disabled=true;b.textContent='Done ✓';
});
// mode switch re-renders the panel
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('[data-pmode]'))setTimeout(()=>{const t=T(current&&current.active);if(t)ppMount(t)},0)});
