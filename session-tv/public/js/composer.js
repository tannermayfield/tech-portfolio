/* Shared TV chat composer. Attachments are text only and never execute. */
(() => {
 const extensions=new Set(['txt','md','csv','json','py','js','ts','html','css','sql']);
 const limit=10000;
 let files=[],context='',scheduled=false,accessPopup=null;
 const privateUser=()=>globalThis.SessionWorkspace?.mode==='private';
 function state(){
  const task=typeof current!=='undefined'&&typeof T==='function'?T(current.active):null;
  const section=typeof current!=='undefined'?current.mood:'class';
  const mode=section==='project'&&task&&typeof projMode==='function'?projMode(task):'study';
  return {section,mode,task,key:[section,task?.id||'',mode].join('|')};
 }
 const button=(text,label)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',label||text);return b};
 function notify(text){if(typeof toast==='function')toast(text);else document.getElementById('composer-status').textContent=text}
 function chips(){const area=document.querySelector('#coach-form .composer-attachments');if(!area)return;area.replaceChildren();for(const file of files){const chip=document.createElement('span');chip.className='composer-file';const name=document.createElement('span');name.textContent=file.name;const remove=button('×','Remove '+file.name);remove.onclick=()=>{files=files.filter(value=>value!==file);chips()};chip.append(name,remove);area.append(chip)}area.hidden=!files.length;}
 function read(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(Error('Could not read '+file.name));reader.readAsText(file)})}
 async function attach(list){
  if(!privateUser())return;const key=context,selected=Array.from(list||[]),existing=files.reduce((sum,f)=>sum+f.size,0);
  if(selected.some(file=>!extensions.has(file.name.split('.').pop().toLowerCase())))return notify('Attach text or code files: .txt, .md, .csv, .json, .py, .js, .ts, .html, .css or .sql.');
  if(existing+selected.reduce((sum,file)=>sum+file.size,0)>limit)return notify('Attachments must total 10 KB or less.');
  try{const added=await Promise.all(selected.map(async file=>({name:file.name,text:await read(file),size:file.size})));if(!privateUser()||context!==key)return;if(added.some(file=>file.text.includes('\0')))return notify('Only readable text and code files are supported.');if(files.reduce((n,f)=>n+f.size,0)+added.reduce((n,f)=>n+f.size,0)>limit)return notify('Attachments must total 10 KB or less.');if([...files,...added].reduce((n,file)=>n+file.text.length,0)>limit)return notify('Attachments must total 10,000 characters or less.');files.push(...added);chips()}catch(error){notify(error.message)}
 }
 function access(trigger){
  if(accessPopup){accessPopup.remove();accessPopup=null;trigger.setAttribute('aria-expanded','false');return}
  const panel=accessPopup=document.createElement('div');panel.className='composer-access-popup';panel.id='composer-access-popup';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Workspace access');panel.setAttribute('popover','auto');
  const heading=document.createElement('strong');heading.textContent='Workspace access';const text=document.createElement('p');text.textContent='Codex can read and edit the linked project inside its restricted workspace. Network access is blocked by default. Work chat shows eligible one-time approval requests as they come up.';const close=button('Close');close.onclick=()=>{panel.remove();accessPopup=null;trigger.setAttribute('aria-expanded','false')};panel.append(heading,text,close);document.body.append(panel);panel.showPopover?.();trigger.setAttribute('aria-expanded','true');const bounds=trigger.getBoundingClientRect();panel.style.left=Math.max(12,Math.min(bounds.left,innerWidth-330))+'px';panel.style.top=Math.max(12,bounds.top-170)+'px';panel.addEventListener('toggle',event=>{if(event.newState==='closed'){panel.remove();if(accessPopup===panel)accessPopup=null;trigger.setAttribute('aria-expanded','false')}});
 }
 function mount(){
  const form=document.getElementById('coach-form'),input=document.getElementById('coach-input'),send=document.getElementById('coach-send');if(!form||!input||!send)return;
  const info=state();if(context!==info.key){context=info.key;files=[];accessPopup?.remove();accessPopup=null}
  let main=form.querySelector('.composer-input-row');
  if(!main){
   form.classList.add('session-composer');main=document.createElement('div');main.className='composer-input-row';
   const bottom=document.createElement('div');bottom.className='composer-bottom';const left=document.createElement('div');left.className='composer-left';const right=document.createElement('div');right.className='composer-right';bottom.append(left,right);
   const area=document.createElement('div');area.className='composer-attachments';area.hidden=true;const status=document.createElement('span');status.id='composer-status';status.className='sr-only';status.setAttribute('role','status');
   const picker=document.createElement('input');picker.type='file';picker.multiple=true;picker.accept=[...extensions].map(ext=>'.'+ext).join(',');picker.hidden=true;picker.id='composer-files';picker.onchange=()=>{attach(picker.files);picker.value=''};
   const plus=button('+','Attach text or code files, up to 10 KB total');plus.className='composer-plus';plus.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 4v16M4 12h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';plus.title='Attach text or code files · 10 KB total';plus.onclick=()=>picker.click();
   const permission=button('Workspace access');permission.className='composer-access';permission.setAttribute('aria-haspopup','dialog');permission.setAttribute('aria-controls','composer-access-popup');permission.setAttribute('aria-expanded','false');permission.onclick=()=>access(permission);
   left.append(plus,permission);form.append(area,main,bottom,picker,status);
  }
  const left=form.querySelector('.composer-left'),right=form.querySelector('.composer-right');
  if(input.parentElement!==main)main.append(input);
  const work=info.section==='project'&&info.mode==='work';form.classList.toggle('composer-work',work);form.dataset.composerSection=info.section;
  const plus=left.querySelector('.composer-plus'),permission=left.querySelector('.composer-access');if(plus.hidden!==!privateUser())plus.hidden=!privateUser();const hideAccess=!work||!privateUser();if(permission.hidden!==hideAccess)permission.hidden=hideAccess;
  let thinking=right.querySelector('.composer-study-effort');
  if(info.section!=='project'){
   if(!thinking){thinking=document.createElement('select');thinking.className='composer-study-effort';thinking.setAttribute('aria-label','Thinking effort');for(const [value,label] of [['medium','Medium']]){const option=document.createElement('option');option.value=value;option.textContent=label;thinking.append(option)}right.prepend(thinking)}
   const source=globalThis.SessionStudyChats?.state,study=typeof source==='function'?source():source;thinking.value='medium';thinking.disabled=true;thinking.title='Medium thinking';if(thinking.hidden)thinking.hidden=false;
  }else if(thinking&&!thinking.hidden)thinking.hidden=true;
  const controls=form.querySelector('.project-model-controls');if(controls&&controls.parentElement!==right)right.append(controls);
  const speech=form.querySelector('.speech-controls');if(speech&&speech.parentElement!==right)right.append(speech);
  if(send.parentElement!==right)right.append(send);else if(send.nextElementSibling&&!send.nextElementSibling.matches('#project-stop'))right.append(send);
    const stop=form.querySelector('#project-stop');if(stop&&stop.parentElement!==right)right.append(stop);
  const studySource=globalThis.SessionStudyChats?.state,study=typeof studySource==='function'?studySource():studySource,busy=info.section==='project'?!!stop&&!stop.hidden:!!study?.busy;
  const typed=!!input.value.trim()||files.length>0,kind=busy?'stop':typed?'send':'voice';
  if(send.dataset.composerDisabled===undefined||String(send.disabled)!==send.dataset.composerDisabled)send.dataset.composerProviderDisabled=String(send.disabled);
  const disabled=busy?false:!typed?true:info.section!=='project'?!study?.ready:form.dataset.providerReady!==undefined?form.dataset.providerReady!=='true':send.dataset.composerProviderDisabled==='true';
  if(send.disabled!==disabled)send.disabled=disabled;send.dataset.composerDisabled=String(disabled);
  const label=busy?'Stop response':typed?'Send message':'Voice mode coming soon';send.setAttribute('aria-label',label);send.title=label;send.classList.toggle('composer-future-voice',kind==='voice');
  if(send.dataset.composerKind!==kind){send.dataset.composerKind=kind;send.innerHTML=kind==='stop'?'<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>':kind==='voice'?'<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 10v4m4-8v12m4-15v18m4-15v12m4-8v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>':'<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'}
  if(!send.dataset.composerClick){send.dataset.composerClick='true';send.addEventListener('click',event=>{
   const section=state().section,study=globalThis.SessionStudyChats?.state,stop=form.querySelector('#project-stop');const busy=section==='project'?!!stop&&!stop.hidden:!!study?.busy;
   if(busy){event.preventDefault();event.stopImmediatePropagation();if(section==='project')globalThis.SessionCompanion?.cancel();else globalThis.SessionStudyChats?.stop();return}
   if(!input.value.trim()&&!files.length){event.preventDefault();event.stopImmediatePropagation()}
  },true);input.addEventListener('input',schedule)}  chips();
 }
 // Avoid rebuilding chips or inputs during unrelated DOM changes.
 function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;mount()})}
 const observer=new MutationObserver(records=>{if(context!==state().key||records.some(record=>record.target.closest?.('#coach-wrap,#coach-form')||Array.from(record.addedNodes).some(node=>node.id==='coach-form')))schedule()});observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','data-view']});
 // Rendering attachments must not itself restart the observer indefinitely.
 const originalChips=chips;let fileSignature='';chips=()=>{const signature=context+'|'+files.map(f=>f.name+':'+f.size).join('|');if(signature===fileSignature)return;fileSignature=signature;originalChips()};
 globalThis.SessionComposer={peekAttachments(){return files.map(({name,text})=>({name,text}))},consumeAttachments(){const result=files.map(({name,text})=>({name,text}));files=[];chips();return result},get attachments(){return files.map(({name,text})=>({name,text}))},attach};
 addEventListener('sessiontv:auth',()=>{files=[];context='';fileSignature='';accessPopup?.remove();accessPopup=null;schedule()});mount();
})();
