/* backlog picker: a popup centered over the chat, which blurs behind it */
function ppBacklogClose(){TV.ppBlOpen=false;const o=$('pp-blpop');if(o)o.remove();$('coach-wrap').classList.remove('bl-dim');const b=$('pp-bl-tog');if(b)b.focus()}
function ppBacklogOpen(t,n,mode){
  mode=mode||'add';TV.ppBlOpen=mode;const host=$('coach-wrap'),sp=sprintOf(n),items=spItems(sp);
  const back=projectTasks(n).filter(x=>x.status!=='done'),avail=back.filter(x=>!items.some(i=>i.id===x.id));
  let o=$('pp-blpop');if(!o){o=document.createElement('div');o.id='pp-blpop';o.className='pp-blpop';host.appendChild(o)}
  host.classList.add('bl-dim');
  const _ol=o.querySelector('.pp-bl,.pp-tl'),_st=_ol?_ol.scrollTop:0,_ae=document.activeElement,_idx=_ol&&_ae&&_ol.contains(_ae)?[..._ol.querySelectorAll('[data-bladd]')].indexOf(_ae):-1;
  const head=`<div class="pp-blhead"><h3 id="pp-bl-h">Product backlog</h3><button type="button" class="pp-blx" id="pp-blx" aria-label="Close"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>`;
  if(mode==='manage'){
    o.innerHTML=`<div class="pp-blcard" role="dialog" aria-modal="true" aria-labelledby="pp-bl-h">${head}
      <div class="pp-blsub">Everything still to do on ${esc(n)}, in priority order. Drag a number to reorder.</div>
      <div class="pp-blnew"><input id="pp-bl-new" class="pp-in" placeholder="Add a backlog task" autocomplete="off"></div>
      <ol class="pp-tl pp-blm">${back.map((x,k)=>`<li data-iid="${esc(x.id)}"><span class="pp-n" title="Drag to reorder">${k+1}</span><span class="pp-tt">${esc(x.title)}</span><button type="button" class="pp-x" data-blrm="${esc(x.id)}" title="Remove from backlog" aria-label="Remove ${esc(x.title)}">×</button></li>`).join('')}</ol>
      ${back.length?'':'<div class="pp-blnone">The backlog is empty. Add the first task above.</div>'}</div>`;
    ppDragInit(o.querySelector('.pp-blm'),async ids=>{const base=Math.min(...back.map(x=>x.order||0),1000);ids.forEach((id,k)=>{const x=T(id);if(x)x.order=base+k});ppBacklogOpen(t,n,'manage');for(const [k,id] of ids.entries())await guard(()=>db.doc('tasks/'+id).update({order:base+k}))});
    o.querySelectorAll('[data-blrm]').forEach(b=>b.onclick=async()=>{if(!b.dataset.sure){b.dataset.sure='1';b.textContent='Remove?';b.classList.add('sure');setTimeout(()=>{if(b.isConnected){delete b.dataset.sure;b.textContent='×';b.classList.remove('sure')}},2500);return}
      const id=b.dataset.blrm;tasks=tasks.filter(x=>x.id!==id);const cur=sprintOf(n);if(cur&&spItems(cur).some(i=>i.id===id))projSave(n,{sprint:Object.assign({},cur,{items:spItems(cur).filter(i=>i.id!==id)})});
      ppBacklogOpen(t,n,'manage');await guard(()=>db.doc('tasks/'+id).delete())});
    $('pp-bl-new').onkeydown=async e=>{if(e.key!=='Enter')return;const v=e.target.value.trim();if(!v)return;e.target.value='';
      const order=Math.max(0,...tasks.filter(x=>typeOf(x)==='project').map(x=>x.order||0))+1;const doc={track:'project',title:v,course:n,goal:'',status:'todo',order};if(isPipe(doc))doc.phase='Other';
      const id='p'+Date.now().toString(36);await guard(()=>db.doc('tasks/'+id).set(doc));setTimeout(()=>{const ol=o.querySelector('.pp-blm');if(ol)ol.scrollTop=ol.scrollHeight;$('pp-bl-new')&&$('pp-bl-new').focus()},60)};
  }else{
    o.innerHTML=`<div class="pp-blcard" role="dialog" aria-modal="true" aria-labelledby="pp-bl-h">${head}
      <div class="pp-blsub">Click a task to add it to the sprint.</div>
      <ul class="pp-bl">${avail.map(x=>`<li><button type="button" data-bladd="${esc(x.id)}"><span>${esc(x.title)}</span><b>+</b></button></li>`).join('')||'<li class="pp-blnone">Everything in the backlog is already in this sprint.</li>'}</ul></div>`;
    o.querySelectorAll('[data-bladd]').forEach(b=>b.onclick=()=>{const cur=spItems(sprintOf(n));projSave(n,{sprint:Object.assign({},sprintOf(n),{items:[...cur,{id:b.dataset.bladd,pts:0}]})})});
  }
  o.onclick=e=>{if(e.target===o)ppBacklogClose()};
  $('pp-blx').onclick=ppBacklogClose;
  {const nl=o.querySelector('.pp-bl,.pp-tl');if(nl)nl.scrollTop=_st}
  if(!o.contains(document.activeElement)){const bs=[...o.querySelectorAll('[data-bladd]')];const f=mode==='manage'?$('pp-bl-new'):(_idx>=0?(bs[Math.min(_idx,bs.length-1)]||$('pp-blx')):(bs[0]||$('pp-blx')));if(f)f.focus({preventScroll:true})}
}
addEventListener('keydown',e=>{if(e.key==='Escape'&&$('pp-blpop')){e.preventDefault();e.stopImmediatePropagation();ppBacklogClose()}},true);
// leaving the tasks step or the project closes it
{const _pm=ppMount;ppMount=function(t){_pm(t);const sp=t&&typeOf(t)==='project'&&!$('pp').hidden?sprintOf(t.course||'Project'):null;if(!(sp&&sp.status!=='active'&&projMode(t)==='plan')&&$('pp-blpop'))ppBacklogClose()}}
