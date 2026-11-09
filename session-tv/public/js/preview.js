/* Public snapshots are browse-only. Account sign-in remains available. */
(() => {
 if(!SessionWorkspace.readOnly)return;
 document.body.dataset.readonly='true';
 const mutations='#db-add,#set-add,#local-add,#local-playlists,#local-end,#local-export,#legacy-export,#demo-reset,.local-import,#done-btn,#undo-done,#wrapup-btn,#wp-end,#td-edit,#td-sub,#pp-create,#pp-start,#pp-go,#pp-next,#pp-end-sp,#pp-new,#pp-bl-new,#project-codex,#ws-run,#ws-send,#ws-reset,#timer,#tv-timer,#clock,#wc-form,[data-chk],[data-trash],[data-lvl],[data-lvlopen],[data-spdone],[data-sprm],[data-who],[data-all],[data-pcyc],[data-pact],[data-bladd],[data-blrm],[data-psk],[data-ppd-use],[data-usecode],.pp-ptbtn,.pp-x,.pp-n';
 const style=document.createElement('style');style.textContent=mutations.split(',').filter(s=>!['[data-chk]','[data-lvlopen]','#tv-timer'].includes(s)).map(s=>'body[data-readonly="true"] '+s).join(',')+'{display:none!important} body[data-readonly="true"] [contenteditable="true"]{pointer-events:none}';document.head.appendChild(style);
 function protect(){
  document.querySelectorAll('input,textarea,select').forEach(el=>{if(el.closest('#workspace-auth'))return;if(!el.disabled)el.disabled=true;if('readOnly' in el)el.readOnly=true});
  document.querySelectorAll('[draggable="true"]').forEach(el=>el.draggable=false);
  document.querySelectorAll('[contenteditable="true"]').forEach(el=>el.contentEditable='false');
  document.querySelectorAll('button[data-chk],button[data-lvlopen],#tv-timer').forEach(el=>{if(!el.disabled)el.disabled=true;el.title='Read-only preview'});
  document.querySelectorAll('.msg.ai.intro .muted').forEach(el=>{if(el.textContent!=='AI is disabled in this read-only preview.')el.textContent='AI is disabled in this read-only preview.'});
  const form=$('coach-form');if(form)form.hidden=true;
 }
 const block=event=>{const el=event.target instanceof Element?event.target:null;if(!el||el.closest('#workspace-auth'))return;const edit=el.closest(mutations)||el.closest('input,textarea,select,[contenteditable="true"]');if(edit||event.type==='submit'||event.type==='dragstart'){event.preventDefault();event.stopImmediatePropagation()}};
 for(const type of ['click','dblclick','beforeinput','change','submit','dragstart','keydown'])window.addEventListener(type,block,true);
 new MutationObserver(protect).observe(document.body,{childList:true,subtree:true});protect();
})();
