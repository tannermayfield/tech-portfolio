/* Keep script order: artifact files intentionally override earlier functions. */
(async () => {
 const loading=document.createElement('div');loading.className='workspace-error';loading.setAttribute('role','status');loading.textContent='Loading your workspace…';document.body.appendChild(loading);
 try {
  await window.SessionCloud?.ready;
  if(window.SessionCloud?.user)await SessionCloud.open();
  const scripts=Array.from({length:17},(_,i)=>'artifact/'+String(i+1).padStart(2,'0')+'.js').concat('local.js','project-chats.js','add-forms.js','preview.js');
  for(const name of scripts)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='js/'+name;s.onload=resolve;s.onerror=()=>reject(Error('Could not load '+name));document.body.appendChild(s)});
  loading.remove();
 } catch(error) {
  loading.remove();
  const box=document.createElement('div');box.className='workspace-error';box.textContent='Workspace could not load: '+error.message+' Reload to retry. Your saved data has not been replaced.';document.body.appendChild(box);
  if(window.SessionCloud?.user){const button=document.createElement('button');button.className='btn';button.textContent='Sign out and return to demo';button.onclick=()=>SessionCloud.signOut();box.appendChild(button);}
 }
})();
