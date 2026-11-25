import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
// Serves the static app in public/ for local development (npm start / npm run dev).
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value))}
export const server=http.createServer(async(req,res)=>{
 try{
  const host=req.headers.host;
  if(!host||!['127.0.0.1','localhost'].includes(host.split(':')[0]))return json(res,403,{error:'Local access only.'});
  if(req.headers.origin&&req.headers.origin!=='http://'+host)return json(res,403,{error:'Same-origin access only.'});
  const url=new URL(req.url,'http://'+host);
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
