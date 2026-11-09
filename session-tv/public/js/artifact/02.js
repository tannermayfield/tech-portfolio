async function doneToMenu(id){
  const t=T(id);if(!t)return;accumulate();saveState();
  if(typeOf(t)==='class'&&TV.gSel.class===id)TV.gSel.class=null;
  openGuide();
  await guard(()=>db.doc('tasks/'+id).update({status:'done',doneAt:new Date().toISOString()}),'Marked done.');
  if(TV.gSel.class===id){const nx=candidates('class').find(x=>x.id!==id);TV.gSel.class=nx?nx.id:null}
  if(TV.mode==='guide')renderGuide();
}
