import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {createCompanion} from '../companion/server.mjs';
import {voiceboxOrigin,voiceService} from '../companion/voice.mjs';
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
test('Voicebox accepts loopback service origins and rejects other targets',()=>{
 for(const origin of ['http://127.0.0.1:17493','http://localhost:17493'])assert.equal(voiceboxOrigin(origin),origin);
 for(const origin of ['https://example.com','http://127.0.0.1:17493/profiles','http://localhost:17493?url=bad','http://user:pass@localhost:17493','file:///tmp/voice'])assert.throws(()=>voiceboxOrigin(origin));
});
test('Voicebox voice list and speech use confirmed API, preserve Codex wording and return bounded audio',async()=>{
 const calls=[];const service=voiceService({pause:async()=>{},fetcher:async(url,options)=>{
  calls.push({url,options});assert.equal(options.redirect,'error');
  if(url.endsWith('/profiles'))return json([{id:'english',name:'English',language:'en',personality:'private prompt'}]);
  if(url.endsWith('/speak'))return json({id:'generation',status:'generating'});
  if(url.endsWith('/history/generation'))return json({id:'generation',status:'completed'});
  return new Response('WAVE',{headers:{'Content-Type':'audio/wav'}});
 }});
 assert.deepEqual(await service.voices({baseUrl:'http://127.0.0.1:17493'}),{voices:[{id:'english',name:'English',language:'en'}]});
 const audio=await service.speak({voiceId:'english',text:'Exactly what Codex said.'});assert.equal(audio.type,'audio/wav');assert.equal(audio.body.toString(),'WAVE');
 assert.deepEqual(JSON.parse(calls.find(call=>call.url.endsWith('/speak')).options.body),{profile:'english',text:'Exactly what Codex said.',personality:false});
 await assert.rejects(service.speak({voiceId:'english',text:'x'.repeat(10001)}),/10,000/);
});
test('Voicebox generation failures and unavailable service are actionable',async()=>{
 const service=voiceService({fetcher:async()=>json({id:'gen',status:'failed'})});await assert.rejects(service.speak({voiceId:'voice',text:'Test'}),/model status/);
 const offline=voiceService({fetcher:async()=>{throw Error('offline')}});await assert.rejects(offline.voices({}),/Open Voicebox/);
});
test('voice routes require paired owner and return audio without disclosing local paths',async()=>{
 let calls=0;const companion=createCompanion({port:0,supabaseUrl:'https://test.supabase.co',publishableKey:'public',ownerId:'owner',home:tmpdir(),workspaces:[tmpdir()],verifyUser:async token=>({id:token==='owner'?'owner':'visitor'}),voice:{voices:async()=>{calls++;return {voices:[]}},speak:async()=>{calls++;return {type:'audio/wav',body:Buffer.from('WAVE')}}}});
 await companion.listen();const url='http://127.0.0.1:'+companion.server.address().port;
 const post=(route,body={},extra={})=>fetch(url+route,{method:'POST',headers:{Origin:'https://tannermayfield.dev','Content-Type':'application/json',Authorization:'Bearer owner',...extra},body:JSON.stringify(body)});
 try{
  assert.equal((await post('/voice/voices')).status,401);assert.equal(calls,0);
  const pair=await (await post('/pair',{code:companion.pairingCode})).json(),headers={'X-SessionTV-Pair':pair.token};
  assert.equal((await post('/voice/voices',{}, {...headers,Authorization:'Bearer visitor'})).status,403);assert.equal(calls,0);
  assert.deepEqual(await (await post('/voice/voices',{},headers)).json(),{voices:[]});
  const audio=await post('/voice/speak',{voiceId:'voice',text:'Test'},headers);assert.equal(audio.headers.get('content-type'),'audio/wav');assert.equal(await audio.text(),'WAVE');
 }finally{await new Promise(resolve=>companion.server.close(resolve))}
});
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
const speechScript=readFileSync(new URL('../public/js/speech.js',import.meta.url),'utf8');
function browserFixture(mode='private'){
 const dom=new JSDOM('<!doctype html><html lang="en-US"><body><div id="coach-log"><div class="msg ai"><div class="ai-name">Codex</div><p>A complete reply.</p></div></div><form id="coach-form"><textarea id="coach-input"></textarea><button type="submit">Send</button></form><div id="wc-log"></div><form id="wc-form"><textarea id="wc-input"></textarea><button type="submit">Send</button></form><div id="settings"></div></body></html>',{runScripts:'outside-only',url:'https://tannermayfield.dev/session-tv/'});
 const w=dom.window,messages=[],requests=[],values={'sb.voice':{baseUrl:'http://127.0.0.1:17493',voices:{class:'english'}}};
 class Recognition{constructor(){Recognition.last=this}start(){this.onstart?.()}abort(){this.aborted=true;this.onend?.()}}
 class Audio{play(){this.playing=true;Audio.last=this;return Promise.resolve()}pause(){this.playing=false}}
 Object.assign(w,{current:{mood:'class',active:'task'},TV:{mode:'task'},SessionWorkspace:{mode},SpeechRecognition:Recognition,Audio,toast:message=>messages.push(message),recall:(key,fallback)=>values[key]||fallback,store:(key,value)=>values[key]=value,SessionCompanion:{voices:async()=>({voices:[{id:'english',name:'English'}]}),speak:async(body)=>{requests.push(body);return new w.Blob(['WAVE'],{type:'audio/wav'})}}});
 w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.eval(speechScript);
 return {dom,w,messages,requests,Recognition,Audio,values};
}
test('chat dictation preserves drafts, never submits and stops before speaking',async()=>{
 const {dom,w,requests,Recognition,Audio}=browserFixture();
 try{
  assert.equal(w.document.querySelectorAll('.speech-controls').length,2);
  const form=w.document.getElementById('coach-form'),input=w.document.getElementById('coach-input');let submits=0;form.addEventListener('submit',()=>submits++);input.value='Draft.';
  form.querySelector('[data-speech=mic]').click();const instance=Recognition.last;
  instance.onresult({results:[[{transcript:'spoken words'}]]});assert.equal(input.value,'Draft. spoken words');assert.equal(submits,0);
  form.querySelector('[data-speech=speaker]').click();await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(instance.aborted,true);assert.equal(requests[0].text,'A complete reply.');assert.equal(requests[0].voiceId,'english');assert.equal(Audio.last.playing,true);
  w.SessionSpeech.stop();assert.equal(Audio.last.playing,false);assert.equal(form.querySelector('[data-speech=speaker]').getAttribute('aria-pressed'),'false');
 }finally{dom.window.close()}
});
test('demo speech controls cannot record or request voices',async()=>{
 const {dom,w,requests,Recognition}=browserFixture('demo');try{
  w.document.querySelector('[data-speech=mic]').click();assert.equal(Recognition.last,undefined);
  await w.SessionSpeech.speak('Text');assert.equal(requests.length,0);
 }finally{dom.window.close()}
});
test('section voice selection persists separately and empty test voices cannot fall back',async()=>{
 const {dom,w,values,requests,messages}=browserFixture();try{
  const container=w.document.getElementById('settings');w.SessionSpeech.mountSettings(container);w.SessionSpeech.mountSettings(container);assert.equal(container.querySelectorAll('.voice-settings').length,1);
  container.querySelector('[data-voice-load]').click();await new Promise(resolve=>setTimeout(resolve,0));
  const selects=container.querySelectorAll('select');selects[1].value='english';selects[1].dispatchEvent(new w.Event('change'));
  assert.equal(values['sb.voice'].voices.class,'english');assert.equal(values['sb.voice'].voices.skill,'english');
  container.querySelectorAll('.voice-section button')[2].click();assert.equal(requests.length,0);assert.match(messages.at(-1),/Choose a voice for Projects/);
 }finally{dom.window.close()}
});
