/* Frontend capabilities are independent of the optional local companion. */
(() => {
 const ready=document.readyState==='loading'?new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true})):Promise.resolve();
 let database;
 const config=Promise.resolve({aiConfigured:false,reason:'ChatGPT plan access requires an authorized integration. No paid API fallback is enabled.'});
 window.sessionPlatform={config,async use(capability){
  await ready;await window.SessionCloud?.ready;
  try{
   if(capability==='db')return database||=SessionWorkspace.mode==='private'?await SessionCloud.open():new SessionStore.LocalDatabase(SessionWorkspace.storage);
   if(capability==='sample')return null;
   throw new Error('Unknown capability.');
  }catch(error){window.dispatchEvent(new CustomEvent('sessiontv:error',{detail:'Could not load saved data: '+error.message}));return null}
 }};
 addEventListener('storage',event=>{const key=SessionWorkspace.mode==='demo'?'sessiontv.demo.v1:'+SessionStore.KEY:SessionStore.KEY;if(event.key===key&&database&&SessionWorkspace.mode!=='private'){try{database.reload()}catch(error){window.dispatchEvent(new CustomEvent('sessiontv:error',{detail:error.message}))}}});
})();
