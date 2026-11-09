import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
const port=Number(process.env.PORT||4173),key=process.env.ANTHROPIC_API_KEY?.trim();
const model=process.env.ANTHROPIC_MODEL||'claude-sonnet-5-5';
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value))}
async function body(req){
 let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>256000)throw Object.assign(new Error('Request too large.'),{status:413})}
 try{return JSON.parse(text)}catch{throw Object.assign(new Error('Invalid JSON.'),{status:400})}
}
let inFlight=0;
export const server=http.createServer(async(req,res)=>{
 try{
  const host=req.headers.host;
  if(!host||!['127.0.0.1','localhost'].includes(host.split(':')[0]))return json(res,403,{error:'Local access only.'});
  if(req.headers.origin&&req.headers.origin!=='http://'+host)return json(res,403,{error:'Same-origin access only.'});
  const url=new URL(req.url,'http://'+host);
  if(url.pathname==='/api/config'&&req.method==='GET')return json(res,200,{aiConfigured:!!key,model:key?model:null});
  if(url.pathname==='/api/chat'&&req.method==='POST'){
   if(!key)return json(res,503,{error:'Add ANTHROPIC_API_KEY to .env and restart the server to enable Claude.'});
   if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'JSON required.'});
   const {messages}=await body(req);
   if(!Array.isArray(messages)||!messages.length||messages.length>50||messages.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||!m.content.trim()))return json(res,400,{error:'Invalid conversation.'});
   if(inFlight>=3)return json(res,429,{error:'Please wait for the current AI request.'});
   inFlight++;const controller=new AbortController();res.on('close',()=>controller.abort());
   try{
    const upstream=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',
     headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
     body:JSON.stringify({model,max_tokens:4096,messages:messages.map(({role,content})=>({role,content}))}),
     signal:AbortSignal.any([controller.signal,AbortSignal.timeout(90000)])});
    const result=await upstream.json();
    if(!upstream.ok)return json(res,upstream.status===429?429:502,{error:result.error?.message||'Claude could not answer. Check your API key and model.'});
    return json(res,200,{text:(result.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n')});
   }finally{inFlight--}
  }
  if(url.pathname.startsWith('/api/'))return json(res,404,{error:'Unknown API route.'});
  if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Method not allowed.'});
  let relative;try{relative=decodeURIComponent(url.pathname)}catch{return json(res,400,{error:'Invalid path.'})}
  if(relative.includes('\\')||relative.split('/').some(p=>p.startsWith('.')))return json(res,404,{error:'Not found.'});
  const file=path.resolve(root,'.'+(relative==='/'?'/index.html':relative));
  if(!file.startsWith(root+path.sep)||!(await stat(file)).isFile())return json(res,404,{error:'Not found.'});
  const contents=await readFile(file);
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});
  res.end(req.method==='HEAD'?undefined:contents);
 }catch(error){
  if(res.destroyed)return;
  if(['ENOENT','ENOTDIR'].includes(error.code))return json(res,404,{error:'Not found.'});
  json(res,error.status||500,{error:error.status?error.message:'Could not complete the request. Please try again.'});
 }
});
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 server.listen(port,'127.0.0.1',()=>console.log('Session TV is ready at http://127.0.0.1:'+server.address().port));
 server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'This port is in use. Change PORT in .env, then restart.':e.message);process.exitCode=1});
}
