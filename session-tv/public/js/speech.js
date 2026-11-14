/* Private speech controls; each section keeps its own Voicebox character voice. */
(() => {
 const sections={class:'Classes',skill:'Skills',project:'Projects'};
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 let recognition=null,audio=null,audioURL=null,request=null,activeButton=null,lastContext='';
 const privateMode=()=>SessionWorkspace.mode==='private';
 const preferences=()=>recall('sb.voice',{baseUrl:'http://127.0.0.1:17493',voices:{}});
 function section(){return current?.mood in sections?current.mood:'class'}
 function state(value){dispatchEvent(new CustomEvent('sessiontv:character',{detail:{section:section(),name:recall('sb.sectionCharacters',{})[section()]||sections[section()],state:value}}));document.body.dataset.speechState=value;}
 function message(text){toast(text)}
 function stop(){
  recognition?.abort();recognition=null;request?.abort();request=null;
  if(audio){audio.pause();audio.src='';audio=null}if(audioURL){URL.revokeObjectURL(audioURL);audioURL=null}
  if(activeButton){activeButton.setAttribute('aria-pressed','false');activeButton.classList.remove('active');activeButton=null}state('idle');
 }
 async function speak(text,button,voiceId) {
  if(!privateMode())return message('Sign in to use character voices.');
  if(request||audio){stop();return}
  if(recognition)stop();
  const config=preferences(),voice=voiceId||config.voices?.[section()];
  if(!voice)return message('Choose a voice for '+sections[section()]+' in Session Preferences → Voices.');
  if(!text.trim())return message('There is no completed AI response to read yet.');
  const controller=request=new AbortController();activeButton=button;button?.setAttribute('aria-pressed','true');state('loading');
  try {
   const blob=await SessionCompanion.speak({baseUrl:config.baseUrl,voiceId:voice,text},controller.signal);
   if(controller.signal.aborted)return;
   audioURL=URL.createObjectURL(blob);audio=new Audio(audioURL);audio.onended=stop;audio.onerror=()=>{stop();message('Audio playback failed. Check Voicebox and try again.')};
   await audio.play();if(request===controller)state('speaking');
  } catch(error){if(request!==controller)return;if(!controller.signal.aborted)message(error.message);stop()}
 }
 function dictate(input,button){
  if(!privateMode())return message('Sign in to use voice input.');
  if(recognition){stop();return}stop();
  if(!Recognition)return message('Voice input is unavailable in this browser. Use Chrome or Edge with microphone access.');
  const instance=recognition=new Recognition(),original=input.value;
  instance.lang=document.documentElement.lang||'en-US';instance.continuous=true;instance.interimResults=true;
  activeButton=button;button.setAttribute('aria-pressed','true');button.classList.add('active');
  instance.onstart=()=>{if(recognition===instance)state('listening')};
  instance.onresult=event=>{
   if(recognition!==instance)return;
   const transcript=Array.from(event.results).map(result=>result[0].transcript).join(' ');
   input.value=(original?original.trimEnd()+' ':'')+transcript;input.dispatchEvent(new Event('input',{bubbles:true}));
  };
  instance.onerror=event=>{if(recognition!==instance)return;if(event.error!=='aborted')message(event.error==='not-allowed'?'Allow microphone access in your browser to dictate.':'Voice input stopped ('+event.error+').');stop()};
  instance.onend=()=>{if(recognition===instance){recognition=null;button.setAttribute('aria-pressed','false');button.classList.remove('active');activeButton=null;state('idle')}};
  try{instance.start()}catch(error){stop();message(error.message)}
 }
 function lastReply(log){
  const replies=log?.querySelectorAll('.msg.ai');const reply=replies?.[replies.length-1];if(!reply)return '';
  const copy=reply.cloneNode(true);copy.querySelectorAll('.ai-name,button').forEach(el=>el.remove());return copy.textContent.trim();
 }
 const svg={mic:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 10v1a6 6 0 0 0 12 0v-1M12 17v4M9 21h6"/></svg>',speaker:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM17 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14"/></svg>'};
 function controls(){
  for(const [formId,inputId,logId]of [['coach-form','coach-input','coach-log'],['wc-form','wc-input','wc-log']]){
   const form=document.getElementById(formId),input=document.getElementById(inputId);if(!form||!input||form.querySelector('.speech-controls'))continue;
   const group=document.createElement('div');group.className='speech-controls';
   for(const kind of ['mic','speaker']){
    const button=document.createElement('button');button.type='button';button.className='speech-button';button.dataset.speech=kind;button.innerHTML=svg[kind];
    button.setAttribute('aria-label',kind==='mic'?'Dictate message':'Read latest AI response');button.setAttribute('title',kind==='mic'?'Dictate message · click again to stop':'Read latest AI response · click again to stop');button.setAttribute('aria-pressed','false');
    button.onclick=()=>{if(kind==='mic')dictate(input,button);else{if(form.querySelector('[type=submit]')?.disabled)return message('Wait for Codex to finish its response.');speak(lastReply(document.getElementById(logId)),button)}};
    group.appendChild(button);
   }
   input.insertAdjacentElement('afterend',group);
   form.addEventListener('submit',()=>stop());
  }
 }
 function context(){return [privateMode(),current?.mood,current?.active,TV.mode,document.body.dataset.view].join('|')}
 let scheduled=false;
 const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;const next=context();if(next!==lastContext){lastContext=next;stop()}controls()})});
 observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','data-view']});
 addEventListener('sessiontv:auth',stop);addEventListener('pagehide',stop);addEventListener('hashchange',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
 function mountSettings(container){
  if(!container)return;const config=preferences();container.replaceChildren();
  const form=document.createElement('div');form.className='voice-settings';
  form.innerHTML='<label>Voicebox server<input type="url" id="voicebox-server" placeholder="http://127.0.0.1:17493"></label><div class="voice-connect-actions"><button type="button" class="btn" data-voice-load>Load voices</button><button type="button" class="btn ghost" data-voice-stop>Stop audio</button></div><p class="small" role="status"></p><div class="voice-sections"></div><p class="small muted">Microphone dictation uses your browser’s speech service. Review your message before sending.</p>';
  container.appendChild(form);const endpoint=form.querySelector('input'),status=form.querySelector('[role=status]'),rows=form.querySelector('.voice-sections');endpoint.value=config.baseUrl||'http://127.0.0.1:17493';
  const selects={};
  for(const [key,label]of Object.entries(sections)){
   const row=document.createElement('div');row.className='voice-section';const field=document.createElement('label');field.textContent=label+' voice';const select=document.createElement('select');select.setAttribute('aria-label',label+' voice');select.appendChild(new Option('Choose a voice',''));if(config.voices?.[key])select.appendChild(new Option(config.labels?.[key]||'Saved Voicebox voice',config.voices[key]));select.value=config.voices?.[key]||'';field.appendChild(select);
   select.onchange=()=>{if(!privateMode())return;const value=preferences();value.voices={...value.voices,[key]:select.value};value.labels={...value.labels,[key]:select.selectedOptions[0].textContent};store('sb.voice',value)};
   const test=document.createElement('button');test.type='button';test.className='btn ghost';test.textContent='Test voice';test.onclick=()=>{if(!select.value)return message('Choose a voice for '+label+'.');speak('Hello. I am ready to help you with '+label.toLowerCase()+'.',test,select.value)};row.append(field,test);rows.appendChild(row);selects[key]=select;
  }
  form.querySelector('[data-voice-stop]').onclick=stop;
  form.querySelector('[data-voice-load]').onclick=async event=>{
   const button=event.currentTarget;button.disabled=true;status.textContent='Connecting to Voicebox…';
   try{
    if(!privateMode())throw Error('Sign in to configure voices.');const {voices}=await SessionCompanion.voices({baseUrl:endpoint.value.trim()});
    const value=preferences();value.baseUrl=endpoint.value.trim();store('sb.voice',value);
    for(const [key,select]of Object.entries(selects)){const chosen=select.value;select.replaceChildren(new Option('Choose a voice',''),...voices.map(voice=>new Option(voice.name,voice.id)));if(chosen&&!voices.some(v=>v.id===chosen))select.appendChild(new Option('Saved voice unavailable',chosen));select.value=chosen;}
    status.textContent=voices.length+' Voicebox voice'+(voices.length===1?'':'s')+' available.';
   }catch(error){status.textContent=error.message}finally{button.disabled=false}
  };
 }
 globalThis.SessionSpeech={mountSettings,stop,speak};lastContext=context();controls();
})();
