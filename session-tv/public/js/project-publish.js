/* GitHub Pages publishing for the owner's linked SessionTV repository. */
(()=>{
 const settingsKey='sb.sessiontvAutoPublish';
 let pending=false;
 const dialog=document.createElement('dialog');dialog.id='sessiontv-publish';dialog.className='confirm-dlg';
 dialog.innerHTML='<div class="local-panel"><h2>Publish SessionTV</h2><label><input type="checkbox" data-auto> Automatically publish successful Work turns that start with a clean SessionTV folder</label><p role="status"></p><ul data-files></ul><div class="row"><button class="btn ghost" data-close>Close</button><button class="btn" data-publish disabled>Publish reviewed files</button></div></div>';
 document.body.append(dialog);
 const status=dialog.querySelector('[role=status]'),files=dialog.querySelector('[data-files]'),publish=dialog.querySelector('[data-publish]'),auto=dialog.querySelector('[data-auto]');
 const signedIn=()=>SessionWorkspace.mode==='private'&&!!SessionCloud.user?.id;
 const supported=folder=>/(?:^|[\\/])tech-portfolio(?:[\\/]session-tv)?$/i.test(folder||'');
 function enabled(folder){return signedIn()&&supported(folder)&&recall(settingsKey,'')===folder;}
 function report(message){status.textContent=message;toast(message)}
 async function run(folder,review){
  if(pending||!signedIn())return;
  pending=true;publish.disabled=true;const owner=SessionCloud.user.id;
  try{
   report('Publishing SessionTV…');
   const result=await SessionCompanion.publishProject(folder,review);
   if(SessionCloud.user?.id!==owner)return;
   report('Pushed '+result.commit.slice(0,7)+'. Waiting for GitHub Pages…');
   for(let attempt=0;attempt<36&&SessionCloud.user?.id===owner;attempt++){
    const verification=await SessionCompanion.publishStatus(result.commit);
    if(verification.live){report('SessionTV is live. Refresh to see the update.');return;}
    await new Promise(resolve=>setTimeout(resolve,5000));
   }
   if(SessionCloud.user?.id===owner)report('Pushed successfully. This commit has not been verified live yet.');
  }catch(error){if(SessionCloud.user?.id===owner)report(error.message)}finally{pending=false;}
 }
 async function open(folder){
  if(!signedIn()||!supported(folder))return;
  auto.checked=enabled(folder);auto.onchange=()=>store(settingsKey,auto.checked?folder:'');
  if(!dialog.open)dialog.showModal();if(pending)return;
  publish.disabled=true;files.replaceChildren();status.textContent='Checking the linked repository…';
  try{const review=await SessionCompanion.previewPublish(folder);for(const file of review.files){const li=document.createElement('li');li.textContent=file;files.append(li);}
   status.textContent=review.tree?'Review these files before publishing them to GitHub Pages.':'There are no SessionTV changes to publish.';
   publish.disabled=!review.tree;publish.onclick=()=>run(folder,review);
  }catch(error){status.textContent=error.message;}
 }
 async function baseline(folder){if(!enabled(folder)||pending)return null;try{const review=await SessionCompanion.previewPublish(folder);if(!review.tree)return review.base;}catch(error){toast('Automatic publish unavailable: '+error.message);}return null;}
 async function afterTurn(folder,base){if(!base||!enabled(folder)||pending)return;try{const review=await SessionCompanion.previewPublish(folder);if(review.base===base&&review.tree)await run(folder,review);}catch(error){toast('Automatic publish paused: '+error.message);}}
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();addEventListener('sessiontv:auth',()=>dialog.close());
 globalThis.SessionProjectPublish={supported,open,baseline,afterTurn};
})();
