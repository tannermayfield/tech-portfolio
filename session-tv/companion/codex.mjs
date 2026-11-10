import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {EventEmitter} from 'node:events';

// All protocol messages go through stdio. There is no exposed app-server socket.
export class CodexBridge extends EventEmitter {
 constructor({executable='codex',home,cwd,spawnProcess=spawn}) {
  super();this.next=1;this.pending=new Map();this.closed=false;
  const profile={filesystem:{':minimal':'read',':workspace_roots':{'.':'write','.git':'read','.codex':'read','.agents':'read','.aws':'deny','.env':'deny'}},network:{enabled:false}};
  const readProfile={filesystem:{':minimal':'read',':workspace_roots':{'.':'read','.aws':'deny','.env':'deny'}},network:{enabled:false}};
  const args=['app-server','--listen','stdio://','-c','default_permissions="sessiontv"','-c','permissions.sessiontv='+toml(profile),
   '-c','permissions.sessiontv_plan='+toml(readProfile),'-c','permissions.sessiontv_apply='+toml(readProfile),
   ...(process.platform==='win32'?['-c','features.prefer_mxc=true','-c','windows.sandbox="mxc"']:[]),
   '-c','approval_policy="on-request"','-c','approvals_reviewer="user"','-c','model_provider="openai"','-c','forced_login_method="chatgpt"',
   '-c','shell_environment_policy.inherit="none"','-c','features.multi_agent=false','-c','mcp_servers={}'];
  const env={...process.env,CODEX_HOME:home};
  for(const key of Object.keys(env))if(/API_KEY|ACCESS_TOKEN|SESSIONTV_|SUPABASE_|ANTHROPIC|AWS_|OPENAI_/i.test(key))delete env[key];
  this.process=spawnProcess(executable,args,{cwd,env,windowsHide:true,stdio:['pipe','pipe','pipe'],shell:false});
  createInterface({input:this.process.stdout}).on('line',line=>this.receive(line));
  this.process.stderr.on('data',()=>{}); // Never forward credentials or uncontrolled diagnostic output.
  this.process.on('error',error=>this.stop(new Error('Codex could not start: '+error.message)));
  this.process.on('exit',()=>this.stop(new Error('Codex app-server stopped.')));
 }
 receive(line) {
  let message;try{message=JSON.parse(line)}catch{return}
  if(message.method&&Object.hasOwn(message,'id')) {
   // Never allow an approval to lift the sandbox or grant new permissions.
   const result=message.method==='item/permissions/requestApproval'?{permissions:{}}:
    message.method.includes('elicitation')?{action:'decline',content:null}:{decision:'decline'};
   this.send({id:message.id,result});
   this.emit('event',{method:'sessiontv/approvalDenied',params:{method:message.method,reason:'Additional permissions are blocked. Review and run this action yourself in a local terminal.'}});
   return;
  }
  if(Object.hasOwn(message,'id')) {
   const pending=this.pending.get(message.id);if(!pending)return;
   this.pending.delete(message.id);clearTimeout(pending.timer);
   message.error?pending.reject(new Error(message.error.message||'Codex request failed.')):pending.resolve(message.result);
  } else if(message.method)this.emit('event',message);
 }
 send(message){if(this.closed)throw new Error('Codex is offline.');this.process.stdin.write(JSON.stringify(message)+'\n')}
 request(method,params={}) {
  return new Promise((resolve,reject)=>{
   const id=this.next++,timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Codex request timed out.'))},30000);
   this.pending.set(id,{resolve,reject,timer});
   try{this.send({id,method,params})}catch(error){clearTimeout(timer);this.pending.delete(id);reject(error)}
  });
 }
 async initialize(){await this.request('initialize',{clientInfo:{name:'session_tv_companion',title:'Session TV local companion',version:'1.0.0'},capabilities:{experimentalApi:true}});this.send({method:'initialized',params:{}})}
 async account(){const result=await this.request('account/read',{refreshToken:false});return {signedIn:result.account?.type==='chatgpt',authType:result.account?.type||null}}
 async prepare(cwd,mode='work',threadId){
  if(!Object.hasOwn(MODE_INSTRUCTIONS,mode))throw new Error('Choose Plan, Apply, or Work.');
  const permissions=mode==='work'?'sessiontv':'sessiontv_'+mode;
  const account=await this.account();
  if(!account.signedIn)throw new Error('Sign in with ChatGPT using codex login in the dedicated companion profile. API-key authentication is disabled.');
  const profile=await this.request('permissionProfile/list',{cwd});
  if(!profile.data?.some(p=>p.id===permissions&&p.allowed))throw new Error('This Codex installation cannot enforce the required sessiontv permission profile. Update Codex; no unrestricted fallback is allowed.');
  if(threadId){
   const saved=await this.request('thread/read',{threadId});
   if(saved.thread?.cwd!==cwd)throw new Error('This chat belongs to a different folder. Create a new chat.');
  }
  let started;
  try {
   started=await this.request(threadId?'thread/resume':'thread/start',{
    ...(threadId?{threadId,excludeTurns:true}:{}),cwd,runtimeWorkspaceRoots:[cwd],permissions,
    approvalPolicy:'on-request',approvalsReviewer:'user',modelProvider:'openai',
    developerInstructions:MODE_INSTRUCTIONS[mode]+' Work only in the selected workspace. Report modified files and test results. This companion declines additional permissions and command approvals. Explain any action that needs separate owner approval. Never use API credentials or other providers.'
   });
  } catch(error) {
   if(/sandbox|MXC/i.test(error.message))throw new Error('Codex could not start its Windows sandbox. '+error.message);
   throw error;
  }
  const confirmedProfile=typeof started.activePermissionProfile==='string'?started.activePermissionProfile:started.activePermissionProfile?.id;
  if(confirmedProfile!==permissions||started.approvalPolicy!=='on-request'||started.approvalsReviewer!=='user'||started.modelProvider!=='openai'||started.cwd!==cwd||
   started.runtimeWorkspaceRoots?.length!==1||started.runtimeWorkspaceRoots[0]!==cwd)throw new Error('Codex did not confirm the required restricted workspace policy. No coding turn was started.');
  if(!threadId)await this.request('thread/name/set',{threadId:started.thread.id,name:'Session TV · '+mode[0].toUpperCase()+mode.slice(1)});
  return started.thread.id;
 }
 async start(cwd,prompt,threadId,mode='work'){
  const id=await this.prepare(cwd,mode,threadId);
  const permissions=mode==='work'?'sessiontv':'sessiontv_'+mode;
  this.emit('event',{method:'sessiontv/thread',params:{threadId:id}});
  await this.request('turn/start',{threadId:id,input:[{type:'text',text:prompt}],permissions,approvalPolicy:'on-request'});
  return id;
 }
 stop(error=new Error('Codex disconnected.')) {
  if(this.closed)return;this.closed=true;
  for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error)}this.pending.clear();
  this.process.kill();this.emit('stopped',error);
 }
}
function toml(value){
 if(value&&typeof value==='object')return '{'+Object.entries(value).map(([key,v])=>JSON.stringify(key)+'='+toml(v)).join(',')+'}';
 return JSON.stringify(value);
}

export const MODE_INSTRUCTIONS={
 plan:'You are the project Scrum planning coach. Help the user plan a weekly sprint with one clear goal, achievable backlog items, estimates, acceptance criteria, and a review/retrospective. Ask concise questions and use the project context. Do not implement or edit project files. Your filesystem access is read-only.',
 apply:'You are a learning coach. The user builds this project independently to practice previously learned skills. Offer the smallest useful hint, ask what they have tried, connect the task to their skills, and ask them to explain their reasoning. Do not write their implementation or change files. Your filesystem access is read-only.',
 work:'You are the implementation coach. Build the requested project changes in the linked folder, explain what you are doing and why, describe concepts and tradeoffs, and report verification results. After meaningful changes ask one or two short questions to help the user learn. Avoid unrelated modifications.'
};
