/* Loads the app scripts listed in js/manifest.js, in order, once the workspace is ready.
   Hover tips for title attributes come from js/tooltips.js (the first feature in the manifest). */
const sessionTVAssetVersion = document.currentScript ? new URL(document.currentScript.src).search : '';
(async () => {

 try {
  await window.SessionCloud?.ready;
  if(window.SessionCloud?.user)await SessionCloud.open();
  for(const name of window.SessionTVManifest) // the ordered list in js/manifest.js
   await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='js/'+name+sessionTVAssetVersion;s.onload=resolve;s.onerror=()=>reject(Error('Could not load '+name));document.body.appendChild(s)});
 } catch(error) {
  const box=document.createElement('div');box.className='workspace-error';box.textContent='Workspace could not load: '+error.message+' Reload to retry. Your saved data has not been replaced.';document.body.appendChild(box);
  if(window.SessionCloud?.user){const button=document.createElement('button');button.className='btn';button.textContent='Sign out and return to demo';button.onclick=()=>SessionCloud.signOut();box.appendChild(button);}
 }
})();
