/* Public snapshots are browse-only. Account sign-in remains available.
   Every control that changes data carries data-write where it is created (see AGENTS.md):
   - [data-write] (a button, a select or a whole form) is hidden in this preview
   - [data-write="disable"] stays visible but disabled (the timer, the skill stage box); on a form
     that means its fields stay readable and all of its controls are disabled
   Forms never submit here, and the database also rejects every record write (storage.js PreviewDatabase). */
(() => {
 if(!SessionWorkspace.readOnly)return;
 document.body.dataset.readonly='true';
 const WRITE='[data-write]',NOTE='Read-only preview';
 const style=document.createElement('style');
 style.textContent='body[data-readonly="true"] [data-write]:not([data-write="disable"]){display:none!important} body[data-readonly="true"] [contenteditable="true"]{pointer-events:none}';
 document.head.appendChild(style);
 const exempt=el=>el.closest('#workspace-auth')||el.id==='homework-course';
 const lock=el=>{if(!el.disabled)el.disabled=true;if(el.title!==NOTE)el.title=NOTE};
 function protect(){
  document.querySelectorAll('[data-write]').forEach(el=>{if(el.matches('form'))el.querySelectorAll('button,input,select,textarea').forEach(lock);else if('disabled' in el)lock(el)});
  // fields and drag handles outside a marked form stay locked too
  document.querySelectorAll('input,textarea,select').forEach(el=>{if(exempt(el))return;if(!el.disabled)el.disabled=true;if('readOnly' in el)el.readOnly=true});
  document.querySelectorAll('[draggable="true"]').forEach(el=>el.draggable=false);
  document.querySelectorAll('[contenteditable="true"]').forEach(el=>el.contentEditable='false');
  document.querySelectorAll('.msg.ai.intro .muted').forEach(el=>{if(el.textContent!=='AI is disabled in this read-only preview.')el.textContent='AI is disabled in this read-only preview.'});
 }
 const block=event=>{
  const el=event.target instanceof Element?event.target:null;if(!el||exempt(el))return;
  const write=el.closest(WRITE)||el.closest('input,textarea,select,[contenteditable="true"]');
  if(write||event.type==='submit'||event.type==='dragstart'){event.preventDefault();event.stopImmediatePropagation()}
 };
 for(const type of ['click','dblclick','beforeinput','change','submit','dragstart','keydown'])window.addEventListener(type,block,true);
 new MutationObserver(protect).observe(document.body,{childList:true,subtree:true});protect();
})();
