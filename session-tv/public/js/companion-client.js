/* Browser bridge: private-workspace JWT + separate in-memory local pairing secret. */
(() => {
 let pairToken=null,controller=null;
 function owner(){if(globalThis.SessionWorkspace?.mode!=='private'||!globalThis.SessionCloud?.user)throw new Error('Sign in to your private workspace to use the local coding agent. Demo visitors cannot connect.');}
 function rememberedKey(){return 'sessiontv.companion.'+SessionCloud.user?.id}
 function restore(){if(!pairToken){try{pairToken=localStorage.getItem(rememberedKey())}catch{}}}
 function base(){const url=new URL(globalThis.SessionTVConfig?.companionUrl||'http://127.0.0.1:4319');if(url.hostname!=='127.0.0.1'||!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/')throw new Error('Companion must use a loopback 127.0.0.1 address.');return url.origin;}
 async function request(route,body={},signal){
  owner();const token=await SessionCloud.accessToken();if(!token)throw new Error('Your workspace session expired. Sign in again.');
  const response=await fetch(base()+route,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,...(pairToken?{'X-SessionTV-Pair':pairToken}:{})},body:JSON.stringify(body),signal:signal||AbortSignal.timeout(35000),credentials:'omit',cache:'no-store',targetAddressSpace:'loopback'});
  if(!response.ok){let result;try{result=await response.json()}catch{}if(response.status===401)pairToken=null;throw new Error(result?.error||'Local companion request failed ('+response.status+').')}
  return response;
 }
 globalThis.SessionCompanion={
  get paired(){return !!pairToken},
  async pair(code){const result=await (await request('/pair',{code:code.trim()})).json();pairToken=result.token;if(result.remember){try{localStorage.setItem(rememberedKey(),pairToken)}catch{}}return this.status()},
  async status(){
   if(globalThis.SessionWorkspace?.mode!=='private')return {connected:false,available:false,signedIn:false,workspaces:[],error:'Sign in to use the local companion.'};
   restore();
   if(!pairToken)return {connected:false,available:false,signedIn:false,workspaces:[],error:'Start the local companion and enter its pairing code.'};
   try{return await (await request('/status')).json()}catch(error){return {connected:false,available:false,signedIn:false,workspaces:[],error:error.message+' Allow browser local-network access when prompted; check that the companion is running.'}}
  },
  async start({workspace,prompt,threadId,onEvent=()=>{}}){
   restore();if(!pairToken)throw new Error('Pair the local companion first.');if(controller)throw new Error('A coding request is already running. Stop it before starting another.');controller=new AbortController();
   let reader;
   try{const response=await request('/run',{workspace,prompt,threadId},controller.signal);reader=response.body.getReader();const decoder=new TextDecoder();let text='';while(true){const {done,value}=await reader.read();text+=decoder.decode(value,{stream:!done});let index;while((index=text.indexOf('\n'))>=0){const line=text.slice(0,index);text=text.slice(index+1);if(line)onEvent(JSON.parse(line))}if(done)break}if(text.trim())onEvent(JSON.parse(text))}
   finally{reader?.releaseLock();controller=null}
  },
  cancel(){controller?.abort();controller=null},
  async disconnect(){try{if(pairToken)await request('/disconnect')}finally{try{localStorage.removeItem(rememberedKey())}catch{}pairToken=null;this.cancel()}}
 };
 addEventListener('pagehide',()=>{pairToken=null;SessionCompanion.cancel()});
 addEventListener('sessiontv:auth',()=>{pairToken=null;SessionCompanion.cancel()});
})();
