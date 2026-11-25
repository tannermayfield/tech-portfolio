/* Read-only BYU Canvas imports. Access tokens stay only in the local companion. */
(() => {
 const school='https://byu.instructure.com';
 let container=null,connection=null,active=null,controller=null,epoch=0,resumeTimer=null,lastAuto=0,pendingAuto=false,pendingForce=false,message='',disconnecting=false;
 let mutationQueue=Promise.resolve(),mutationPending=0;
 const privateUser=()=>globalThis.SessionWorkspace?.mode==='private'&&!!globalThis.SessionCloud?.user;
 const current=e=>e===epoch&&privateUser();
 const enabled=()=>recall('sb.canvasSync',true)!==false;
 const button=(text,action)=>{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=text;b.onclick=action;return b};
 function safeError(error,fallback){return /^(Canvas |Your Canvas |BYU Canvas )/.test(error?.message||'')?error.message:fallback}
 function safeURL(value){try{const u=new URL(value);return u.origin===school&&!u.username&&!u.password?u.href:''}catch{return ''}}
 function description(value){const doc=new DOMParser().parseFromString(String(value||''),'text/html');doc.querySelectorAll('script,style,iframe,object').forEach(node=>node.remove());doc.querySelectorAll('br').forEach(node=>node.replaceWith('\n'));doc.querySelectorAll('p,div,li,h1,h2,h3,h4,blockquote,tr').forEach(node=>node.append('\n'));return (doc.body.textContent||'').replace(/\n{3,}/g,'\n\n').trim()}
 function dates(value){const d=new Date(value);if(!value||!Number.isFinite(d.getTime()))return {due:'',dueTime:''};const pad=v=>String(v).padStart(2,'0');return {due:d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()),dueTime:pad(d.getHours())+':'+pad(d.getMinutes())}}
 // Assignment type from Canvas metadata (raw API or camelCase snapshot fields), then quiz/exam wording; null lets the overview fall back to title keywords.
 function kind(assignment){
  const types=[].concat(assignment.submissionTypes??assignment.submission_types??[]).map(type=>String(type).toLowerCase()),title=String(assignment.title||assignment.name||'');
  const exam=/\b(exam|midterm)s?\b/i.test(title)||(/\bfinals?\b/i.test(title)&&!/\b(projects?|labs?|papers?|reports?|presentations?)\b/i.test(title));
  if(assignment.isQuizAssignment===true||assignment.is_quiz_assignment===true||assignment.quizId||assignment.quiz_id||types.includes('online_quiz'))return exam?'exam':'quiz';
  if(types.includes('discussion_topic')||assignment.discussionTopic||assignment.discussion_topic)return 'discussion';
  if(exam)return 'exam';if(/\bquiz(?:zes)?\b/i.test(title))return 'quiz';return null;
 }
 function render(){
  if(!container||!privateUser())return;container.replaceChildren();
  const title=document.createElement('h4');title.textContent='BYU Canvas';container.append(title);
  const state=document.createElement('p');state.setAttribute('role','status');state.textContent=message||(connection?.connected?'Connected'+(connection.account?.name?' · '+connection.account.name:''):connection?.error||'Not connected');container.append(state);
  const last=document.createElement('p');last.className='canvas-note';const date=recall('sb.canvasLastSync',null);last.textContent=date?'Last successful sync: '+new Date(date).toLocaleString():'No successful sync yet.';container.append(last);
  const note=document.createElement('p');note.className='canvas-note';note.textContent='Imports classes, assignments, deadlines and submission status. Changes in SessionTV do not update Canvas. Automatic sync runs once per day when you first open the site online. Use Sync now for additional updates.';container.append(note);
  if(!connection?.connected){
   const steps=document.createElement('p');steps.className='canvas-note';steps.textContent='In BYU Canvas, open Account → Settings → Approved Integrations → New Access Token. Use SessionTV as the purpose, choose an expiration, then paste the token here.';
   const link=document.createElement('a');link.href=school+'/profile/settings';link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open BYU Canvas settings';
   const input=document.createElement('input');input.type='password';input.autocomplete='off';input.setAttribute('aria-label','Canvas access token');input.placeholder='Canvas access token';
   const form=document.createElement('form');form.className='canvas-connect';const submit=document.createElement('button');submit.className='btn';submit.type='submit';submit.textContent='Connect Canvas';form.append(input,submit);
   form.onsubmit=async event=>{event.preventDefault();if(!privateUser()||active||disconnecting||!input.value.trim())return;const e=epoch;submit.disabled=true;const abort=new AbortController();controller=abort;try{await SessionCompanion.connectCanvas(input.value.trim(),abort.signal);if(!current(e))return;message='';await refresh();if(current(e)&&connection?.connected)await sync()}catch(error){if(current(e)){message=safeError(error,'Could not connect Canvas. Check the token, its expiration, and the local companion.');render()}}finally{input.value='';if(controller===abort)controller=null;submit.disabled=false}};
   container.append(steps,link,form);
  }else{
   container.append(button(active?'Syncing…':'Sync now',()=>sync()),button('Disconnect',async()=>{epoch++;const e=epoch;controller?.abort();controller=null;active=null;clearTimeout(resumeTimer);resumeTimer=null;disconnecting=true;render();try{await SessionCompanion.disconnectCanvas();if(!current(e))return;connection={connected:false};store('sb.canvasAccount',null);message='';render()}catch{if(current(e)){message='Could not disconnect Canvas. Check the companion and retry.';render()}}finally{if(current(e)){disconnecting=false;render()}}}));
   const label=document.createElement('label');label.className='canvas-auto';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=enabled();checkbox.onchange=()=>{store('sb.canvasSync',checkbox.checked);resumeSchedule()};label.append(checkbox,'Sync automatically once per day');container.append(label);
  }
  container.append(button('Check status',refresh));for(const b of container.querySelectorAll('button'))if(disconnecting||(active&&b.textContent!=='Disconnect'))b.disabled=true;
 }
 async function refresh(){
  if(!privateUser())return;const e=epoch;
  try{const result=await SessionCompanion.canvasStatus();if(!current(e))return;connection=result;message='';render();return result}catch{if(current(e)){message='Canvas status unavailable. Check the local companion and pairing.';render()}}
 }
 function sync(){
  if(!privateUser()||disconnecting||mutationPending)return Promise.resolve();if(active)return active;
  const e=epoch,abort=new AbortController();controller=abort;
  active=(async()=>{
   try{
    if(!connection?.connected){const result=await refresh();if(!current(e)||!result?.connected)return}
    message='Syncing Canvas…';render();const snapshot=await snapshotRequest(abort.signal);if(!current(e)||abort.signal.aborted)return;
    if(!Array.isArray(snapshot.courses)||!Array.isArray(snapshot.assignments)||!snapshot.account?.id)throw Error('Invalid Canvas snapshot');
    const account=String(snapshot.account.id),previous=recall('sb.canvasAccount',null);if(previous&&previous!==account)throw Error('Canvas account changed. Disconnect before connecting another account.');
    const classes=JSON.parse(JSON.stringify(recall('sb.classes',{}))),map={...recall('sb.canvasCourses',{})},excluded=new Set(recall('sb.canvasExcludedCourses',[]).map(String));
    for(const course of snapshot.courses){const id=String(course.id);if(!/^[0-9]+$/.test(id)||excluded.has(id))continue;let name=map[id];if(!name){name=String(course.code&&course.code!==course.name?course.code+' — '+course.name:course.name||course.code||'Canvas '+id);if(classes[name]&&String(classes[name].canvasId)!==id)name+=' (Canvas '+id+')';map[id]=name}classes[name]={code:String(course.code||''),name:String(course.name||''),...classes[name],canvasId:id,url:safeURL(course.url)};}
    for(const assignment of snapshot.assignments){
     if(!current(e)||abort.signal.aborted)return;const id=String(assignment.id),courseId=String(assignment.courseId);if(!/^[0-9]+$/.test(id)||!map[courseId]||excluded.has(courseId))continue;
     const key='canvas-'+courseId+'-'+id,existing=typeof T==='function'?T(key):tasks.find(task=>task.id===key),submission=assignment.submission||{};
     const patch={track:'class',title:String(assignment.title||'Canvas assignment'),description:description(assignment.description),course:map[courseId],...dates(assignment.dueAt),points:assignment.points??null,kind:kind(assignment),status:submission.submitted?'done':'todo',canvas:{assignmentId:id,courseId,accountId:account,url:safeURL(assignment.url),dueAt:assignment.dueAt||null,missing:!!submission.missing,submitted:!!submission.submitted,submittedAt:submission.submittedAt||null,workflowState:String(submission.workflowState||'')}};
     if(Object.keys(patch).some(field=>JSON.stringify(existing?.[field])!==JSON.stringify(patch[field]))){if(!current(e)||abort.signal.aborted)return;const doc=db.doc('tasks/'+key);if(existing)await doc.update(patch);else await doc.set(patch)}
    }
    if(!current(e))return;for(const [key,value] of [['sb.classes',classes],['sb.canvasCourses',map],['sb.canvasAccount',account],['sb.canvasAvailableCourses',snapshot.courses.map(course=>String(course.id))]]){if(!current(e))return;if(JSON.stringify(recall(key,null))!==JSON.stringify(value))store(key,value)}store('sb.canvasLastSync',new Date().toISOString());message='Canvas is up to date.';if(typeof renderGuide==='function'&&typeof TV!=='undefined'&&TV.mode==='guide')renderGuide();
   }catch(error){if(current(e))message=abort.signal.aborted?'':safeError(error,'Canvas sync failed. Your existing records were kept. Check the companion and try again.')}
   finally{if(controller===abort)controller=null;if(epoch===e)active=null;if(current(e))render()}
  })();return active;
 }
 function snapshotRequest(signal){
  return new Promise((resolve,reject)=>{
   const cancel=()=>reject(new DOMException('Canvas request canceled.','AbortError'));
   if(signal.aborted){cancel();return}signal.addEventListener('abort',cancel,{once:true});
   Promise.resolve().then(()=>SessionCompanion.canvasSnapshot(signal)).then(resolve,reject).finally(()=>signal.removeEventListener('abort',cancel));
  });
 }
 function automatic(force=false){
  if(!privateUser()||disconnecting||!connection?.connected||!enabled())return;
  if(document.hidden||navigator.onLine===false||mutationPending){pendingAuto=true;pendingForce=pendingForce||force;return}
  const now=new Date(),day=[now.getFullYear(),now.getMonth()+1,now.getDate()].join('-');
  if(recall('sb.canvasAutoSyncDay',null)===day)return;
  store('sb.canvasAutoSyncDay',day);
  pendingAuto=false;pendingForce=false;lastAuto=Date.now();sync();
 }
 function resumeSchedule(force=false){
  pendingForce=pendingForce||force;clearTimeout(resumeTimer);resumeTimer=setTimeout(()=>{resumeTimer=null;automatic(force||pendingForce)},200);
 }
 function mutateClasses(fn){
  if(!privateUser())return Promise.reject(Error('Sign in to edit classes.'));
  const e=epoch,pendingSync=active;mutationPending++;if(pendingSync)controller?.abort();clearTimeout(resumeTimer);resumeTimer=null;
  const result=mutationQueue.catch(()=>{}).then(async()=>{
   if(pendingSync)await pendingSync;
   if(!current(e))throw Error('Your workspace changed. Reopen class settings and try again.');
   return fn();
  });
  mutationQueue=result.finally(()=>{mutationPending--;if(pendingAuto)resumeSchedule()});
  // Keep the serialization chain handled even when the caller handles its own error.
  mutationQueue.catch(()=>{});return result;
 }
 function clear(){epoch++;controller?.abort();controller=null;clearTimeout(resumeTimer);resumeTimer=null;active=null;connection=null;lastAuto=0;pendingAuto=false;pendingForce=false;message='';disconnecting=false;container?.replaceChildren();container=null}
 function init(){if(!privateUser())return;refresh().then(result=>{if(privateUser()&&result?.connected)automatic(true)})}
 globalThis.SessionCanvas={mountSettings(node){if(!node||!privateUser())return;container=node;render();refresh()},sync,status:refresh,mutateClasses,get syncing(){return !!active},get connection(){return connection?JSON.parse(JSON.stringify(connection)):null}};
 addEventListener('sessiontv:auth',()=>{clear();init()});addEventListener('pagehide',clear);
 addEventListener('online',()=>resumeSchedule(true));
 addEventListener('focus',()=>resumeSchedule());
 addEventListener('pageshow',event=>{if(event.persisted)init();else resumeSchedule()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)resumeSchedule()});init();
})();