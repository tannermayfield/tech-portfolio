import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CodexBridge} from './codex.mjs';
import {folderStore} from './folders.mjs';
import {voiceService} from './voice.mjs';
import {chatGPTService} from './chatgpt.mjs';
import {canvasService} from './canvas.mjs';

const failure=(status,message)=>Object.assign(new Error(message),{status});
const secret=()=>randomBytes(24).toString('base64url');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
async function readJSON(req){let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>32000)throw failure(413,'Request too large.')}try{return JSON.parse(data)}catch{throw failure(400,'Invalid JSON.')}}
export async function canonicalWorkspaces(values){
 const roots=[];for(const value of values){const root=await realpath(value);if(!(await stat(root)).isDirectory()||path.parse(root).root===root)throw new Error('Select a project directory, not a filesystem root.');roots.push(root)}
 if(!roots.length)throw new Error('Select at least one project directory with SESSIONTV_WORKSPACES (JSON array).');return [...new Set(roots)];
}
export function createCompanion({origin='https://tannermayfield.dev',supabaseUrl,publishableKey,ownerId,workspaces,home,executable='codex',port=4319,verifyUser,bridgeFactory=opts=>new CodexBridge(opts),now=Date.now,deviceToken,configPath,pickFolder,openFolder,voice=voiceService(),chatgpt,canvas}){
 if(!/^https:\/\//.test(supabaseUrl||'')||!publishableKey||!ownerId||!home||!workspaces?.length)throw new Error('Supabase URL, public key, owner UUID, dedicated CODEX_HOME and selected workspaces are required.');
 if(new URL(origin).origin!==origin)throw new Error('SESSIONTV_ORIGIN must be an exact origin.');
 const generalChat=chatgpt||chatGPTService({home});
 const schoolCanvas=canvas||canvasService({home});
 const chatRequest=async request=>{try{return await request}catch(error){if([401,403].includes(error.status))throw failure(424,error.message);throw error}};
 const folders=folderStore({configPath,initialWorkspaces:workspaces,home,pickFolder,openFolder});
 const code=secret(),expires=now()+600000,pairs=new Map();let attempts=0,paired=false,active=null,activeConfirmed=false,operation=false,generalRun=null;
 let codexLogin=null,codexLoginState={pending:false,connected:false,error:null};
 function endCodexLogin(record,state){
  if(codexLogin!==record)return;
  codexLogin=null;clearTimeout(record.timer);record.bridge.removeListener('event',record.onEvent);record.bridge.removeListener('stopped',record.onStopped);
  codexLoginState={pending:false,connected:!!state.connected,error:state.error||null};record.bridge.stop();
 }
 function expireCodexLogin(){if(codexLogin&&now()>=codexLogin.expires)endCodexLogin(codexLogin,{error:'Codex sign-in expired. Please connect again.'});}
 async function connectCodex(){
  expireCodexLogin();
  if(codexLogin){if(!codexLogin.authUrl)throw failure(409,'Codex sign-in is starting. Try again shortly.');return {...codexLoginState,authUrl:codexLogin.authUrl,loginId:codexLogin.loginId};}
  if(active||operation||codexLogin)throw failure(409,'A computer request is already running. Finish it before connecting Codex.');
  operation=true;let bridge,record;
  try{
   bridge=bridgeFactory({executable,home,cwd:folders.workspaces[0]});await bridge.initialize();
   const account=await bridge.account();
   if(account.signedIn){codexLoginState={pending:false,connected:true,error:null};return {...codexLoginState,authUrl:null,loginId:null};}
   record={bridge,loginId:null,authUrl:null,expires:now()+300000,early:[],finishing:false};
   record.onEvent=event=>{
    if(event.method!=='account/login/completed')return;
    if(!record.loginId){if(record.early.length<8)record.early.push(event);return;}
    if(codexLogin!==record||event.params?.loginId!==record.loginId||record.finishing)return;
    record.finishing=true;
    if(event.params.success!==true){endCodexLogin(record,{error:'Codex sign-in was canceled or could not be completed. Try again.'});return;}
    bridge.account().then(account=>{
     endCodexLogin(record,account.signedIn?{connected:true}:{error:'Codex did not confirm a ChatGPT sign-in. Connect again.'});
    }).catch(()=>endCodexLogin(record,{error:'Codex sign-in could not be verified. Connect again.'}));
   };
   record.onStopped=()=>endCodexLogin(record,{error:'Codex stopped before sign-in completed. Connect again.'});
   bridge.on('event',record.onEvent);bridge.on('stopped',record.onStopped);codexLogin=record;codexLoginState={pending:true,connected:false,error:null};
   record.timer=setTimeout(()=>endCodexLogin(record,{error:'Codex sign-in expired. Please connect again.'}),300000);record.timer.unref?.();
   const result=await bridge.request('account/login/start',{type:'chatgpt',useHostedLoginSuccessPage:true,appBrand:'codex'});
   let authorization;try{authorization=new URL(result.authUrl);}catch{throw failure(503,'Codex returned an invalid sign-in link. Update Codex and retry.');}
   if(result.type!=='chatgpt'||typeof result.loginId!=='string'||!result.loginId||result.loginId.length>200||authorization.protocol!=='https:'||authorization.username||authorization.password||authorization.port||['access_token','refresh_token','id_token','id_token_hint','api_key'].some(key=>authorization.searchParams.has(key))||!['auth.openai.com','chatgpt.com'].includes(authorization.hostname))throw failure(503,'Codex returned an invalid sign-in link. Update Codex and retry.');
   if(codexLogin!==record)throw failure(503,'Codex stopped before sign-in started. Connect again.');
   record.authUrl=authorization.href;record.loginId=result.loginId;
   for(const event of record.early)record.onEvent(event);record.early=[];
   return {...codexLoginState,authUrl:record.authUrl,loginId:record.loginId};
  }catch(error){if(record)endCodexLogin(record,{error:'Codex sign-in could not start. Update Codex and try again.'});throw error.status?error:failure(503,'Codex sign-in could not start. Check that Codex is installed and try again.');}
  finally{if(bridge&&codexLogin?.bridge!==bridge)bridge.stop();operation=false;}
 }
 const verify=verifyUser||(async token=>{
  const response=await fetch(new URL('/auth/v1/user',supabaseUrl),{headers:{apikey:publishableKey,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw failure(401,'Your Supabase session is invalid. Sign in again.');return response.json();
 });
 function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value))}
 async function authorize(req,pair=true){
  const token=req.headers.authorization?.match(/^Bearer ([^\s]+)$/)?.[1];if(!token)throw failure(401,'Sign in to your private workspace first.');
  const user=await verify(token);if(user?.id!==ownerId)throw failure(403,'Only the configured owner can access this companion.');
  if(pair&&!(deviceToken&&equal(req.headers['x-sessiontv-pair'],deviceToken))){const record=pairs.get(req.headers['x-sessiontv-pair']);if(!record||record.userId!==user.id||record.expires<=now())throw failure(401,'Pair the local companion again.');}
  return user;
 }
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  try{
   if(req.headers.host!=='127.0.0.1:'+server.address().port||req.headers.origin!==origin)throw failure(403,'Host or origin not allowed.');
   res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
   if(req.method==='OPTIONS'){
    res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, X-SessionTV-Pair');
    res.writeHead(204);res.end();return;
   }
   if(req.method!=='POST'||!req.headers['content-type']?.startsWith('application/json'))throw failure(405,'Use a JSON POST request.');
   const route=new URL(req.url,'http://127.0.0.1').pathname;
   if(route==='/pair'){
    const user=await authorize(req,false),body=await readJSON(req);
    if(paired||now()>expires||++attempts>10||!equal(body.code,code))throw failure(403,'Pairing code expired or invalid. Restart the companion for a new code.');
    paired=true;const token=deviceToken||secret();pairs.set(token,{userId:user.id,expires:now()+1800000});json(res,200,{token,remember:!!deviceToken,expiresIn:deviceToken?null:1800});return;
   }
   await authorize(req);
   if(route.startsWith('/canvas/')){
    const body=await readJSON(req);
    if(route==='/canvas/status'){json(res,200,await chatRequest(schoolCanvas.status()));return;}
    if(route==='/canvas/connect'){json(res,200,await chatRequest(schoolCanvas.connect({token:body.token})));return;}
    if(route==='/canvas/disconnect'){json(res,200,await chatRequest(schoolCanvas.disconnect()));return;}
    if(route==='/canvas/snapshot'){json(res,200,await chatRequest(schoolCanvas.snapshot()));return;}
    throw failure(404,'Unknown Canvas endpoint.');
   }
   if(route==='/codex/connect'||route==='/codex/login-status'){
    await readJSON(req);expireCodexLogin();
    if(route==='/codex/connect'){json(res,200,await connectCodex());return;}
    if(codexLogin||active||operation){json(res,200,codexLogin?codexLoginState:{pending:false,connected:activeConfirmed||codexLoginState.connected,error:codexLoginState.error});return;}
    operation=true;let bridge;
    try{bridge=bridgeFactory({executable,home,cwd:folders.workspaces[0]});await bridge.initialize();const account=await bridge.account();codexLoginState={pending:false,connected:!!account.signedIn,error:account.signedIn?null:codexLoginState.error};}
    catch{codexLoginState={pending:false,connected:false,error:'Codex could not be reached. Check that Codex is installed and connect again.'};}
    finally{bridge?.stop();operation=false;}
    json(res,200,codexLoginState);return;
   }
   if(route.startsWith('/chatgpt/')){
    const body=await readJSON(req);
    if(route==='/chatgpt/status'){json(res,200,await chatRequest(generalChat.status()));return}
    if(route==='/chatgpt/connect'){json(res,200,await chatRequest(generalChat.begin()));return}
    if(route==='/chatgpt/disconnect'){generalRun?.abort();const result=await chatRequest(generalChat.disconnect());json(res,200,result||{disconnected:true});return}
    if(route==='/chatgpt/models'){const catalog=await chatRequest(generalChat.models());json(res,200,Array.isArray(catalog)?{models:catalog.map(model=>({slug:model.id,display_name:model.displayName}))}:catalog);return}
    if(route!=='/chatgpt/run')throw failure(404,'Unknown ChatGPT endpoint.');
    if(generalRun)throw failure(409,'A ChatGPT request is already running.');
    if(typeof body.model!=='string'||!body.model||body.model.length>200)throw failure(400,'Choose an available ChatGPT model.');
    if(body.effort!==undefined&&!['low','medium','high','xhigh'].includes(body.effort))throw failure(400,'Choose a supported reasoning effort.');
    if(!Array.isArray(body.messages)||!body.messages.length||body.messages.length>100||body.messages.some(message=>!message||!['user','assistant'].includes(message.role)||typeof message.content!=='string'||message.content.length>16000))throw failure(400,'Invalid ChatGPT conversation.');
    const controller=generalRun=new AbortController();const abort=()=>controller.abort();
    res.on('close',abort);const timer=setTimeout(abort,1800000);
    try{
     // Keep OAuth credentials in the companion; only safe stream events reach the browser.
     res.writeHead(200,{'Content-Type':'application/x-ndjson','X-Accel-Buffering':'no'});res.flushHeaders();
     await generalChat.run({model:body.model,effort:body.effort,messages:body.messages,signal:controller.signal,onEvent:event=>{if(!res.destroyed)res.write(JSON.stringify(event)+'\n')}});
    }catch(error){if(!res.destroyed)res.write(JSON.stringify({type:'error',message:error.message||'ChatGPT request failed.'})+'\n')}
    finally{clearTimeout(timer);res.removeListener('close',abort);if(generalRun===controller)generalRun=null;res.end()}
    return;
   }
   if(route==='/voice/voices'||route==='/voice/speak'){
    const body=await readJSON(req),controller=new AbortController();
    const abort=()=>controller.abort();res.on('close',abort);
    const timer=setTimeout(abort,190000);
    try {
     if(route==='/voice/voices'){json(res,200,await voice.voices(body,controller.signal));return}
     const audio=await voice.speak(body,controller.signal);res.writeHead(200,{'Content-Type':audio.type});res.end(audio.body);return;
    } finally {clearTimeout(timer);res.removeListener('close',abort)}
   }
   if(route==='/disconnect'){if(codexLogin)endCodexLogin(codexLogin,{error:'Codex sign-in was canceled.'});pairs.delete(req.headers['x-sessiontv-pair']);active?.stop();generalRun?.abort();json(res,200,{disconnected:true});return}
   if(route==='/folders/pick'||route==='/folders/open'||route==='/projects/prepare'){
    if(active||operation||codexLogin)throw failure(409,'A computer request is already running. Wait for it to finish.');
    operation=true;let bridge;
    try {
     const body=await readJSON(req);
     if(route==='/folders/pick'){json(res,200,await folders.choose());return}
     if(route==='/folders/open'){json(res,200,await folders.open(body.folder));return}
     if(body.projectId!==undefined&&(typeof body.projectId!=='string'||!/^[a-z0-9-]{1,200}$/.test(body.projectId)))throw failure(400,'Invalid project reference.');
     const cwd=await folders.authorized(body.folder);
     bridge=bridgeFactory({executable,home,cwd});
     await bridge.initialize();
     json(res,200,await folders.prepare(cwd,bridge,body.projectId));
    } catch(error) {throw error.status?error:failure(503,error.message||'Project preparation failed. Try again.')}
    finally {bridge?.stop();operation=false}
   }
   if(route==='/models'){
    if(active||operation||codexLogin)throw failure(409,'A computer request is already running. Try loading models when it finishes.');
    operation=true;let bridge;
    try{
     const body=await readJSON(req),cwd=body.workspace?await folders.authorized(body.workspace):folders.workspaces[0];
     bridge=bridgeFactory({executable,home,cwd});
     await bridge.initialize();json(res,200,await bridge.models());
    }catch(error){throw error.status?error:failure(503,error.message||'Codex models are unavailable.')}
    finally{bridge?.stop();operation=false}
    return;
   }
   if(route==='/status'){
    expireCodexLogin();if(codexLogin){json(res,200,{connected:true,available:true,signedIn:false,loginPending:true,busy:false,workspaces:folders.workspaces});return;}
    if(active||operation){json(res,200,{connected:true,available:activeConfirmed,signedIn:activeConfirmed,busy:true,workspaces:folders.workspaces});return}
    const bridge=bridgeFactory({executable,home,cwd:folders.workspaces[0]});
    try{await bridge.initialize();const account=await bridge.account();json(res,200,{connected:true,available:true,...account,workspaces:folders.workspaces,chatgpt:await generalChat.status().catch(()=>({connected:false,error:'Check your ChatGPT connection in Session Preferences.'}))})}
    catch(error){json(res,200,{connected:true,available:false,signedIn:false,error:error.message,workspaces:folders.workspaces});if(/Codex could not start|Codex app-server stopped/.test(error.message))server.emit('codex-restart-needed')}finally{bridge.stop()};return;
   }
   if(route!=='/run')throw failure(404,'Unknown endpoint.');
   if(active||operation||codexLogin)throw failure(409,'A coding request is already running.');
   const body=await readJSON(req);if(typeof body.prompt!=='string'||!body.prompt.trim()||body.prompt.length>16000)throw failure(400,'Enter a coding request (up to 16,000 characters).');
   if(typeof body.workspace!=='string')throw failure(400,'Select an authorized workspace.');
   const cwd=await folders.authorized(body.workspace);
   if(body.mode!==undefined&&!['plan','apply','work'].includes(body.mode))throw failure(400,'Choose Plan, Apply, or Work.');
   if(body.effort!==undefined&&!['low','medium','high','xhigh'].includes(body.effort))throw failure(400,'Choose Light, Medium, High, or Extra high effort.');
   const bridge=active=bridgeFactory({executable,home,cwd});activeConfirmed=false;let timeout;
   const stop=()=>{clearTimeout(timeout);bridge.stop();if(active===bridge){active=null;activeConfirmed=false}};
   res.on('close',stop);
   const write=event=>{if(!res.destroyed)res.write(JSON.stringify(event)+'\n')};
   try{
    await bridge.initialize();res.writeHead(200,{'Content-Type':'application/x-ndjson','X-Accel-Buffering':'no'});res.flushHeaders();
    bridge.on('event',event=>{
     write(event);if(event.method==='turn/completed'){stop();res.end()}
    });
    bridge.on('stopped',error=>{if(!res.destroyed&&!res.writableEnded){write({method:'sessiontv/stopped',params:{error:error.message}});res.end()}});
    timeout=setTimeout(()=>{write({method:'sessiontv/error',params:{error:'Request reached the 30-minute limit.'}});stop();res.end()},1800000);
    if(body.threadId!==undefined&&(typeof body.threadId!=='string'||body.threadId.length>200))throw failure(400,'Invalid chat reference.');
    await bridge.start(cwd,body.prompt,body.threadId,body.mode,body.effort);if(active===bridge)activeConfirmed=true;
   }catch(error){if(res.headersSent){write({method:'sessiontv/error',params:{error:error.message}});res.end()}else throw error;stop()}
  }catch(error){if(!res.headersSent)json(res,error.status||500,{error:error.status?error.message:'Companion request failed. Check local setup.'});else res.end()}
 });
 server.on('close',()=>{if(codexLogin)endCodexLogin(codexLogin,{error:'Codex sign-in was canceled.'});active?.stop();generalRun?.abort();generalChat.close?.();schoolCanvas.close?.()});
 return {server,pairingCode:code,listen:()=>new Promise(resolve=>server.listen(port,'127.0.0.1',resolve))};
}
async function main(){
 const env=process.env;
 if(!env.SESSIONTV_CODEX_HOME)throw new Error('Start the companion with Start Session TV.cmd to load your saved setup.');
 const home=await realpath(env.SESSIONTV_CODEX_HOME);
 const workspaces=await canonicalWorkspaces(JSON.parse(env.SESSIONTV_WORKSPACES||'[]'));
 if(workspaces.some(root=>home===root||home.startsWith(root+path.sep)))throw new Error('Keep the Codex credential profile outside selected project directories.');
 const companion=createCompanion({supabaseUrl:env.SUPABASE_URL,publishableKey:env.SUPABASE_PUBLISHABLE_KEY,ownerId:env.SESSIONTV_OWNER_ID,origin:env.SESSIONTV_ORIGIN||'https://tannermayfield.dev',home,workspaces,configPath:env.SESSIONTV_CONFIG_PATH||path.join(env.LOCALAPPDATA||path.dirname(home),'SessionTV-Companion','settings.json'),deviceToken:env.SESSIONTV_DEVICE_TOKEN,executable:env.SESSIONTV_CODEX_BINARY||'codex',port:Number(env.SESSIONTV_COMPANION_PORT||4319)});
 companion.server.once('codex-restart-needed',()=>{companion.server.close(()=>process.exit(0))});
 await companion.listen();console.log('Session TV companion listening on 127.0.0.1:'+companion.server.address().port+'\nPairing code (one use, valid 10 minutes): '+companion.pairingCode+'\nAuthorized workspaces:\n'+workspaces.join('\n')+'\nStop with Ctrl+C. No API billing fallback is configured.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1});
