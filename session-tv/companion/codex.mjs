import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {existsSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {EventEmitter} from 'node:events';

// All protocol messages go through stdio. There is no exposed app-server socket.
export class CodexBridge extends EventEmitter {
 constructor({executable='codex',home,cwd,reviewChanges=false,reviewer='user',publishTool,spawnProcess=spawn}) {
  super();this.next=1;this.pending=new Map();this.closed=false;this.reviewChanges=reviewChanges;this.reviewer=reviewChanges&&reviewer==='auto_review'?'auto_review':'user';this.approvals=new Map();this.publishTool=!!publishTool;
  const profile={filesystem:{':minimal':'read',':workspace_roots':{'.':'write','.git':'read','.codex':'read','.agents':'read','.aws':'deny','.env':'deny'}},network:{enabled:false}};
  const readProfile={filesystem:{':minimal':'read',':workspace_roots':{'.':'read','.aws':'deny','.env':'deny'}},network:{enabled:false}};
  // Codex discovers repository instructions above nested workspace roots.
  // Grant only the existing instruction files, never the parent directory.
  for(let parent=path.dirname(cwd);;parent=path.dirname(parent)){for(const name of ['AGENTS.md','AGENTS.override.md']){const file=path.join(parent,name);if(existsSync(file)){profile.filesystem[file]='read';readProfile.filesystem[file]='read'}}if(path.dirname(parent)===parent)break;}
  // Windows needs these OS paths to launch commands with an otherwise empty environment.
  const windowsShellEnvironment=Object.fromEntries(
   ['SystemRoot','WINDIR','ComSpec'].map(name=>[name,process.env[name]]).filter(([,value])=>value)
  );
  const args=['app-server','--listen','stdio://','-c','default_permissions="sessiontv"','-c','permissions.sessiontv='+toml(profile),
   '-c','permissions.sessiontv_plan='+toml(readProfile),'-c','permissions.sessiontv_apply='+toml(readProfile),
   ...(process.platform==='win32'?['-c','features.prefer_mxc=true','-c','windows.sandbox="mxc"']:[]),
   '-c','approval_policy="on-request"','-c','approvals_reviewer='+JSON.stringify(this.reviewer),'-c','model_provider="openai"','-c','forced_login_method="chatgpt"',
   '-c','shell_environment_policy.inherit="none"',
   ...(process.platform==='win32'?['-c','shell_environment_policy.set='+toml(windowsShellEnvironment)]:[]),
   '-c','features.multi_agent=false','-c','mcp_servers='+toml(publishTool?{sessiontv_release:{url:publishTool.url,bearer_token_env_var:'SESSIONTV_RELEASE_TOKEN',tool_timeout_sec:150,enabled_tools:['publish_sessiontv'],tools:{publish_sessiontv:{approval_mode:'approve'}}}}:{})];
  const env={...process.env,CODEX_HOME:home};
  for(const key of Object.keys(env))if(/API_KEY|ACCESS_TOKEN|SESSIONTV_|SUPABASE_|ANTHROPIC|AWS_|OPENAI_/i.test(key))delete env[key];
  if(publishTool)env.SESSIONTV_RELEASE_TOKEN=publishTool.token;
  this.process=spawnProcess(executable,args,{cwd,env,windowsHide:true,stdio:['pipe','pipe','pipe'],shell:false});
  createInterface({input:this.process.stdout}).on('line',line=>this.receive(line));
  this.process.stderr.on('data',()=>{}); // Never forward credentials or uncontrolled diagnostic output.
  this.process.on('error',error=>this.stop(new Error('Codex could not start: '+error.message)));
  this.process.on('exit',()=>this.stop(new Error('Codex app-server stopped.')));
 }
 receive(line) {
  let message;try{message=JSON.parse(line)}catch{return}
  if(message.method&&Object.hasOwn(message,'id')) {
   const params=message.params||{};
   const isCommand=message.method==='item/commandExecution/requestApproval';
   const isFile=message.method==='item/fileChange/requestApproval';
   if(this.reviewChanges&&this.currentMode==='work'&&((isCommand&&(params.command||params.networkApprovalContext?.host))||isFile)&&(!params.availableDecisions||params.availableDecisions.includes('accept'))){
    const id=randomUUID();
    const timer=setTimeout(()=>this.answerApproval(id,false),120000);
    this.approvals.set(id,{requestId:message.id,timer});
    this.emit('event',{method:'sessiontv/approval',params:{id,kind:params.networkApprovalContext?'Network access':isCommand?'Run command':'Change files',command:params.command,cwd:params.cwd,reason:params.reason,host:params.networkApprovalContext?.host,grantRoot:params.grantRoot,additionalPermissions:params.additionalPermissions}});
    return;
   }
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
 answerApproval(id,accept){
  const approval=this.approvals.get(id);if(!approval||this.closed)return false;
  this.approvals.delete(id);clearTimeout(approval.timer);
  this.send({id:approval.requestId,result:{decision:accept?'accept':'decline'}});
  this.emit('event',{method:'sessiontv/approvalResolved',params:{id,accepted:accept}});
  return true;
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
 async models(){
  const account=await this.account();
  if(!account.signedIn)throw new Error('Sign in with ChatGPT to load your Codex models.');
  const models=[],cursors=new Set();let cursor;
  do {
   const page=await this.request('model/list',{includeHidden:false,limit:100,modelProvider:'openai',...(cursor?{cursor}:{})});
   if(!Array.isArray(page.data))throw new Error('Codex returned an invalid model catalog. Update Codex and try again.');
   for(const value of page.data){
    const id=value.model||value.id;
    if(typeof id!=='string'||value.hidden)continue;
    const efforts=(value.supportedReasoningEfforts||[]).map(option=>typeof option==='string'?option:option.reasoningEffort).filter(effort=>['low','medium','high','xhigh'].includes(effort));
    models.push({id,displayName:value.displayName||id,isDefault:!!value.isDefault,efforts});
   }
   cursor=page.nextCursor;
   if(cursor&&cursors.has(cursor))throw new Error('Codex returned a repeated catalog page. Try again.');
   if(cursor)cursors.add(cursor);
  }while(cursor);
  const selected=models.find(model=>model.isDefault)||models[0];
  if(!selected)throw new Error('Your signed-in Codex account has no available models.');
  return {models,selectedModel:selected.id,efforts:selected.efforts};
 }
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
  const reviewer=mode==='work'?(this.reviewer||'user'):'user';
  let started;
  try {
   started=await this.request(threadId?'thread/resume':'thread/start',{
    ...(threadId?{threadId,excludeTurns:true}:{}),cwd,runtimeWorkspaceRoots:[cwd],permissions,
    approvalPolicy:'on-request',approvalsReviewer:reviewer,modelProvider:'openai',
    developerInstructions:MODE_INSTRUCTIONS[mode]+' Work only in the selected workspace. Report modified files and test results. '+(mode==='work'&&this.reviewChanges?'Ask for one-time owner approval when a command or file change needs it.':'This companion declines additional permissions and command approvals.')+' Explain any action that needs separate owner approval. Never use API credentials or other providers.'+(this.publishTool&&mode==='work'?' To publish SessionTV, call the publish_sessiontv tool after checks and before your final reply. Report the push and live verification result from the tool. Do not attempt Git operations to publish through the shell.':'')
   });
  } catch(error) {
   if(/sandbox|MXC/i.test(error.message))throw new Error('Codex could not start its Windows sandbox. '+error.message);
   throw error;
  }
  const confirmedProfile=typeof started.activePermissionProfile==='string'?started.activePermissionProfile:started.activePermissionProfile?.id;
  if(confirmedProfile!==permissions||started.approvalPolicy!=='on-request'||started.approvalsReviewer!==reviewer||started.modelProvider!=='openai'||started.cwd!==cwd||
   started.runtimeWorkspaceRoots?.length!==1||started.runtimeWorkspaceRoots[0]!==cwd)throw new Error('Codex did not confirm the required restricted workspace policy. No coding turn was started.');
  if(!threadId)await this.request('thread/name/set',{threadId:started.thread.id,name:'Session TV · '+mode[0].toUpperCase()+mode.slice(1)});
  return started.thread.id;
 }
 async start(cwd,prompt,threadId,mode='work',requestedEffort,image){
  this.currentMode=mode;
  const id=await this.prepare(cwd,mode,threadId);
  const catalog=await this.models();
  const effort=mode==='work'?(requestedEffort||'medium'):'low';
  const model=mode==='work'?catalog.selectedModel:'gpt-6-luna';
  const chosen=catalog.models.find(value=>value.id===model);
  if(!chosen)throw new Error('GPT-6 Luna is unavailable for this Codex account. Plan and Apply require Luna Light.');
  if(!['low','medium','high','xhigh'].includes(effort)||!(chosen.efforts||catalog.efforts).includes(effort))throw new Error('The latest available Codex model does not support '+effort+' effort. Choose a supported effort.');
  this.emit('event',{method:'sessiontv/model',params:{model,effort,displayName:catalog.models.find(value=>value.id===model).displayName}});
  const permissions=mode==='work'?'sessiontv':'sessiontv_'+mode;
  this.emit('event',{method:'sessiontv/thread',params:{threadId:id}});
  await this.request('turn/start',{threadId:id,input:[{type:'text',text:prompt},...(image?[{type:'image',url:image}]:[])],model,effort,permissions,approvalPolicy:'on-request'});
  return id;
 }
 stop(error=new Error('Codex disconnected.')) {
  if(this.closed)return;this.closed=true;
  for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error)}this.pending.clear();
  this.process.kill();this.emit('stopped',error);
 }
}
function toml(value){
 if(Array.isArray(value))return '['+value.map(toml).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.entries(value).map(([key,v])=>JSON.stringify(key)+'='+toml(v)).join(',')+'}';
 return JSON.stringify(value);
}

export const MODE_INSTRUCTIONS={
 plan:'You are the project task planning coach. Help organize tasks and decide whether the user (Me) or Codex should own each. Use one assignment board, without sprint dates, goals, points, estimates, or ceremonies. Ask concise questions and use the project context. Do not implement or edit project files. Your filesystem access is read-only.',
 apply:'You are a learning coach. The user builds this project independently to practice previously learned skills. Offer the smallest useful hint, ask what they have tried, connect the task to their skills, and ask them to explain their reasoning. Do not write their implementation or change files. Your filesystem access is read-only.',
 work:'You are the implementation coach. Build the requested project changes in the linked folder, explain what you are doing and why, describe concepts and tradeoffs, and report verification results. After meaningful changes ask one or two short questions to help the user learn. Avoid unrelated modifications.'
};
