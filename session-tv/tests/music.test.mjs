import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../public/js/music.js',import.meta.url),'utf8'),hooks=readFileSync(new URL('../public/js/core/hooks.js',import.meta.url),'utf8');
const playlist=kind=>({url:'https://music.apple.com/us/playlist/'+kind+'/pl.'+kind});
function boot(mode='private',config={playlists:{class:playlist('class'),skill:playlist('skill'),project:playlist('project')}}){
 const dom=new JSDOM('<div id="song-note"></div><div id="settings"></div>',{url:'https://example.com',runScripts:'outside-only'}),w=dom.window;
 const values={'sb.music':{player:'embed',...config}};w.SessionWorkspace={mode};w.TV={mode:'task'};w.current={mood:'class'};
 w.recall=(key,fallback)=>values[key]??fallback;w.store=(key,value)=>values[key]=value;
 w.eval(hooks);const hook=name=>()=>w.SessionTV.hooks.run(name,[],()=>{});
 w.renderWork=hook('work:render');w.renderGuide=hook('guide:render');w.renderSong=hook('song:render');w.playlistUrl=()=>'';w.toast=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.eval(source);return {dom,w,values,music:w.SessionMusic};
}
test('free radio loads on demand and rejects foreign URLs and library-only IDs',()=>{
 const app=boot();try{
  assert.equal(app.w.document.querySelector('iframe'),null);
  assert.throws(()=>app.music.validateURL('https://example.com/us/playlist/pl.bad'),/share link/);
  assert.throws(()=>app.music.validateURL('https://music.apple.com/library/playlists/p.bad'),/share link/);
  assert.equal(app.music.validateURL('https://embed.music.apple.com/us/playlist/name/pl.u-123?x=1'),'https://music.apple.com/us/playlist/name/pl.u-123');
  app.music.openRadio();const frame=app.w.document.querySelector('iframe');
  assert.equal(new URL(frame.src).hostname,'embed.music.apple.com');assert.equal(new URL(frame.src).searchParams.get('autoplay'),'true');
  assert.match(frame.allow,/autoplay/);assert.equal(app.w.document.getElementById('tv-radio').open,true);
 }finally{app.dom.window.close()}
});
test('radio refreshes when sections change and preserves its frame when collapsed or rerendered',()=>{
 const app=boot();try{
  app.music.openRadio();const first=app.w.document.querySelector('iframe');
  app.w.document.querySelector('[data-radio-close]').click();app.w.renderWork();
  assert.equal(app.w.document.querySelector('iframe'),first);assert.equal(app.w.document.getElementById('tv-radio').open,false);
  app.w.current.mood='skill';app.w.renderWork();const second=app.w.document.querySelector('iframe');assert.notEqual(second,first);assert.match(second.src,/pl.skill/);
  first.onload();assert.equal(app.w.document.querySelector('[data-radio-status]').textContent,'Loading Apple Music…');
  second.onload();assert.match(app.w.document.querySelector('[data-radio-status]').textContent,/Autoplay requested/);
  app.w.TV.mode='guide';app.w.TV.guideCat='project';app.w.renderGuide();assert.match(app.w.document.querySelector('iframe').src,/pl.project/);
 }finally{app.dom.window.close()}
});
test('stop and sign-out unload the iframe and prevent automatic restart',()=>{
 const app=boot();try{
  app.music.openRadio();app.music.stop();app.w.current.mood='skill';app.w.renderWork();assert.equal(app.w.document.querySelector('iframe'),null);
  app.music.openRadio();assert.ok(app.w.document.querySelector('iframe'));
  app.w.SessionWorkspace.mode='demo';app.w.dispatchEvent(new app.w.Event('sessiontv:auth'));assert.equal(app.w.document.querySelector('iframe'),null);assert.equal(app.w.document.getElementById('tv-radio').open,false);
 }finally{app.dom.window.close()}
 const demo=boot('demo');try{demo.music.openRadio();assert.equal(demo.w.document.querySelector('iframe'),null)}finally{demo.dom.window.close()}
});
test('settings save section links and autoplay choice atomically, preserving old library records',()=>{
 const app=boot('private',{playlists:{class:{libraryId:'p.saved',name:'Saved'}}});try{
  app.music.mountSettings(app.w.document.getElementById('settings'));const form=app.w.document.querySelector('form');
  assert.equal(form.elements.developerToken,undefined);form.elements.skill.value='https://evil.example/playlist/pl.bad';
  form.dispatchEvent(new app.w.Event('submit',{cancelable:true}));assert.equal(app.values['sb.music'].playlists.skill,undefined);
  form.elements.skill.value=playlist('skill').url;form.elements.tryAutoplay.checked=false;
  form.dispatchEvent(new app.w.Event('submit',{cancelable:true}));assert.equal(app.values['sb.music'].playlists.class.libraryId,'p.saved');assert.equal(app.values['sb.music'].tryAutoplay,false);
  app.w.current.mood='skill';app.music.openRadio();assert.equal(new URL(app.w.document.querySelector('iframe').src).search,'');
 }finally{app.dom.window.close()}
});
test('disabling automatic switching retains the loaded playlist until the radio is opened again',()=>{
 const app=boot();try{
  app.values['sb.music'].autoSwitch=false;app.music.openRadio();const first=app.w.document.querySelector('iframe');
  app.w.current.mood='project';app.w.renderWork();assert.equal(app.w.document.querySelector('iframe'),first);
  app.music.openRadio();assert.match(app.w.document.querySelector('iframe').src,/pl.project/);
 }finally{app.dom.window.close()}
});

test('switching to the free player assigns the requested playlists once and keeps later edits',()=>{
 const app=boot();try{
  app.values['sb.music']={playlists:{class:{libraryId:'p.old'}}};
  app.music.mountSettings(app.w.document.getElementById('settings'));
  assert.match(app.values['sb.music'].playlists.class.url,/pl.u-vxy6JJxI82jM32P/);
  assert.match(app.values['sb.music'].playlists.skill.url,/pl.u-vxy6JJxI82jM32P/);
  assert.match(app.values['sb.music'].playlists.project.url,/pl.u-RRbVLGNTebXKMbo/);
  app.values['sb.music'].playlists.class=playlist('custom');app.music.mountSettings(app.w.document.getElementById('settings'));
  assert.equal(app.w.document.querySelector('form').elements.class.value,playlist('custom').url);
 }finally{app.dom.window.close()}
});
