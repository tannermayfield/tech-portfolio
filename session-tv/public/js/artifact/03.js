function pastAssignments(){
  return tasks.filter(t=>t.status==='done'&&typeOf(t)==='class')
    .sort((a,b)=>(b.doneAt||'').localeCompare(a.doneAt||''));
}
function openPast(){
  const list=pastAssignments(),ol=$('pa-list');
  const when=iso=>{if(!iso)return 'Done';const d=new Date(iso);return 'Done '+d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})+' · '+d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})};
  ol.innerHTML=list.length?list.map(t=>`<li><button type="button" class="pa-row" data-id="${esc(t.id)}"><span class="pa-t">${esc(t.title)}</span><span class="pa-m"><span>${esc(t.course||'Other')}</span><span>${esc(when(t.doneAt))}</span></span></button></li>`).join('')
    :'<li class="pa-empty">Nothing marked done yet. Finished assignments show up here, newest first.</li>';
  ol.querySelectorAll('.pa-row').forEach(b=>b.onclick=()=>{TV.tdPast=b.dataset.id;openTask(b.dataset.id)});
  $('pa-close').onclick=()=>$('past-dlg').close();
  $('past-dlg').showModal();
}
