/* ChatGPT plan chats: credentials stay with the local companion. */
(() => {
 const usage='https://chatgpt.com/settings/usage';
 let status=null,models=[],dialog=null,settings=null,running=null,epoch=0;
 const privateUser=()=>globalThis.SessionWorkspace?.mode==='private';
 const messages=()=>recall('sb.chatgptChats',[]);
 const save=value=>{if(privateUser())store('sb.chatgptChats',value)};
 function button(text,action){const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=text;b.onclick=action;return b}
 function link(){const a=document.createElement('a');a.href=usage;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Manage usage';return a}
 function notice(node,text){node.textContent=text}
 async function refresh(){
  if(!privateUser())return;
  const requestEpoch=epoch;
  try{const result=await SessionCompanion.chatGPTStatus();if(epoch!==requestEpoch||!privateUser())return;if(result.connected){const account=result.account?.client_id||result.account?.subject||result.account?.email;if(account&&recall('sb.chatgptAccount',null)!==account){store('sb.chatgptAccount',account);store('sb.chatgptChats',[]);models=[]}}status=result;renderSettings();return result}
  catch(error){if(epoch===requestEpoch){status={connected:false,error:error.message};renderSettings()}}
 }
 function renderSettings(){
  if(!settings||!privateUser())return;
  settings.replaceChildren();
  const title=document.createElement('h4');title.textContent='ChatGPT';settings.append(title);
  const state=document.createElement('p');state.textContent=status?.connected?'Connected'+(status.account?.email?' · '+status.account.email:''):status?.pending?'Finish signing in in your browser.':status?.error||'Not connected';settings.append(state);
  const note=document.createElement('p');note.className='chatgpt-note';note.textContent='Use your included ChatGPT plan allowance. Leave paid credits off in ChatGPT usage settings.';settings.append(note,link());
  if(status?.connected){settings.append(button('Open chat',open),button('Disconnect',async()=>{try{const result=await SessionCompanion.disconnectChatGPT();status=null;models=[];running?.abort();dialog?.close();await refresh();if(result.revoked===false&&settings){status={connected:false,error:'Disconnected locally. Remote revocation was not confirmed; review access in ChatGPT settings.'};renderSettings()}}catch(error){notice(state,error.message)}}))}
  else settings.append(button('Continue with ChatGPT',async()=>{
   const requestEpoch=epoch,popup=window.open('about:blank','sessiontv-chatgpt','popup,width=700,height=800');
   try{
    const result=await SessionCompanion.connectChatGPT();if(epoch!==requestEpoch||!privateUser()){popup?.close();return}
    const url=new URL(result.authorizationUrl);if(url.origin!=='https://auth.openai.com'||url.pathname!=='/api/accounts/authorize'||url.username||url.password)throw Error('Invalid sign-in URL.');
    status={connected:false,pending:true};renderSettings();
    if(popup){popup.opener=null;popup.location.href=url.href}else{const a=document.createElement('a');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open ChatGPT sign-in';settings.append(a)}
   }catch(error){popup?.close();if(epoch===requestEpoch&&privateUser()){status={connected:false,error:error.message};renderSettings()}}
  }));
  settings.append(button('Check status',refresh));
 }
 function renderMessages(){
  const log=dialog.querySelector('#chatgpt-log');log.replaceChildren();
  for(const message of messages()){
   const bubble=document.createElement('div');bubble.className='msg '+(message.role==='user'?'me':'ai');
   const name=document.createElement('div');name.className='ai-name';name.textContent=message.role==='user'?'You':'ChatGPT';
   const content=document.createElement('div');if(typeof fmtMsg==='function')content.innerHTML=fmtMsg(message.content,message.role==='assistant');else content.textContent=message.content;
   bubble.append(name,content);log.append(bubble);
  }
  log.scrollTop=log.scrollHeight;
 }
 async function send(event){
  event.preventDefault();if(!privateUser()||running||!status?.connected)return;
  const input=dialog.querySelector('#chatgpt-input'),text=input.value.trim(),model=dialog.querySelector('#chatgpt-model').value;
  if(!text||!model)return;if(text.length>16000||new Blob([text]).size>20000){notice(dialog.querySelector('#chatgpt-status'),'Please shorten this message before sending.');return}
  const output=dialog.querySelector('#chatgpt-status'),sendButton=dialog.querySelector('#chatgpt-send'),stop=dialog.querySelector('#chatgpt-stop');
  const requestEpoch=epoch,controller=new AbortController();running=controller;sendButton.disabled=true;stop.hidden=false;
  const history=messages().map(({role,content})=>({role,content}));history.push({role:'user',content:text});while(history.length>1&&(history.length>60||new Blob([JSON.stringify(history)]).size>24000))history.splice(0,Math.min(2,history.length-1));save(history);input.value='';const reply={role:'assistant',content:''};save([...history,reply]);renderMessages();notice(output,'');let completed=false;
  try{
   await SessionCompanion.chatGPTStart({model,effort:dialog.querySelector('#chatgpt-effort').value,messages:history,signal:controller.signal,onEvent:event=>{
    if(epoch!==requestEpoch||!privateUser())return;
    if(event.type==='response.output_text.delta'){reply.content+=event.delta||'';save([...history,reply]);renderMessages()}
    if(event.type==='response.completed')completed=true;
    if(['error','response.failed','response.incomplete'].includes(event.type))throw Error(event.message||event.error?.message||event.response?.error?.message||'ChatGPT could not complete this response. Review your plan usage or try again.');
   }});
   if(!completed)throw Error('The response ended before completion. Try again.');
  }catch(error){if(epoch===requestEpoch&&privateUser())notice(output,error.name==='AbortError'?'Stopped.':error.message)}
  finally{if(running===controller)running=null;if(epoch===requestEpoch&&privateUser()){sendButton.disabled=false;stop.hidden=true}}
 }
 async function open(){
  if(!privateUser())return;
  const result=await refresh();if(!result?.connected){if(typeof toast==='function')toast(result?.error||'Connect ChatGPT in Session Preferences first.');return}
  if(!dialog){dialog=document.createElement('dialog');dialog.id='chatgpt-chat';dialog.className='chatgpt-chat';dialog.innerHTML='<header><h2>ChatGPT</h2><button type="button" data-close class="btn ghost">Close</button></header><div class="chatgpt-plan">Using ChatGPT plan · </div><div class="chatgpt-options"><label>Model <select id="chatgpt-model"></select></label><label>Thinking <select id="chatgpt-effort"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option></select></label></div><div id="chatgpt-log" role="log" aria-live="polite"></div><p id="chatgpt-status" role="status"></p><form id="chatgpt-form"><textarea id="chatgpt-input" maxlength="16000" aria-label="Message ChatGPT" placeholder="Message ChatGPT" required></textarea><button id="chatgpt-send" class="btn" type="submit" disabled>Send</button><button id="chatgpt-stop" class="btn ghost" type="button" hidden>Stop</button></form>';document.body.append(dialog);dialog.querySelector('.chatgpt-plan').append(link());dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelector('form').onsubmit=send;dialog.querySelector('#chatgpt-stop').onclick=()=>running?.abort();dialog.addEventListener('close',()=>running?.abort())}
  if(!dialog.open)dialog.showModal();renderMessages();const requestEpoch=epoch;
  try{if(!models.length){const result=await SessionCompanion.chatGPTModels();if(epoch!==requestEpoch||!privateUser())return;models=result.models||[]}
   const picker=dialog.querySelector('#chatgpt-model'),previous=picker.value;picker.replaceChildren();for(const model of models){if(!model.slug)continue;const option=document.createElement('option');option.value=model.slug;option.textContent=model.display_name||model.slug;picker.append(option)}if(models.some(m=>m.slug===previous))picker.value=previous;dialog.querySelector('#chatgpt-send').disabled=!picker.value||!!running;if(!picker.value)notice(dialog.querySelector('#chatgpt-status'),'No models are available for this ChatGPT account.');
   if(!recall('sb.chatgptPlanWelcome',false)){notice(dialog.querySelector('#chatgpt-status'),"You're using your ChatGPT plan. Eligible requests use your included allowance. Manage usage in ChatGPT settings.");const got=button('Got it',()=>{store('sb.chatgptPlanWelcome',true);got.remove();notice(dialog.querySelector('#chatgpt-status'),'')});dialog.querySelector('#chatgpt-status').append(got)}
  }catch(error){if(epoch===requestEpoch)notice(dialog.querySelector('#chatgpt-status'),error.message)}
 }
 function clear(){epoch++;running?.abort();running=null;status=null;models=[];dialog?.close();dialog?.remove();dialog=null;settings?.replaceChildren();settings=null}
 globalThis.SessionChatGPT={open,mountSettings(container){if(!container||!privateUser())return;settings=container;renderSettings();refresh()}};
 function entrypoints(){
  for(const heading of document.querySelectorAll('#wc-head,.project-chat-heading')){
   const existing=heading.querySelector('[data-chatgpt-open]');
   if(!privateUser()){existing?.remove();continue}
   if(existing)continue;
   const entry=button('ChatGPT',open);entry.dataset.chatgptOpen='';entry.classList.add('ghost');heading.append(entry);
  }
 }
 let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;entrypoints()})}).observe(document.body,{childList:true,subtree:true});entrypoints();
 addEventListener('sessiontv:auth',clear);addEventListener('pagehide',clear);
})();
