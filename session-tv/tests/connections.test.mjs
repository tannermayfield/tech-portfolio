import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../public/js/connections.js',import.meta.url),'utf8'),hooks=readFileSync(new URL('../public/js/core/hooks.js',import.meta.url),'utf8');
const settle=()=>new Promise(r=>setTimeout(r,20));
function boot(mode='private',computer={connected:true,signedIn:true},chat={connected:true}){
 const dom=new JSDOM('<div id="session-connection-summary"></div>',{url:'https://tannermayfield.dev/session-tv/',runScripts:'dangerously'}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.SessionWorkspace={mode};w.SessionCloud={user:{id:'owner'}};w.renderSettings=()=>{};w.toast=()=>{};w.SessionCompanion={status:async()=>computer,chatGPTStatus:async()=>chat,canvasStatus:async()=>({connected:true})};w.eval(hooks);w.eval(source);return {dom,w};
}
test('overview uses verified green statuses for both connected services',async()=>{const {dom,w}=boot();try{await settle();assert.equal(w.document.querySelectorAll('.connection-state.connected').length,3);assert.equal(w.document.querySelectorAll('.connection-row button:not([hidden])').length,0)}finally{dom.window.close()}});
test('unpaired computer provides setup and ChatGPT sign-in routes to guide',async()=>{const {dom,w}=boot('private',{connected:false,signedIn:false},{connected:false});try{await settle();const buttons=w.document.querySelectorAll('.connection-row button');assert.equal(buttons[0].textContent,'Sign in with ChatGPT');assert.equal(buttons[1].textContent,'Setup');buttons[1].click();assert.equal(w.document.getElementById('companion-setup').open,true);assert.equal(w.document.getElementById('setup-owner').textContent,'owner');assert.match(w.document.getElementById('companion-setup').textContent,/companion\\install-background/)}finally{dom.window.close()}});
test('public visitors cannot initiate either connection or open setup',async()=>{const {dom,w}=boot('demo');try{await settle();assert.equal(w.document.querySelectorAll('.connection-row button:disabled').length,3);w.SessionConnections.setup();assert.equal(w.document.getElementById('companion-setup').open,false)}finally{dom.window.close()}});
test('after the first check the summary keeps its last status while refreshing in the background',async()=>{
 const computer={connected:true,signedIn:true};const {dom,w}=boot('private',computer);try{
  const host=w.document.getElementById('session-connection-summary'),states=node=>[...node.querySelectorAll('.connection-state')].map(item=>item.textContent);
  assert.deepEqual(states(host),['Reading…','Reading…','Reading…'],'only the first verification reads');
  await settle();assert.deepEqual(states(host),['Connected','Connected','Connected']);
  const seen=[];new w.MutationObserver(()=>seen.push(states(host).join())).observe(host,{childList:true,subtree:true,characterData:true});
  w.dispatchEvent(new w.Event('focus'));await w.SessionConnections.refresh(true);w.SessionTV.hooks.run('settings:render',[],()=>{});await settle();
  assert.deepEqual(seen,[],'unchanged results do not redraw');
  // a new Settings card shows the last known status at once
  const fresh=w.document.createElement('div');fresh.id='session-connection-summary';host.replaceWith(fresh);w.SessionConnections.refresh();
  assert.deepEqual(states(fresh),['Connected','Connected','Connected']);
  // a real change (the companion stops) updates the text
  computer.connected=false;computer.signedIn=false;computer.error='Computer disconnected';await settle();await w.SessionConnections.refresh(true);
  assert.equal(states(fresh)[1],'Computer disconnected');
  // signing out or in starts over with a first verification
  w.dispatchEvent(new w.Event('sessiontv:auth'));assert.equal(states(fresh)[0],'Reading…');
 }finally{dom.window.close()}
});
