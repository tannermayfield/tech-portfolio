/* Text attachments travel as message context, never as executable content. */
(()=>{
 const base=sendCoach;
 sendCoach=async function(text,show){
  const files=globalThis.SessionComposer?.peekAttachments?.()||[];
  if(!files.length)return base.apply(this,arguments);
  if(SessionWorkspace.mode!=='private')return toast('Sign in to attach files.');
  const task=T(current?.active);if(!task)return toast('Choose a chat before attaching files.');const type=typeOf(task);
  if(type==='project'&&SessionProjectChats.busy)return;
  if(['class','skill'].includes(type)&&!globalThis.SessionStudyChats?.state?.ready)return toast('Connect ChatGPT before sending attachments.');
  if(globalThis.SessionStudyChats?.state?.busy&&['class','skill'].includes(type))return;
  const prompt=String(text||'').trim(),context=files.map(file=>'Attachment: '+file.name+'\n'+file.text).join('\n\n');
  const message=(prompt||'Please review the attached files.')+'\n\n'+context;
  if(message.length>10000||new TextEncoder().encode(message).length>16000)return toast('These files are too large for one message. Attach a smaller excerpt.');
  const result=await base.call(this,message,show||prompt||'Attached '+files.map(file=>file.name).join(', '));
  if(result?.sent===false)return result;
  if(JSON.stringify(globalThis.SessionComposer.peekAttachments())===JSON.stringify(files))SessionComposer.consumeAttachments();return result;
 };
})();
