import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CodexBridge} from './codex.mjs';
import {folderStore} from './folders.mjs';

const failure=(status,message)=>Object.assign(new Error(message),{status});
const secret=()=>randomBytes(24).toString('base64url');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
async function readJSON(req){let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>32000)throw failure(413,'Request too large.')}try{return JSON.parse(data)}catch{throw failure(400,'Invalid JSON.')}}
export async function canonicalWorkspaces(values){
 const roots=[];for(const value of values){const root=await realpath(value);if(!(await stat(root)).isDirectory()||path.parse(root).root===root)throw new Error('Select a project directory, not a filesystem root.');roots.push(root)}
 if(!roots.length)throw new Error('Select at least one project directory with SESSIONTV_WORKSPACES (JSON array).');return [...new Set(roots)];
}
export function createCompanion({origin='https://tannermayfield.dev',supabaseUrl,publishableKey,ownerId,workspaces,home,executable='codex',port=4319,verifyUser,bridgeFactory=opts=>new CodexBridge(opts),now=Date.now,deviceToken,configPath,pickFolder,openFolder}){
 if(!/^https:\/\//.test(supabaseUrl||'')||!publishableKey||!ownerId||!home||!workspaces?.length)throw new Error('Supabase URL, public key, owner UUID, dedicated CODEX_HOME and selected workspaces are required.');
 if(new URL(origin).origin!==origin)throw new Error('SESSIONTV_ORIGIN must be an exact origin.');
 const folders=folderStore({configPath,initialWorkspaces:workspaces,home,pickFolder,openFolder});
 const code=secret(),expires=now()+600000,pairs=new Map();let attempts=0,paired=false,active=null,activeConfirmed=false,operation=false;
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
   if(route==='/disconnect'){pairs.delete(req.headers['x-sessiontv-pair']);active?.stop();json(res,200,{disconnected:true});return}
   if(route==='/folders/pick'||route==='/folders/open'||route==='/projects/prepare'){
    if(active||operation)throw failure(409,'A computer request is already running. Wait for it to finish.');
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
   if(route==='/status'){
    if(active||operation){json(res,200,{connected:true,available:activeConfirmed,signedIn:activeConfirmed,busy:true,workspaces:folders.workspaces});return}
    const bridge=bridgeFactory({executable,home,cwd:folders.workspaces[0]});
    try{await bridge.initialize();const account=await bridge.account();json(res,200,{connected:true,available:true,...account,workspaces:folders.workspaces,chatgpt:{connected:false,reason:'General chat authorization has not been configured.'}})}
    catch(error){json(res,200,{connected:true,available:false,signedIn:false,error:error.message,workspaces:folders.workspaces})}finally{bridge.stop()};return;
   }
   if(route!=='/run')throw failure(404,'Unknown endpoint.');
   if(active||operation)throw failure(409,'A coding request is already running.');
   const body=await readJSON(req);if(typeof body.prompt!=='string'||!body.prompt.trim()||body.prompt.length>16000)throw failure(400,'Enter a coding request (up to 16,000 characters).');
   if(typeof body.workspace!=='string')throw failure(400,'Select an authorized workspace.');
   const cwd=await folders.authorized(body.workspace);
   if(body.mode!==undefined&&!['plan','apply','work'].includes(body.mode))throw failure(400,'Choose Plan, Apply, or Work.');
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
    await bridge.start(cwd,body.prompt,body.threadId,body.mode);if(active===bridge)activeConfirmed=true;
   }catch(error){if(res.headersSent){write({method:'sessiontv/error',params:{error:error.message}});res.end()}else throw error;stop()}
  }catch(error){if(!res.headersSent)json(res,error.status||500,{error:error.status?error.message:'Companion request failed. Check local setup.'});else res.end()}
 });
 server.on('close',()=>active?.stop());
 return {server,pairingCode:code,listen:()=>new Promise(resolve=>server.listen(port,'127.0.0.1',resolve))};
}
async function main(){
 const env=process.env;
 if(!env.SESSIONTV_CODEX_HOME)throw new Error('Start the companion with Start Session TV.cmd to load your saved setup.');
 const home=await realpath(env.SESSIONTV_CODEX_HOME);
 const workspaces=await canonicalWorkspaces(JSON.parse(env.SESSIONTV_WORKSPACES||'[]'));
 if(workspaces.some(root=>home===root||home.startsWith(root+path.sep)))throw new Error('Keep the Codex credential profile outside selected project directories.');
 const companion=createCompanion({supabaseUrl:env.SUPABASE_URL,publishableKey:env.SUPABASE_PUBLISHABLE_KEY,ownerId:env.SESSIONTV_OWNER_ID,origin:env.SESSIONTV_ORIGIN||'https://tannermayfield.dev',home,workspaces,configPath:env.SESSIONTV_CONFIG_PATH||path.join(env.LOCALAPPDATA||path.dirname(home),'SessionTV-Companion','settings.json'),deviceToken:env.SESSIONTV_DEVICE_TOKEN,executable:env.SESSIONTV_CODEX_BINARY||'codex',port:Number(env.SESSIONTV_COMPANION_PORT||4319)});
 await companion.listen();console.log('Session TV companion listening on 127.0.0.1:'+companion.server.address().port+'\nPairing code (one use, valid 10 minutes): '+companion.pairingCode+'\nAuthorized workspaces:\n'+workspaces.join('\n')+'\nStop with Ctrl+C. No API billing fallback is configured.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1});
