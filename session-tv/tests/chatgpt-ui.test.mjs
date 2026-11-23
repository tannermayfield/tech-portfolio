import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../public/js/chatgpt.js',import.meta.url),'utf8');
const wait=async check=>{for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,5))}throw Error('UI did not settle')};
function boot(mode='private'){
 const dom=new JSDOM('<div id="settings"></div>',{runScripts:'dangerously',url:'https://session.test'}),w=dom.window,data=new Map();
 w.SessionWorkspace={mode};w.recall=(k,d)=>data.get(k)??d;w.store=(k,v)=>data.set(k,JSON.parse(JSON.stringify(v)));
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
 w.SessionCompanion={chatGPTStatus:async()=>({connected:true,account:{email:'owner@example.test'}}),chatGPTModels:async()=>({models:[{slug:'account-model',display_name:'Account model'}]}),chatGPTStart:async({onEvent})=>{onEvent({type:'response.output_text.delta',delta:'Hello'});onEvent({type:'response.completed'})}};
 w.eval(source);return {dom,w,data};
}
test('private ChatGPT uses live account model and persists streamed messages',async()=>{
 const {dom,w,data}=boot();try{w.SessionChatGPT.mountSettings(w.document.getElementById('settings'));await wait(()=>w.document.getElementById('settings').textContent.includes('owner@example.test'));
 await w.SessionChatGPT.open();assert.equal(w.document.getElementById('chatgpt-model').value,'account-model');
 let request;w.SessionCompanion.chatGPTStart=async options=>{request=options;options.onEvent({type:'response.output_text.delta',delta:'<script>bad()</script>Hello'});options.onEvent({type:'response.completed'})};
 w.document.getElementById('chatgpt-input').value='Hi';w.document.getElementById('chatgpt-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await wait(()=>!w.document.getElementById('chatgpt-send').disabled);
 assert.equal(request.effort,'medium');assert.equal(request.model,'account-model');assert.equal(data.get('sb.chatgptChats')[0].content,'Hi');assert.equal(w.document.querySelector('#chatgpt-log script'),null);assert.match(w.document.getElementById('chatgpt-log').textContent,/Hello/);
 w.dispatchEvent(new w.Event('sessiontv:auth'));assert.equal(w.document.getElementById('chatgpt-chat'),null);
 }finally{dom.window.close()}
});
test('failed or prematurely ended streams show recovery without pretending success',async()=>{
 const {dom,w}=boot();try{await w.SessionChatGPT.open();w.SessionCompanion.chatGPTStart=async({onEvent})=>onEvent({type:'error',message:'Usage limit reached. Manage usage in ChatGPT settings.'});
 w.document.getElementById('chatgpt-input').value='Question';w.document.getElementById('chatgpt-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await wait(()=>!w.document.getElementById('chatgpt-send').disabled);assert.match(w.document.getElementById('chatgpt-status').textContent,/Usage limit reached/);assert.ok(w.document.querySelector('a[href="https://chatgpt.com/settings/usage"]'));
 w.SessionCompanion.chatGPTStart=async()=>{};w.document.getElementById('chatgpt-input').value='Again';w.document.getElementById('chatgpt-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await wait(()=>!w.document.getElementById('chatgpt-send').disabled);assert.match(w.document.getElementById('chatgpt-status').textContent,/before completion/);
 }finally{dom.window.close()}
});
test('demo cannot mount settings or open account chats',async()=>{
 const {dom,w}=boot('demo');try{let calls=0;w.SessionCompanion.chatGPTStatus=async()=>{calls++;return {connected:true}};w.SessionChatGPT.mountSettings(w.document.getElementById('settings'));await w.SessionChatGPT.open();assert.equal(calls,0);assert.equal(w.document.getElementById('chatgpt-chat'),null);assert.equal(w.document.getElementById('settings').textContent,'')}finally{dom.window.close()}
});

test('blocked sign-in popup preserves a safe fallback link',async()=>{
 const {dom,w}=boot();try{w.SessionCompanion.chatGPTStatus=async()=>({connected:false});w.SessionCompanion.connectChatGPT=async()=>({authorizationUrl:'https://auth.openai.com/api/accounts/authorize?state=example'});w.open=()=>null;w.SessionChatGPT.mountSettings(w.document.getElementById('settings'));await wait(()=>w.document.querySelector('#settings button'));w.document.querySelector('#settings button').click();await wait(()=>w.document.querySelector('a[href^="https://auth.openai.com/"]'));assert.match(w.document.getElementById('settings').textContent,/Finish signing in/)}finally{dom.window.close()}
});
test('sign-in rejects untrusted authorization URLs',async()=>{
 const {dom,w}=boot();try{let closed=false;w.open=()=>({close(){closed=true},location:{}});w.SessionCompanion.chatGPTStatus=async()=>({connected:false});w.SessionCompanion.connectChatGPT=async()=>({authorizationUrl:'https://evil.test/api/accounts/authorize'});w.SessionChatGPT.mountSettings(w.document.getElementById('settings'));await wait(()=>w.document.querySelector('#settings button'));w.document.querySelector('#settings button').click();await wait(()=>w.document.getElementById('settings').textContent.includes('Invalid sign-in URL'));assert.equal(closed,true);assert.equal(w.document.querySelector('a[href^="https://evil.test"]'),null)}finally{dom.window.close()}
});
test('sign-out while sign-in starts prevents delayed browser navigation',async()=>{
 const {dom,w}=boot();try{let resolve,closed=false,navigated=false;w.open=()=>({close(){closed=true},set opener(value){},location:{set href(value){navigated=true}}});w.SessionCompanion.chatGPTStatus=async()=>({connected:false});w.SessionCompanion.connectChatGPT=()=>new Promise(r=>resolve=r);w.SessionChatGPT.mountSettings(w.document.getElementById('settings'));await wait(()=>w.document.querySelector('#settings button'));w.document.querySelector('#settings button').click();w.SessionWorkspace.mode='demo';w.dispatchEvent(new w.Event('sessiontv:auth'));resolve({authorizationUrl:'https://auth.openai.com/api/accounts/authorize'});await wait(()=>closed);assert.equal(navigated,false);assert.equal(w.document.getElementById('settings').textContent,'')}finally{dom.window.close()}
});
