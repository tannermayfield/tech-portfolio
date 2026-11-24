/* Homework overview uses SessionTV records; no Canvas data is imported. */
(()=>{
 let active='due',course='all';const dialog=document.createElement('section');dialog.id='homework-overview';dialog.className='tv-sheet';dialog.hidden=true;dialog.setAttribute('aria-labelledby','homework-heading');
 dialog.innerHTML=`<div class="homework-shell"><header class="sheet-head row spread"><h2 id="homework-heading">Homework Overview</h2><button class="btn ghost" data-close>← Back</button></header><div class="homework-stats" role="group" aria-label="Assignment status"></div><div class="homework-toolbar"><label>Class <select id="homework-course"></select></label><div class="row"><button class="btn ghost" data-canvas>Canvas settings</button><button class="btn" data-add>+ Add Assignment</button></div></div><div class="homework-list" role="region" aria-label="Assignments" tabindex="0"></div></div>`;$('crt').append(dialog);
 let opener;
 function show(){dialog.hidden=false;dialog.classList.add('open');dialog.querySelector('[data-close]').focus({preventScroll:true})}
 function close(){if(dialog.hidden)return;dialog.hidden=true;dialog.classList.remove('open');if(opener?.isConnected)opener.focus({preventScroll:true})}
 for(const name of ['btn-menu','btn-set'])$(name)?.addEventListener('click',close,true);
 addEventListener('keydown',event=>{if(event.key==='Escape'&&!dialog.hidden&&!document.querySelector('dialog[open]')){event.stopImmediatePropagation();close()}},true);
 let linkCourse='';const linkDialog=document.createElement('dialog');linkDialog.className='confirm-dlg';linkDialog.id='homework-course-link';linkDialog.innerHTML='<div class="local-panel"><h2>Course link</h2><p data-course></p><form><label>Course website<input type="url" required name="url" placeholder="https://…"></label><div class="row"><button class="btn" type="submit">Save link</button><button class="btn ghost" type="button" data-cancel>Cancel</button></div></form><p role="status"></p></div>';document.body.append(linkDialog);linkDialog.querySelector('[data-cancel]').onclick=()=>{linkDialog.close();render();show()};linkDialog.querySelector('form').onsubmit=event=>{event.preventDefault();if(SessionWorkspace.mode==='demo')return;const url=safeURL(linkDialog.querySelector('input').value);if(!url){linkDialog.querySelector('[role=status]').textContent='Enter an http or https course link.';return}const classes=recall('sb.classes',{});store('sb.classes',{...classes,[linkCourse]:{...classes[linkCourse],url}});linkDialog.close();render();show()};
 const classify=(task,now=Date.now())=>{if(task.canvas?.submitted===true)return 'submitted';if(task.canvas?.submitted===false)return task.canvas.missing===true?'missing':'due';if(task.status==='done')return 'submitted';const deadline=task.due?new Date(task.due+'T'+(task.dueTime||'23:59')).getTime():Infinity;return deadline<now?'missing':'due'};
 // Line icons share the app's 24px grid; stroke styling lives in homework.css.
 const kinds={
  assignment:{label:'Assignment',svg:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9.5 12h5M9.5 16h5"/>'},
  exam:{label:'Exam',svg:'<path d="M9 4.5H6.5A1.5 1.5 0 0 0 5 6v13.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H15"/><rect x="9" y="3" width="6" height="3" rx="1"/><path d="M8.5 13.5l2.5 2.5 4.5-5"/>'},
  quiz:{label:'Quiz',svg:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.6M12 17v.1"/>'},
  discussion:{label:'Discussion',svg:'<path d="M4 4.5h11v8H9l-3 3v-3H4z"/><path d="M15 8.5h5v8h-2v3l-3-3h-5v-1.5"/>'},
  reading:{label:'Reading',svg:'<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5v13"/>'},
  project:{label:'Project',svg:'<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/><path d="M3 11h18"/>'},
  lab:{label:'Lab',svg:'<path d="M9 3h6M10 3v6.5l-5.3 8.8A1.8 1.8 0 0 0 6.2 21h11.6a1.8 1.8 0 0 0 1.5-2.7L14 9.5V3M7.2 15h9.6"/>'}
 };
 const kindAliases={midterm:'exam',final:'exam',test:'exam',homework:'assignment'};
 const normalizeKind=value=>{const key=String(value||'').trim().toLowerCase();return kinds[key]?key:kindAliases[key]||null};
 // Title keywords, most specific first; a bare "final" counts as an exam only when no project/lab/reading word matched.
 const titleKind=title=>{const text=String(title||'');
  if(/\b(exam|midterm)s?\b/i.test(text))return 'exam';
  if(/\bquiz(?:zes)?\b/i.test(text))return 'quiz';
  if(/\b(discussion|discuss|forum)s?\b/i.test(text))return 'discussion';
  if(/\bprojects?\b/i.test(text))return 'project';
  if(/\blabs?\b/i.test(text))return 'lab';
  if(/\b(reading|readings|read|chapter|chapters)\b/i.test(text))return 'reading';
  if(/\bfinals?\b/i.test(text))return 'exam';
  return 'assignment'};
 const kindOf=task=>normalizeKind(task?.kind)||titleKind(task?.title);
 const formatDue=task=>{if(!task?.due)return 'No due date';const [y,m,d]=String(task.due).split('-').map(Number),day=new Date(y,m-1,d);if(!Number.isFinite(day.getTime()))return String(task.due);
  const date=day.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});if(!/^\d{1,2}:\d{2}$/.test(task.dueTime||''))return date;
  const [h,min]=task.dueTime.split(':').map(Number);day.setHours(h,min);return date+' · '+day.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}).replace(/\s+/g,' ')};
 function records(){return tasks.filter(task=>typeOf(task)==='class'&&task.status!=='archived')}
 const safeURL=value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:null}catch{return null}};
 function render(){
  const all=records(),classes=recall('sb.classes',{}),names=[...new Set([...Object.keys(classes),...all.map(task=>task.course).filter(Boolean)])].sort();if(course!=='all'&&!names.includes(course))course='all';
  const select=dialog.querySelector('select');select.replaceChildren(new Option('All classes','all'),...names.map(name=>new Option(name,name)));select.value=course;
  const filtered=all.filter(task=>course==='all'||task.course===course),stats=dialog.querySelector('.homework-stats');stats.replaceChildren();
  for(const [key,label]of [['due','Due'],['missing','Missing'],['submitted','Submitted']]){const button=document.createElement('button');button.className='homework-stat '+key;button.type='button';button.setAttribute('aria-pressed',String(active===key));const count=document.createElement('b');count.textContent=filtered.filter(task=>classify(task)===key).length;const caption=document.createElement('span');caption.textContent=label;button.append(count,caption);button.onclick=()=>{active=key;render()};stats.append(button)}
  dialog.querySelector('[data-add]').disabled=SessionWorkspace.mode==='demo';dialog.querySelector('[data-canvas]').hidden=SessionWorkspace.mode==='demo';
  const list=dialog.querySelector('.homework-list');list.replaceChildren();
  const items=filtered.filter(task=>classify(task)===active).sort((a,b)=>{if(active==='submitted')return (Date.parse(b.doneAt)||0)-(Date.parse(a.doneAt)||0);return (a.due?new Date(a.due+'T'+(a.dueTime||'23:59')).getTime():Infinity)-(b.due?new Date(b.due+'T'+(b.dueTime||'23:59')).getTime():Infinity)||String(a.title).localeCompare(String(b.title))});
  for(const task of items){
   const row=document.createElement('article');row.className='homework-row';
   const kind=kindOf(task),icon=document.createElement('div');icon.className='homework-icon kind-'+kind;icon.dataset.kind=kind;icon.setAttribute('role','img');icon.setAttribute('aria-label',kinds[kind].label);icon.title=kinds[kind].label;icon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+kinds[kind].svg+'</svg>';
   const body=document.createElement('div');body.className='homework-copy';const title=document.createElement('button');title.type='button';title.className='homework-title';title.textContent=task.title;title.onclick=()=>{close();closeSheets();tune(task.id)};
   const meta=document.createElement('div');meta.className='homework-meta';const name=document.createElement('span');name.textContent=task.course||'Other';meta.append(name);
   const url=safeURL(classes[task.course]?.url||classes[task.course]?.courseUrl||task.courseUrl);
   if(url){const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Go to course';meta.append(link)}else{const link=document.createElement('button');link.type='button';link.className='homework-course-link';link.textContent=SessionWorkspace.mode==='demo'?'View class':'Add course link';link.onclick=()=>{if(SessionWorkspace.mode==='demo'){course=task.course||'all';render();return}linkCourse=task.course||'Other';linkDialog.querySelector('[data-course]').textContent=linkCourse;linkDialog.querySelector('input').value='';linkDialog.querySelector('[role=status]').textContent='';linkDialog.showModal()};meta.append(link)}
   body.append(title,meta);if(task.points!==undefined&&task.points!==''&&task.points!==null){const points=document.createElement('p');points.className='homework-points';points.textContent=task.points+' pts';body.append(points)}
   const due=document.createElement('time');due.className='homework-deadline '+active;due.textContent=formatDue(task);if(task.due)due.dateTime=task.dueTime?task.due+'T'+task.dueTime:task.due;row.append(icon,body,due);list.append(row);
  }
  if(!items.length){const empty=document.createElement('p');empty.className='homework-empty';empty.textContent=active==='due'?'No upcoming assignments.':active==='missing'?'No missing assignments.':'No submitted assignments yet.';list.append(empty)}
 }
 dialog.querySelector('[data-canvas]').onclick=()=>{if(SessionWorkspace.mode==='demo')return;SessionTVLocal.openSetup('preferences');document.getElementById('pref-tab-canvas').click()};
 dialog.querySelector('[data-close]').onclick=()=>close();dialog.querySelector('select').onchange=event=>{course=event.target.value;render()};dialog.querySelector('[data-add]').onclick=()=>SessionAddForms.open('assignment',course==='all'?undefined:course);
 const baseGuide=renderGuide;renderGuide=function(){baseGuide.apply(this,arguments);if(!dialog.hidden)render()};
 globalThis.SessionHomework={open(){opener=document.activeElement;active='due';course='all';render();show()},classify,kindOf,formatDue};
 addEventListener('sessiontv:auth',()=>{close();linkDialog.close()});
})();
