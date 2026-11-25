/* Loads the app scripts listed in js/manifest.js, in order, once the workspace is ready. */
const sessionTVAssetVersion = document.currentScript ? new URL(document.currentScript.src).search : '';
// Browser hover tips come from title attributes and SVG title elements.
(() => {
 const selector='[title], svg title';
 const labelIfNeeded=(element,label)=>{
  if(label&&!element.hasAttribute('aria-label')&&!element.hasAttribute('aria-labelledby')&&
   (element.matches('iframe, input, select, textarea')||(element.matches('button, a, [role="button"], svg')&&!element.textContent.trim())))element.setAttribute('aria-label',label);
 };
 function removeTip(element){
  if(element.matches('svg title')){
   const parent=element.parentElement;
   if(parent&&!parent.hasAttribute('aria-label')&&!parent.hasAttribute('aria-labelledby'))parent.setAttribute('aria-label',element.textContent.trim());
   element.remove();
  }else if(element.hasAttribute('title')){
   labelIfNeeded(element,element.getAttribute('title'));
   element.removeAttribute('title');
  }
 }
 function scan(root){
  if(root.nodeType!==1)return;
  if(root.matches(selector))removeTip(root);
  root.querySelectorAll(selector).forEach(removeTip);
 }
 scan(document.body);
 new MutationObserver(records=>{
  for(const record of records){
   if(record.type==='attributes'){if(record.target.hasAttribute('title'))removeTip(record.target);}
   else for(const node of record.addedNodes)scan(node);
  }
 }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['title']});
})();

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
