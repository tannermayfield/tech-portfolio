/* sprint: create in steps (end date → goal → tasks & points → start), then an overview */
const PTS=[1,2,3,5,8,13];
function spItems(sp){return (sp&&sp.items||[]).map(x=>typeof x==='string'?{id:x,pts:0}:x).filter(x=>x&&x.id)}
function ppSprint(t,n){
  const pd=projData(n),sp=pd.sprint,body=$('pp-body');
  const save=patch=>projSave(n,{sprint:Object.assign({},sp,patch)});
  const autoGrow=el=>{el.style.height='auto';el.style.height=el.scrollHeight+'px'};
  if(!sp){$('pp-title').textContent='Sprint';$('pp-acts').innerHTML='';
    body.innerHTML=`<div class="pp-empty">A sprint is a short block of work with one goal and a few tasks that get you there.<br><br><button type="button" class="btn primary" id="pp-create">Create a sprint</button></div>`;
    $('pp-create').onclick=()=>projSave(n,{sprint:{num:(pd.past||[]).length+1,status:'draft',step:1,start:gdYmd(new Date()),end:'',goal:'',items:[]}});return}
  const num=sp.num||1,items=spItems(sp);
  if(sp.status!=='active'){
    const step=[1,2,3,4].includes(sp.step)?sp.step:1,shown=step;
    $('pp-title').textContent=`New Sprint ${num}`;$('pp-acts').innerHTML='';
    const steps=`<div class="pp-steps">${['Time','Goal','Tasks','Assign'].map((l,i)=>`<span class="${i+1===shown?'on':i+1<shown?'done':''}">${i+1}. ${l}</span>`).join('')}</div>`;
    const start=sp.start||gdYmd(new Date());
    if(step===1){
      body.classList.add('pp-fit');body.innerHTML=steps+`<div class="pp-lbl">Pick an end date</div>${ppCal(start,sp.end)}
        <div class="pp-foot"><span class="pp-range">${sp.end?`${fmtShort(start)} – ${start.slice(0,7)===sp.end.slice(0,7)?+sp.end.slice(8):fmtShort(sp.end)} · ${Math.round((parseDay(sp.end)-parseDay(start))/864e5)} days`:'Pick a day'}</span><button type="button" class="btn primary" id="pp-go" ${sp.end?'':'disabled'}>Next</button></div>`;
      body.querySelectorAll('[data-cday]').forEach(b=>b.onclick=()=>save({start,end:b.dataset.cday}));
      body.querySelectorAll('[data-cnav]').forEach(b=>b.onclick=()=>{const m=TV.calM||(sp.end||start).slice(0,7);const d=parseDay(m+'-01');d.setMonth(d.getMonth()+(+b.dataset.cnav));TV.calM=gdYmd(d).slice(0,7);ppRender(t)});
      $('pp-go').onclick=()=>save({step:2});
    }else if(step===2){
      const sugg=isPipe({course:n})?'Raw flight data lands in S3 and is profiled':`Finish the next working piece of ${n}`;
      body.innerHTML=steps+`<div class="pp-lbl">Sprint goal</div><div class="pp-hint">What should be true when this sprint ends? One sentence.</div>
        <textarea class="pp-goal pp-grow" id="pp-goal" rows="1" placeholder="${esc(sugg)}">${esc(sp.goal||'')}</textarea><div class="pp-hint pp-tab" id="pp-tab">Press <kbd>Tab</kbd> to use the suggestion</div>
        <button type="button" class="pp-bl-tog" id="pp-bl-view" aria-haspopup="dialog">View product backlog <span>${projectTasks(n).filter(x=>x.status!=='done').length}</span></button>
        <div class="pp-foot"><button type="button" class="btn ghost" id="pp-back">Back</button><button type="button" class="btn primary" id="pp-go">Next</button></div>`;
      const g=$('pp-goal'),go=$('pp-go');autoGrow(g);
      const ok=()=>{go.disabled=!g.value.trim()};ok();
      const tabHint=()=>{$('pp-tab').hidden=!!g.value};tabHint();
      const quiet=()=>{clearTimeout(TV.goalT);TV.goalT=setTimeout(()=>{const cur=sprintOf(n);if(!cur)return;const id=pslug(n),next=Object.assign({},PROJ.data[id],{sprint:Object.assign({},cur,{goal:g.value.trim()}),name:n});PROJ.data[id]=next;guard(()=>db.doc('projects/'+id).set(next))},500)};
      g.oninput=()=>{autoGrow(g);ok();tabHint();quiet()};
      g.onkeydown=e=>{if(e.key==='Tab'&&!e.shiftKey&&!g.value){e.preventDefault();g.value=sugg;g.dispatchEvent(new Event('input'));g.setSelectionRange(g.value.length,g.value.length);return}if(e.key==='Enter'){e.preventDefault();if(!go.disabled)go.click()}};
      $('pp-bl-view').onclick=()=>ppBacklogOpen(t,n,'manage');
      $('pp-back').onclick=()=>{clearTimeout(TV.goalT);ppBacklogClose();save({goal:g.value.trim(),step:1})};
      go.onclick=()=>{clearTimeout(TV.goalT);ppBacklogClose();save({goal:g.value.trim(),step:3})};
      if(TV.ppBlOpen==='manage')ppBacklogOpen(t,n,'manage');
    }else if(step===4){
      const rows=items.map(it=>({it,x:T(it.id)})).filter(r=>r.x),left=rows.filter(r=>!r.it.who).length;
      const me=rows.filter(r=>r.it.who==='me'),ai=rows.filter(r=>r.it.who==='ai');
      body.innerHTML=steps+`<div class="pp-goalbox"><small>Sprint goal</small>${esc(sp.goal||'')}</div>
        <div class="pp-th"><span>Who does each task?</span><span class="pp-asum">${left?`${left} left`:`${me.length} me · ${ai.length} AI`}</span></div>
        <div class="pp-hint">Me = you build it in <b>Apply</b> with hints only. AI = AI coach builds it in <b>Work</b> and teaches you as it goes.</div>
        <div class="pp-mid"><ol class="pp-tl pp-as">${rows.map(({it,x},k)=>`<li><span class="pp-n2">${k+1}</span><span class="pp-tt">${esc(x.title)}</span>${it.pts?`<span class="pp-ptag">${it.pts}</span>`:''}<span class="pp-who" role="group" aria-label="Assign ${esc(x.title)}"><button type="button" data-who="me" data-wid="${esc(it.id)}" aria-pressed="${it.who==='me'}">Me</button><button type="button" data-who="ai" data-wid="${esc(it.id)}" aria-pressed="${it.who==='ai'}">AI</button></span></li>`).join('')}</ol>
        <div class="pp-allrow"><span>Assign all:</span><button type="button" class="pp-alln" data-all="me">Me</button><button type="button" class="pp-alln" data-all="ai">AI</button></div></div>
        <div class="pp-foot"><button type="button" class="btn ghost" id="pp-back">Back</button><button type="button" class="btn primary" id="pp-go" ${left?'disabled':''}>Start sprint</button></div>`;
      body.querySelectorAll('[data-wid]').forEach(b=>b.onclick=()=>save({items:items.map(i=>i.id===b.dataset.wid?{...i,who:b.dataset.who}:i)}));
      body.querySelectorAll('[data-all]').forEach(b=>b.onclick=()=>save({items:items.map(i=>({...i,who:b.dataset.all}))}));
      $('pp-back').onclick=()=>save({step:3});
      $('pp-go').onclick=()=>save({status:'active',start:gdYmd(new Date()),startedAt:new Date().toISOString()});
    }else{
      const avail=projectTasks(n).filter(x=>x.status!=='done'&&!items.some(i=>i.id===x.id)),tot=items.reduce((a,b)=>a+(b.pts||0),0);
      const pill=(v,id)=>`<button type="button" class="pp-pill${v?'':' empty'}" data-pcyc="${esc(id)}" title="Click to change points">${v?v+' pt'+(v===1?'':'s'):'Set pts'}</button>`;
      body.innerHTML=steps+`<div class="pp-goalbox"><small>Sprint goal</small>${esc(sp.goal||'')}</div>
        <div class="pp-th"><span>Tasks</span><span class="pp-ptw"><button type="button" class="pp-ptbtn" id="pp-ptbtn" aria-haspopup="true" aria-expanded="${TV.ptOpen?'true':'false'}" title="Show point guide">${tot} pts total</button>${TV.ptOpen?ppPtsMenu(items):''}</span></div><div class="pp-mid">
        <ol class="pp-tl">${items.map((it,k)=>{const x=T(it.id);return x?`<li data-iid="${esc(it.id)}"><span class="pp-n" title="Drag to reorder" aria-label="Drag to reorder">${k+1}</span><span class="pp-tt">${esc(x.title)}</span>${pill(it.pts,it.id)}<button type="button" class="pp-x" data-sprm="${esc(it.id)}" aria-label="Remove ${esc(x.title)}">×</button></li>`:''}).join('')}</ol>
        <div class="pp-new"><input id="pp-new" class="pp-in" placeholder="Create a new task" autocomplete="off"></div>
        ${avail.length?`<button type="button" class="pp-bl-tog" id="pp-bl-tog" aria-haspopup="dialog">+ Add from project backlog <span>${avail.length}</span></button>`:''}
</div>
        <div class="pp-foot"><button type="button" class="btn ghost" id="pp-back">Back</button><button type="button" class="btn primary" id="pp-go" ${items.length?'':'disabled'}>Next</button></div>`;
      ppDragInit(body.querySelector('.pp-tl'),order=>save({items:order.map(id=>items.find(i=>i.id===id)).filter(Boolean)}));
      $('pp-ptbtn').onclick=e=>{e.stopPropagation();TV.ptOpen=!TV.ptOpen;ppRender(t)};
      body.querySelectorAll('[data-pcyc]').forEach(b=>b.onclick=()=>{const id=b.dataset.pcyc;save({items:items.map(i=>{if(i.id!==id)return i;const k=PTS.indexOf(i.pts);return {...i,pts:k<0?1:(k===PTS.length-1?0:PTS[k+1])}})})});
      body.querySelectorAll('[data-sprm]').forEach(b=>b.onclick=()=>save({items:items.filter(i=>i.id!==b.dataset.sprm)}));
      if($('pp-bl-tog'))$('pp-bl-tog').onclick=()=>ppBacklogOpen(t,n,'add');
      if(TV.ppBlOpen==='add')ppBacklogOpen(t,n,'add');
      $('pp-new').onkeydown=async e=>{if(e.key!=='Enter')return;const v=e.target.value.trim();if(!v)return;e.target.value='';
        const order=Math.max(0,...tasks.filter(x=>typeOf(x)==='project').map(x=>x.order||0))+1;const doc={track:'project',title:v,course:n,goal:'',status:'todo',order};if(isPipe(doc))doc.phase='Other';
        const id='p'+Date.now().toString(36);await guard(()=>db.doc('tasks/'+id).set(doc));await save({items:[...items,{id,pts:0}]});setTimeout(()=>$('pp-new')&&$('pp-new').focus(),0)};
      $('pp-back').onclick=()=>{ppBacklogClose();save({step:2})};
      $('pp-go').onclick=()=>{ppBacklogClose();TV.ptOpen=false;save({step:4})};
    }
    return;
  }
  // overview of the running sprint
  const rows=items.map(it=>({it,x:T(it.id)})).filter(r=>r.x),tot=rows.reduce((a,r)=>a+(r.it.pts||0),0),doneP=rows.filter(r=>r.x.status==='done').reduce((a,r)=>a+(r.it.pts||0),0),doneN=rows.filter(r=>r.x.status==='done').length;
  const daysLeft=sp.end?Math.ceil((parseDay(sp.end)-parseDay(gdYmd(new Date())))/864e5):null;
  $('pp-title').textContent=`Sprint ${num}`;$('pp-acts').innerHTML=`<span class="pp-dates">${fmtShort(sp.start)} – ${fmtShort(sp.end)}</span>`;
  body.innerHTML=`<div class="pp-goalbox"><small>Sprint goal</small>${esc(sp.goal||'')}</div>
    <div class="pp-stats"><div><b>${tot?Math.round(doneP/tot*100):(rows.length?Math.round(doneN/rows.length*100):0)}%</b><span>done</span></div><div><b>${doneP}/${tot}</b><span>points</span></div><div><b>${daysLeft==null?'–':Math.max(0,daysLeft)}</b><span>days left</span></div></div>
    <div class="pp-prog"><i style="width:${tot?doneP/tot*100:(rows.length?doneN/rows.length*100:0)}%"></i></div>
    <ul class="pp-list">${rows.map(({it,x})=>`<li class="${x.status==='done'?'done':''}"><label><input type="checkbox" data-spdone="${esc(x.id)}" ${x.status==='done'?'checked':''}><span>${esc(x.title)}</span></label>${it.who?`<span class="pp-wtag">${it.who==='ai'?'AI':'ME'}</span>`:''}<span class="pp-ptag">${it.pts||'–'}</span></li>`).join('')}</ul>
    <div class="pp-foot"><button type="button" class="btn ghost" id="pp-end-sp">End sprint</button></div>`;
  body.querySelectorAll('[data-spdone]').forEach(c=>c.onchange=()=>guard(()=>db.doc('tasks/'+c.dataset.spdone).update(c.checked?{status:'done',doneAt:new Date().toISOString()}:{status:'todo',doneAt:null})));
  $('pp-end-sp').onclick=e=>{const b=e.currentTarget;if(!b.dataset.sure){b.dataset.sure='1';b.textContent='Click again to end sprint';setTimeout(()=>{if(b.isConnected){delete b.dataset.sure;b.textContent='End sprint'}},3000);return}
    const left=rows.filter(r=>r.x.status!=='done').map(r=>r.it);
    projSave(n,{sprint:{num:num+1,status:'draft',step:1,start:gdYmd(new Date()),end:'',goal:'',items:left},past:[...(pd.past||[]),Object.assign({},sp,{closed:new Date().toISOString(),donePts:doneP,totalPts:tot})]})};
}
