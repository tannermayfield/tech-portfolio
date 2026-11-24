import {mkdir,readFile,writeFile,rename,unlink,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const SCHOOL='https://byu.instructure.com';
const fail=(status,message)=>Object.assign(new Error(message),{status});
const id=value=>(typeof value==='number'&&Number.isSafeInteger(value)&&value>0)||(typeof value==='string'&&/^[1-9]\d{0,19}$/.test(value))?String(value):null;
const text=(value,length=1000)=>typeof value==='string'?value.slice(0,length):'';
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
function safeUrl(value,fallback){try{const url=new URL(value);if(url.origin===SCHOOL&&!url.username&&!url.password)return url.href;}catch{}return fallback;}
function apiUrl(value){
 let url;try{url=new URL(value,SCHOOL);}catch{throw fail(502,'Canvas returned an invalid pagination link.');}
 if(url.origin!==SCHOOL||url.username||url.password||url.hash||!url.pathname.startsWith('/api/v1/')||[...url.searchParams.keys()].some(key=>/token|authorization/i.test(key)))throw fail(502,'Canvas returned an unsafe pagination link. Sync was stopped.');
 return url.href;
}
// This connector only reads BYU Canvas; access tokens remain in protected local storage.
export function canvasService({home,fetchImpl=globalThis.fetch}={}){
 if(!home)throw new Error('A local Canvas storage directory is required.');
 const directory=join(home,'canvas'),filename=join(directory,'connection.json');
 let queue=Promise.resolve(),generation=0,controller=null,lastError=null;
 const serial=fn=>{const work=queue.catch(()=>{}).then(fn);queue=work;return work;};
 async function secure(path,isDirectory=false){
  if(process.platform==='win32'){
   const {stdout}=await exec('whoami.exe',[],{windowsHide:true,timeout:10000});const owner=stdout.trim();
   if(!owner||/[\r\n]/.test(owner))throw new Error();
   await exec('icacls.exe',[path,'/inheritance:r','/grant:r',`${owner}:${isDirectory?'(OI)(CI)':''}F`],{windowsHide:true,timeout:10000});
  }else await chmod(path,isDirectory?0o700:0o600);
 }
 async function read(){try{return JSON.parse(await readFile(filename,'utf8'));}catch(error){if(error.code==='ENOENT')return {};throw fail(503,'Local Canvas settings could not be read.');}}
 async function save(record,version){
  let temporary;
  try{
   await mkdir(directory,{recursive:true,mode:0o700});await secure(directory,true);
   temporary=join(directory,`.${randomUUID()}.tmp`);await writeFile(temporary,JSON.stringify(record),{flag:'wx',mode:0o600});await secure(temporary);
   if(version!==generation)throw fail(499,'Canvas request canceled.');
   await rename(temporary,filename);
  }catch(error){throw error.status?error:fail(503,'Could not securely save local Canvas settings.');}
  finally{if(temporary)await unlink(temporary).catch(()=>{});}
 }
 async function get(address,token,signal){
  const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(20000)]);
  let response;try{response=await fetchImpl(apiUrl(address),{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal:requestSignal});}
  catch{if(signal.aborted)throw fail(499,'Canvas request canceled or timed out.');throw fail(503,'BYU Canvas could not be reached. Try again later.');}
  if(response.status===401)throw fail(424,'Your Canvas token expired or was revoked. Create a new token and reconnect.');
  if(response.status===403)throw fail(424,'Canvas denied access. Check that your token can read your profile, courses, and assignments.');
  if(response.status===429)throw fail(429,'Canvas is limiting requests. Wait a few minutes before syncing again.');
  if(response.status>=300&&response.status<400)throw fail(502,'Canvas redirected the request. Sync was stopped to protect your token.');
  if(!response.ok)throw fail(502,'Canvas could not complete this sync. Your previous imported data was kept.');
  if(response.url&&new URL(response.url).origin!==SCHOOL)throw fail(502,'Canvas returned an unexpected response location.');
  let body;try{
   if(Number(response.headers.get('content-length'))>8000000)throw new Error();
   // Bound the decoded body even when the upstream omits Content-Length.
   const reader=response.body?.getReader();let result='';
   if(reader){const decoder=new TextDecoder();let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8000000)throw new Error();result+=decoder.decode(value,{stream:true});}result+=decoder.decode();}finally{await reader.cancel().catch(()=>{});}body=JSON.parse(result);}
   else body=await response.json();
  }catch{throw fail(502,'Canvas returned an invalid or oversized response.');}
  return {body,link:response.headers.get('link')};
 }
 async function pages(address,token,signal,budget){
  const items=[],seen=new Set();let next=apiUrl(address);
  while(next){
   if(seen.has(next)||seen.size>=40||++budget.pages>150)throw fail(502,'Canvas pagination exceeded the supported sync limit. No data was imported.');seen.add(next);
   const {body,link}=await get(next,token,signal);if(!Array.isArray(body)||body.length>1000)throw fail(502,'Canvas returned an invalid list.');
   items.push(...body);if(items.length>10000)throw fail(502,'Canvas returned too many records for one sync.');
   next=null;
   if(link){for(const part of link.split(/,(?=\s*<)/)){const match=part.match(/^\s*<([^>]+)>\s*;.*\brel\s*=\s*"?([^";]+)"?/i);if(match&&match[2].trim().split(/\s+/).includes('next')){if(next)throw fail(502,'Canvas returned ambiguous pagination.');next=apiUrl(match[1]);}}}
  }
  return items;
 }
 async function profile(token,signal){
  const {body}=await get('/api/v1/users/self/profile',token,signal),accountId=id(body?.id);
  if(!accountId||typeof body.name!=='string')throw fail(502,'Canvas returned an invalid account profile.');
  return {id:accountId,name:text(body.name,300)};
 }
 async function requestScope(fn){controller=new AbortController();const current=controller,timer=setTimeout(()=>current.abort(),120000);timer.unref?.();try{return await fn(current.signal);}finally{clearTimeout(timer);if(controller===current)controller=null;}}
 function view(record,connected=!!record.token){return {connected,schoolUrl:SCHOOL,account:record.account||null,lastSync:record.lastSync||null,...(lastError?{error:lastError}:{})};}
 function status(){return serial(async()=>{
  const record=await read();if(!record.token)return view(record,false);
  try{return await requestScope(async signal=>{const account=await profile(record.token,signal);lastError=null;return view({...record,account},true);});}
  catch(error){lastError=error.message;return view(record,false);}
 });}
 function connect({token}={}){
  const version=generation;
  return serial(async()=>{
   if(typeof token!=='string'||token.trim().length<10||token.trim().length>4096||/\s/.test(token.trim()))throw fail(400,'Paste your Canvas access token.');
   token=token.trim();
   return requestScope(async signal=>{
    try{const account=await profile(token,signal);if(version!==generation)throw fail(499,'Canvas request canceled.');await save({token,account,validatedAt:new Date().toISOString(),lastSync:null},version);lastError=null;return view({token,account},true);}
    catch(error){lastError=error.message;throw error;}
   });
  });
 }
 function snapshot(){
  const version=generation;
  return serial(async()=>{
   const record=await read();if(!record.token)throw fail(424,'Connect your BYU Canvas token before syncing.');
   return requestScope(async signal=>{
    try{
     const account=await profile(record.token,signal),budget={pages:0};
     const sourceCourses=await pages('/api/v1/courses?enrollment_type=student&enrollment_state=active&per_page=100',record.token,signal,budget);
     const courses=[],assignments=[],knownCourses=new Set(),knownAssignments=new Set();
     for(const course of sourceCourses){
      const courseId=id(course?.id);if(!courseId||typeof course.name!=='string')throw fail(502,'Canvas returned an invalid course.');if(knownCourses.has(courseId))continue;knownCourses.add(courseId);
      if(courses.length>=100)throw fail(502,'Canvas returned too many courses for one sync.');
      courses.push({id:courseId,name:text(course.name,1000),code:text(course.course_code,300),url:safeUrl(course.html_url,`${SCHOOL}/courses/${courseId}`)});
      const sourceAssignments=await pages(`/api/v1/courses/${courseId}/assignments?include%5B%5D=submission&per_page=100`,record.token,signal,budget);
      for(const assignment of sourceAssignments){
       const assignmentId=id(assignment?.id);if(!assignmentId||typeof assignment.name!=='string')throw fail(502,'Canvas returned an invalid assignment.');
       if(assignment.course_id!==undefined&&String(assignment.course_id)!==courseId)throw fail(502,'Canvas returned an assignment for the wrong course.');
       const unique=courseId+':'+assignmentId;if(knownAssignments.has(unique))continue;knownAssignments.add(unique);if(assignments.length>=10000)throw fail(502,'Canvas returned too many assignments for one sync.');
       const submission=assignment.submission||{},submittedAt=date(submission.submitted_at),workflowState=text(submission.workflow_state,100)||'unsubmitted';
       const submitted=!!submittedAt||['submitted','graded','pending_review'].includes(workflowState);
       assignments.push({id:assignmentId,courseId,title:text(assignment.name,2000),submissionTypes:Array.isArray(assignment.submission_types)?assignment.submission_types.filter(type=>typeof type==='string').slice(0,10).map(type=>text(type,50)):[],isQuizAssignment:assignment.is_quiz_assignment===true,quizId:id(assignment.quiz_id)||null,discussionTopic:!!assignment.discussion_topic,description:text(assignment.description,100000),dueAt:date(submission.cached_due_date)||date(assignment.due_at),points:typeof assignment.points_possible==='number'&&Number.isFinite(assignment.points_possible)?assignment.points_possible:null,url:safeUrl(assignment.html_url,`${SCHOOL}/courses/${courseId}/assignments/${assignmentId}`),submission:{submitted,missing:!submitted&&submission.missing===true,submittedAt,workflowState}});
      }
     }
     if(version!==generation)throw fail(499,'Canvas request canceled.');const syncedAt=new Date().toISOString();await save({...record,account,lastSync:syncedAt},version);lastError=null;return {account,courses,assignments,syncedAt};
    }catch(error){lastError=error.message;throw error;}
   });
  });
 }
 function disconnect(){++generation;controller?.abort();return serial(async()=>{try{await unlink(filename);}catch(error){if(error.code!=='ENOENT')throw fail(503,'Could not remove the local Canvas connection.');}lastError=null;return {connected:false,schoolUrl:SCHOOL,account:null,lastSync:null};});}
 function close(){++generation;controller?.abort();}
 return {status,connect,snapshot,disconnect,close};
}
