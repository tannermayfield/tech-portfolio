/* Owner-only "Publish to demo": build the public snapshot in the browser, review it, then publish through the companion. */
(()=>{
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 // UI gating only. The companion checks the signed-in Supabase user against its own owner UUID.
 function isOwner(){
  const ownerId=globalThis.SessionTVConfig?.ownerId;
  return typeof ownerId==='string'&&UUID.test(ownerId)&&globalThis.SessionWorkspace?.mode==='private'&&!!globalThis.SessionCloud?.user&&SessionCloud.user.id===ownerId;
 }
 const dialog=document.createElement('dialog');dialog.id='demo-publish';dialog.className='confirm-dlg';dialog.setAttribute('aria-labelledby','demo-publish-heading');
 dialog.innerHTML=`<div class="local-panel"><header class="row spread"><h2 id="demo-publish-heading">Publish to demo</h2><button class="btn ghost" type="button" data-close>Close</button></header>
  <p>Visitors who are not signed in will see these records. Chats, prompts, Canvas data, computer folders, account ids and session recaps are never included.</p>
  <ul id="demo-publish-counts" class="demo-publish-counts"></ul>
  <div id="demo-publish-list" class="demo-publish-list" tabindex="0" aria-label="Records to publish" style="max-height:40vh;overflow:auto"></div>
  <p id="demo-publish-message" role="status"></p>
  <div class="row"><button class="btn ghost" type="button" data-cancel>Cancel</button><button class="btn" type="button" id="demo-publish-download" hidden>Download demo-data.js</button><button class="btn" type="button" id="demo-publish-confirm" disabled>Publish to demo</button></div></div>`;
 document.body.append(dialog);
 const $id=id=>document.getElementById(id);
 let snapshot=null,generation=0,busy=false;
 const message=text=>{$id('demo-publish-message').textContent=text};
 function reset(){generation++;snapshot=null;busy=false;$id('demo-publish-counts').replaceChildren();$id('demo-publish-list').replaceChildren();$id('demo-publish-confirm').disabled=true;$id('demo-publish-download').hidden=true;message('')}
 function close(){reset();if(dialog.open)dialog.close()}
 dialog.querySelector('[data-close]').onclick=close;dialog.querySelector('[data-cancel]').onclick=close;
 dialog.addEventListener('close',()=>{if(!busy)reset()});
 addEventListener('sessiontv:auth',close);
 function renderReview(){
  const groups=SessionDemoSnapshot.summary(snapshot),counts=$id('demo-publish-counts'),list=$id('demo-publish-list');
  counts.replaceChildren(...groups.map(group=>{const item=document.createElement('li'),count=document.createElement('b');count.textContent=String(group.count);item.append(count,' '+group.label);return item}));
  list.replaceChildren(...groups.filter(group=>group.count).map(group=>{
   const section=document.createElement('section'),heading=document.createElement('h3'),items=document.createElement('ul');
   heading.textContent=group.label+' ('+group.count+')';
   items.append(...group.items.map(text=>{const item=document.createElement('li');item.textContent=text;return item}));
   section.append(heading,items);return section;
  }));
 }
 async function open(){
  if(!isOwner())return;
  reset();const epoch=generation;message('Preparing the public snapshot…');if(!dialog.open)dialog.showModal();
  try{
   const backup=await SessionCloud.exportBackup();
   if(epoch!==generation||!isOwner())return;
   snapshot=SessionDemoSnapshot.publicSnapshot(backup);
   renderReview();message('Review the records above. Nothing is published until you choose Publish to demo.');
   $id('demo-publish-confirm').disabled=false;
  }catch(error){if(epoch===generation)message('Could not prepare the snapshot: '+error.message)}
 }
 function download(){
  if(!snapshot||!isOwner())return;
  const url=URL.createObjectURL(new Blob([SessionDemoSnapshot.renderDemoFile(snapshot)],{type:'text/javascript'}));
  const link=document.createElement('a');link.href=url;link.download='demo-data.js';document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  message('Downloaded demo-data.js. Replace session-tv/public/js/demo-data.js with it, then commit and push.');
 }
 async function publish(){
  if(!snapshot||busy||!isOwner())return;
  const epoch=generation,user=SessionCloud.user.id,reviewed=snapshot;busy=true;
  const confirm=$id('demo-publish-confirm');confirm.disabled=true;message('Publishing the demo through your computer…');
  try{
   const result=await SessionCompanion.publishDemo(reviewed);
   if(epoch!==generation||SessionCloud.user?.id!==user)return;
   if(result.status==='no_changes'){message('The demo already matches these records.');return}
   message('Pushed '+String(result.commit).slice(0,7)+'. GitHub Pages is deploying the demo.');
   globalThis.SessionProjectPublish?.verify(result.commit);
  }catch(error){
   if(epoch!==generation)return;
   message('The companion could not publish the demo: '+error.message+' You can download demo-data.js and commit it yourself.');
   $id('demo-publish-download').hidden=false;confirm.disabled=false;
  }finally{busy=false}
 }
 $id('demo-publish-confirm').onclick=publish;$id('demo-publish-download').onclick=download;
 // Owner-only card next to Session Login.
 SessionTV.hooks.after('settings:render',()=>{
  if(TV.dbView||!isOwner()||document.getElementById('demo-publish-open'))return;
  const login=document.getElementById('local-open')?.closest('.set-card');if(!login)return;
  const card=document.createElement('div');card.className='set-card demo-publish-card';
  card.innerHTML='<h3>Public Demo</h3><div class="row"><button class="btn" id="demo-publish-open">Publish to demo</button></div>';
  card.querySelector('button').onclick=open;login.after(card);
 });
 globalThis.SessionDemoExport={isOwner,open,download};
})();
