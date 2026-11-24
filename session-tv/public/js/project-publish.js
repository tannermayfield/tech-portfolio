/* Automatic GitHub Pages publishing for the linked SessionTV checkout. */
(()=>{
 let publishing=null;
 const owner=()=>SessionWorkspace.mode==='private'?SessionCloud.user?.id:null;
 const supported=folder=>/(?:^|[\\/])tech-portfolio(?:[\\/]session-tv)?$/i.test(folder||'');

 async function verify(commit,user){
  for(let attempt=0;attempt<36&&owner()===user;attempt++){
   try{
    if((await SessionCompanion.publishStatus(commit)).live){
     if(owner()===user)toast('SessionTV is live. Refresh to see the update.');
     return;
    }
   }catch{}
   await new Promise(resolve=>setTimeout(resolve,5000));
  }
  if(owner()===user)toast('Pushed '+commit.slice(0,7)+'. GitHub Pages has not verified this release yet.');
 }
 async function baseline(folder){
  const user=owner();if(!user||!supported(folder))return null;
  if(publishing)await publishing;
  try{
   if(owner()!==user)return null;
   const review=await SessionCompanion.previewPublish(folder);
   if(review.tree){toast('Automatic publish paused because SessionTV already has local changes.');return null;}
   return {base:review.base,user};
  }catch(error){if(owner()===user)toast('Automatic publish unavailable: '+error.message);return null;}
 }
 async function afterTurn(folder,start){
  if(!start||owner()!==start.user)return;
  const {user,base}=start;
  publishing=(async()=>{
   try{
    const review=await SessionCompanion.previewPublish(folder);
    if(owner()!==user)return;
    if(review.base!==base){toast('Automatic publish paused because the repository changed during this turn.');return;}
    if(!review.tree)return;
    toast('Publishing SessionTV…');
    const result=await SessionCompanion.publishProject(folder,review);
    if(owner()!==user)return;
    toast('Pushed '+result.commit.slice(0,7)+'. Waiting for GitHub Pages…');
    void verify(result.commit,user);
   }catch(error){if(owner()===user)toast('Automatic publish paused: '+error.message);}
  })();
  try{await publishing}finally{publishing=null;}
 }
 globalThis.SessionProjectPublish={baseline,afterTurn};
})();
