import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../public/js/study-chats.js',import.meta.url),'utf8');
const wait=async check=>{for(let i=0;i<100;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,5));}throw new Error('Study UI did not settle');};
function boot({mode='private',active='class-a',connected=true,values={},start,account='account-a',models=[{slug:'newest-model',display_name:'Newest model'}]}={}){
 const dom=new JSDOM('<section id="coach-wrap"><div id="coach-quick"></div><div id="coach-log"></div><form id="coach-form"><textarea id="coach-input"></textarea><button id="coach-send">Send</button></form></section><button id="pref-tab-ai">AI</button>',{runScripts:'dangerously',url:'https://tannermayfield.dev/session-tv/'}),w=dom.window,data=new Map(Object.entries(values)),calls=[],toasts=[],formatted=[],legacy=[];
 w.TextEncoder=TextEncoder;w.SessionWorkspace={mode,readOnly:mode==='demo'};w.SessionCloud={user:mode==='private'?{id:'supabase-owner'}:null};
 w.recall=(key,fallback)=>data.get(key)??fallback;w.store=(key,value)=>data.set(key,JSON.parse(JSON.stringify(value)));w.$=id=>w.document.getElementById(id);w.toast=message=>toasts.push(message);
 w.tasks=[{id:'class-a',track:'class',title:'Design a schema',course:'IS 350',description:'Create tables for a library.',due:'2026-12-01',dueTime:'17:00',skills:['skill-a']},{id:'class-b',track:'class',title:'Other assignment',course:'IS 350'},{id:'skill-a',track:'skill',title:'SQL joins',level:2,goal:'Explain join behavior'},{id:'project-a',track:'project',title:'Project code',course:'Folder project'}];
 w.current={active,wrapUp:{}};w.T=id=>w.tasks.find(task=>task.id===id);w.typeOf=task=>task.track;w.skillLevel=task=>task.level||1;w.chatKey=task=>task.id;w.coachTurns={};
 w.renderCoachLog=()=>legacy.push('log');w.renderWork=()=>{legacy.push('work');w.renderCoachLog();};w.sendCoach=async(text,show)=>{legacy.push({text,show});return {legacy:true};};w.sample=()=>{throw Error('Legacy API must never run for study chats');};
 w.fmtMsg=(text,ai)=>{formatted.push({text,ai});const div=w.document.createElement('div');div.textContent=text;return div.innerHTML.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');};
 w.SessionCompanion={chatGPTStatus:async()=>{calls.push({type:'status'});return {connected,planUsageEnabled:connected,account:{client_id:account,email:'learner@example.com'}};},chatGPTModels:async()=>{calls.push({type:'models'});return {models};},chatGPTStart:async options=>{calls.push({type:'start',options});if(start)return start(options);options.onEvent({type:'response.output_text.delta',delta:'**Concept** explained'});options.onEvent({type:'response.completed'});}};
 w.eval(source);return {dom,w,data,calls,toasts,formatted,legacy};
}
test('class study chat uses private ChatGPT live model, fixed Medium, assignment context, and Markdown replies',async()=>{
 const app=boot();try{await app.w.SessionStudyChats.refresh();assert.equal(app.w.SessionStudyChats.state.ready,true);assert.equal(app.w.SessionStudyChats.setEffort('low'),false);
 const result=await app.w.sendCoach('Help me understand <img src=x onerror=alert(1)>');assert.equal(result.completed,true);assert.equal(result.sent,true);assert.equal(result.text,'**Concept** explained');const request=app.calls.find(call=>call.type==='start').options;assert.equal(request.model,'newest-model');assert.equal(request.effort,'medium');assert(request.messages[0].content.includes('Design a schema'));assert(request.messages[0].content.includes('IS 350'));assert(request.messages[0].content.includes('2026-12-01'));assert(request.messages[0].content.includes('SQL joins'));assert(!('workspace'in request));
 const record=app.data.get('sb.studyChats')['class-a'];assert.equal(record.messages.length,2);assert.equal(record.messages[1].content,'**Concept** explained');assert.equal(app.w.document.querySelector('#coach-log img'),null);assert(app.w.document.querySelector('#coach-log strong'));assert(app.formatted.every(value=>value.ai===true));assert.equal(app.w.coachTurns['class-a'].length,2);
 }finally{app.dom.window.close();}
});
test('class assignments and skills retain independent conversations and newest model overrides a saved older choice',async()=>{
 const values={'sb.studyChatAccount':'account-a','sb.chatgptAccount':'account-a','sb.studyChats':{'class-a':{account:'account-a',model:'older-model',effort:'low',messages:[{role:'user',content:'Old question'},{role:'assistant',content:'Earlier response'}]}}};
 const app=boot({values,models:[{slug:'newest-model'},{slug:'older-model'}]});try{await app.w.SessionStudyChats.refresh();assert.equal(app.w.SessionStudyChats.state.model,'newest-model');assert.equal(app.w.SessionStudyChats.state.effort,'medium');await app.w.sendCoach('Follow up');
 app.w.current.active='class-b';app.w.renderWork();await app.w.sendCoach('Second assignment');app.w.current.active='skill-a';app.w.current.wrapUp['skill-a']=true;app.w.renderWork();await app.w.sendCoach('Teach back time');const request=app.calls.filter(call=>call.type==='start').at(-1).options;assert.match(request.messages[0].content,/SQL joins/);assert.match(request.messages[0].content,/Explain join behavior/);assert.match(request.messages[0].content,/teach this skill back/);assert(!request.messages.some(message=>message.content==='Follow up'));const histories=app.data.get('sb.studyChats');assert.equal(Object.keys(histories).length,3);assert.equal(histories['class-a'].messages.length,4);assert.equal(histories['class-b'].messages.length,2);assert.equal(histories['skill-a'].messages.length,2);
 }finally{app.dom.window.close();}
});
test('not-connected state offers the actual AI preference tab without using legacy inference',async()=>{
 const app=boot({connected:false});try{await app.w.SessionStudyChats.refresh();let view,clicked=false;app.w.SessionTVLocal={openSetup:value=>view=value};app.w.document.getElementById('pref-tab-ai').onclick=()=>clicked=true;app.w.document.querySelector('.study-chat-status button').click();assert.equal(view,'preferences');assert.equal(clicked,true);assert.equal((await app.w.sendCoach('Question')).sent,false);assert(!app.calls.some(call=>call.type==='start'));assert.equal(app.w.document.getElementById('coach-send').disabled,true);
 }finally{app.dom.window.close();}
});
test('public demo cannot fetch model catalogs, start AI, or show private histories',async()=>{
 const app=boot({mode:'demo',values:{'sb.studyChats':{'class-a':{account:'account-a',messages:[{role:'assistant',content:'Private material'}]}}}});try{assert.equal((await app.w.sendCoach('Question')).sent,false);await app.w.SessionStudyChats.refresh();assert.equal(app.calls.length,0);assert(!app.w.document.getElementById('coach-log').textContent.includes('Private material'));assert.equal(app.w.document.getElementById('coach-form').hidden,true);
 }finally{app.dom.window.close();}
});
test('project send/render paths delegate unchanged and never fetch ChatGPT study models',async()=>{
 const app=boot({active:'project-a'});try{assert.deepEqual(await app.w.sendCoach('Build this','Build'),{legacy:true});app.w.renderCoachLog();app.w.renderWork();assert.equal(app.calls.length,0);assert(app.legacy.some(value=>value.text==='Build this'));assert(app.legacy.includes('work'));assert(app.legacy.includes('log'));
 }finally{app.dom.window.close();}
});
test('failed and incomplete streams preserve user messages and partial replies with visible recovery',async()=>{
 for(const type of ['error','response.failed','response.incomplete','unfinished']){
  const app=boot({start:async({onEvent})=>{onEvent({type:'response.output_text.delta',delta:'Partial answer'});if(type!=='unfinished')onEvent({type,message:'Usage unavailable'});}});try{await app.w.SessionStudyChats.refresh();const result=await app.w.sendCoach('Question');assert.equal(result.completed,false);const history=app.data.get('sb.studyChats')['class-a'];assert.equal(history.messages[0].content,'Question');assert.equal(history.messages[1].content,'Partial answer');assert.match(app.w.document.getElementById('coach-log').textContent,type==='unfinished'?/before completion/:/Usage unavailable/);assert.equal(app.w.SessionStudyChats.state.busy,false);
  }finally{app.dom.window.close();}
 }
});
test('Stop aborts inference and keeps the streamed portion',async()=>{
 let started;const app=boot({start:({onEvent,signal})=>new Promise((resolve,reject)=>{onEvent({type:'response.output_text.delta',delta:'First half'});started=()=>{assert.equal(signal.aborted,true);reject(new app.w.DOMException('Stopped','AbortError'));};signal.addEventListener('abort',()=>started());})});try{await app.w.SessionStudyChats.refresh();const sending=app.w.sendCoach('Question');await wait(()=>started);assert.match(app.w.document.getElementById('coach-log').textContent,/First half/);app.w.SessionStudyChats.stop();const result=await sending;assert.equal(result.completed,false);assert.equal(app.data.get('sb.studyChats')['class-a'].messages[1].content,'First half');assert.match(app.w.document.getElementById('coach-log').textContent,/Stopped/);
 }finally{app.dom.window.close();}
});
test('sign-out invalidates delayed callbacks and prevents stale history or DOM updates',async()=>{
 let resume,observed;const app=boot({start:options=>{observed=options;return new Promise(resolve=>resume=()=>{options.onEvent({type:'response.output_text.delta',delta:'Secret after logout'});options.onEvent({type:'response.completed'});resolve();});}});try{await app.w.SessionStudyChats.refresh();const sending=app.w.sendCoach('Original');await wait(()=>resume);const before=JSON.stringify(app.data.get('sb.studyChats'));app.w.SessionWorkspace.mode='demo';app.w.SessionWorkspace.readOnly=true;app.w.SessionCloud.user=null;app.w.dispatchEvent(new app.w.Event('sessiontv:auth'));resume();await sending;assert.equal(observed.signal.aborted,true);assert.equal(JSON.stringify(app.data.get('sb.studyChats')),before);assert(!app.w.document.getElementById('coach-log').textContent.includes('Secret after logout'));
 }finally{app.dom.window.close();}
});
test('account changes clear earlier account study history before a new request',async()=>{
 const app=boot();try{await app.w.SessionStudyChats.refresh();await app.w.sendCoach('Old account question');app.data.set('sb.chatgptChats',[{role:'user',content:'Old general conversation'}]);app.w.SessionCompanion.chatGPTStatus=async()=>({connected:true,account:{client_id:'account-b'}});await app.w.SessionStudyChats.refresh();assert.deepEqual(app.data.get('sb.studyChats'),{});assert.deepEqual(app.data.get('sb.chatgptChats'),[]);await app.w.sendCoach('New account question');const request=app.calls.filter(call=>call.type==='start').at(-1).options;assert(!request.messages.some(message=>message.content==='Old account question'));assert.equal(app.data.get('sb.studyChats')['class-a'].account,'account-b');
 }finally{app.dom.window.close();}
});
test('large context and full histories produce bounded paired requests under the companion body limit',async()=>{
 const messages=Array.from({length:60},(_,index)=>({role:index%2?'assistant':'user',content:'界'.repeat(1000)}));const values={'sb.studyChatAccount':'account-a','sb.chatgptAccount':'account-a','sb.studyChats':{'class-a':{account:'account-a',messages}}};const app=boot({values});try{app.w.tasks[0].description='界'.repeat(100000);await app.w.SessionStudyChats.refresh();await app.w.sendCoach('Explain this');const request=app.calls.find(call=>call.type==='start').options;const body={model:request.model,effort:request.effort,messages:request.messages};assert(new TextEncoder().encode(JSON.stringify(body)).length<=30000);assert(request.messages.length<62);assert.equal(request.messages[1].role,'user');assert.equal(app.data.get('sb.studyChats')['class-a'].messages.length,62);
 }finally{app.dom.window.close();}
});

test('initial boot and an auth refresh initialize the study provider once without render loops',async()=>{
 const app=boot();try{await wait(()=>app.w.SessionStudyChats.state.ready);assert.equal(app.calls.filter(call=>call.type==='status').length,1);assert.equal(app.calls.filter(call=>call.type==='models').length,1);
 app.w.dispatchEvent(new app.w.Event('sessiontv:auth'));assert.equal(app.w.document.getElementById('coach-form').hidden,true);app.w.renderWork();await wait(()=>app.w.SessionStudyChats.state.ready);assert.equal(app.w.document.getElementById('coach-form').hidden,false);assert.equal(app.calls.filter(call=>call.type==='status').length,2);assert.equal(app.calls.filter(call=>call.type==='models').length,2);
 }finally{app.dom.window.close();}
 const disconnected=boot({connected:false});try{await wait(()=>disconnected.w.document.querySelector('.study-chat-status button'));await new Promise(resolve=>setTimeout(resolve,25));assert.equal(disconnected.calls.filter(call=>call.type==='status').length,1);assert.equal(disconnected.calls.filter(call=>call.type==='models').length,0);}finally{disconnected.dom.window.close();}
});
