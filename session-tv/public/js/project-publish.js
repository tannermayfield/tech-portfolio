/* Verify the commit reported by the companion against GitHub Pages. */
(()=>{
 const owner=()=>SessionWorkspace.mode==='private'?SessionCloud.user?.id:null;
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
 globalThis.SessionProjectPublish={verify(commit){const user=owner();if(user)void verify(commit,user)}};
})();
