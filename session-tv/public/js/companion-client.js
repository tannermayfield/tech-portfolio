/* Browser bridge: private-workspace JWT + separate in-memory local pairing secret. */
(() => {
 let pairToken=null,controller=null;
 function owner(){if(globalThis.SessionWorkspace?.mode!=='private'||!globalThis.SessionCloud?.user)throw new Error('Sign in to your private workspace to use the local coding agent. Demo visitors cannot connect.');}
 function rememberedKey(){return 'sessiontv.companion.'+SessionCloud.user?.id}
 function restore(){if(!pairToken){try{pairToken=localStorage.getItem(rememberedKey())}catch{}}}
 function base(){const url=new URL(globalThis.SessionTVConfig?.companionUrl||'http://127.0.0.1:4319');if(url.hostname!=='127.0.0.1'||!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/')throw new Error('Companion must use a loopback 127.0.0.1 address.');return url.origin;}
 async function request(route,body={},signal){
  owner();restore();const token=await SessionCloud.accessToken();if(!token)throw new Error('Your workspace session expired. Sign in again.');
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
  async canvasStatus(signal){return (await request('/canvas/status',{},signal)).json()},
  async connectCanvas(token,signal){return (await request('/canvas/connect',{token},signal)).json()},
  async disconnectCanvas(signal){return (await request('/canvas/disconnect',{},signal)).json()},
  async canvasSnapshot(signal){return (await request('/canvas/snapshot',{},signal||AbortSignal.timeout(180000))).json()},
  async publishStatus(commit){return (await request('/publish/status',{commit})).json()},
  async answerCodexApproval(id,accept){return (await request('/codex/approval',{id,accept})).json()},
  async codexConnect(){return (await request('/codex/connect')).json()},
  async codexLoginStatus(){return (await request('/codex/login-status')).json()},
  async chatGPTStatus(){return (await request('/chatgpt/status')).json()},
  async connectChatGPT(){return (await request('/chatgpt/connect')).json()},
  async disconnectChatGPT(){return (await request('/chatgpt/disconnect')).json()},
  async chatGPTModels(){return (await request('/chatgpt/models')).json()},
  async chatGPTStart({model,effort,messages,onEvent=()=>{},signal}){
   const response=await request('/chatgpt/run',{model,effort,messages},signal||AbortSignal.timeout(180000));
   const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
   try{while(true){const {done,value}=await reader.read();buffer+=decoder.decode(value,{stream:!done});let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);if(line.trim())onEvent(JSON.parse(line))}if(done)break}if(buffer.trim())onEvent(JSON.parse(buffer))}finally{reader.releaseLock()}
  },
  async models(workspace){return (await request('/models',{workspace})).json()},
  async voices(options){return (await request('/voice/voices',options)).json()},
  async speak(options,signal){return (await request('/voice/speak',options,signal||AbortSignal.timeout(180000))).blob()},
  async pickFolder(){return (await request('/folders/pick',{},AbortSignal.timeout(180000))).json()},
  async openFolder(folder){return (await request('/folders/open',{folder})).json()},
  async prepareProject(folder,projectId){return (await request('/projects/prepare',{folder,projectId},AbortSignal.timeout(180000))).json()},
  async start({workspace,prompt,threadId,mode='work',effort,image,reviewer,onEvent=()=>{}}){
   restore();if(!pairToken)throw new Error('Pair the local companion first.');if(controller)throw new Error('A coding request is already running. Stop it before starting another.');controller=new AbortController();
   let reader;
   try{const response=await request('/run',{workspace,prompt,threadId,mode,effort,image,reviewer},controller.signal);reader=response.body.getReader();const decoder=new TextDecoder();let text='';while(true){const {done,value}=await reader.read();text+=decoder.decode(value,{stream:!done});let index;while((index=text.indexOf('\n'))>=0){const line=text.slice(0,index);text=text.slice(index+1);if(line)onEvent(JSON.parse(line))}if(done)break}if(text.trim())onEvent(JSON.parse(text))}
   finally{reader?.releaseLock();controller=null}
  },
  cancel(){controller?.abort();controller=null},
  async disconnect(){try{if(pairToken)await request('/disconnect')}finally{try{localStorage.removeItem(rememberedKey())}catch{}pairToken=null;this.cancel()}}
 };
 addEventListener('pagehide',()=>{pairToken=null;SessionCompanion.cancel()});
 addEventListener('sessiontv:auth',()=>{pairToken=null;SessionCompanion.cancel()});
})();
