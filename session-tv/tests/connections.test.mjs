import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../public/js/connections.js',import.meta.url),'utf8');
const settle=()=>new Promise(r=>setTimeout(r,20));
function boot(mode='private',computer={connected:true,signedIn:true},chat={connected:true}){
 const dom=new JSDOM('<div id="session-connection-summary"></div>',{url:'https://tannermayfield.dev/session-tv/',runScripts:'dangerously'}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.SessionWorkspace={mode};w.SessionCloud={user:{id:'owner'}};w.renderSettings=()=>{};w.toast=()=>{};w.SessionCompanion={status:async()=>computer,chatGPTStatus:async()=>chat};w.eval(source);return {dom,w};
}
test('overview uses verified green statuses for both connected services',async()=>{const {dom,w}=boot();try{await settle();assert.equal(w.document.querySelectorAll('.connection-state.connected').length,2);assert.equal(w.document.querySelectorAll('.connection-row button:not([hidden])').length,0)}finally{dom.window.close()}});
test('unpaired computer provides setup and ChatGPT sign-in routes to guide',async()=>{const {dom,w}=boot('private',{connected:false,signedIn:false},{connected:false});try{await settle();const buttons=w.document.querySelectorAll('.connection-row button');assert.equal(buttons[0].textContent,'Sign in with ChatGPT');assert.equal(buttons[1].textContent,'Setup');buttons[1].click();assert.equal(w.document.getElementById('companion-setup').open,true);assert.equal(w.document.getElementById('setup-owner').textContent,'owner');assert.match(w.document.getElementById('companion-setup').textContent,/companion\\install-background/)}finally{dom.window.close()}});
test('public visitors cannot initiate either connection or open setup',async()=>{const {dom,w}=boot('demo');try{await settle();assert.equal(w.document.querySelectorAll('.connection-row button:disabled').length,2);w.SessionConnections.setup();assert.equal(w.document.getElementById('companion-setup').open,false)}finally{dom.window.close()}});
