/* assigned sprint tasks show at the top of the Apply (me) and Work (AI) panels */
function ppAssigned(n,who){const sp=sprintOf(n);if(!sp||sp.status!=='active')return '';
  const rows=spItems(sp).filter(i=>i.who===who).map(i=>({i,x:T(i.id)})).filter(r=>r.x);if(!rows.length)return '';
  return `<div class="pp-asg"><div class="pp-lbl">${who==='me'?'Your sprint tasks':"AI coach's sprint tasks"} <span>${rows.filter(r=>r.x.status==='done').length}/${rows.length} done</span></div><ul class="pp-list">${rows.map(({i,x})=>`<li class="${x.status==='done'?'done':''}"><label><input type="checkbox" data-spdone="${esc(x.id)}" ${x.status==='done'?'checked':''}><span>${esc(x.title)}</span></label>${i.pts?`<span class="pp-ptag">${i.pts}</span>`:''}</li>`).join('')}</ul></div>`}
function ppBindDone(){$('pp-body').querySelectorAll('[data-spdone]').forEach(c=>c.onchange=()=>guard(()=>db.doc('tasks/'+c.dataset.spdone).update(c.checked?{status:'done',doneAt:new Date().toISOString()}:{status:'todo',doneAt:null})))}
{const _s=ppSkills;ppSkills=function(t,n){_s(t,n);const h=ppAssigned(n,'me');if(h){$('pp-body').insertAdjacentHTML('afterbegin',h);ppBindDone()}}}
{const _w=ppTeach;ppTeach=function(t,n){_w(t,n);const h=ppAssigned(n,'ai');if(h){$('pp-body').insertAdjacentHTML('afterbegin',h);ppBindDone()}}}
