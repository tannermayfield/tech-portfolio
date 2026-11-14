import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../public/js/music.js',import.meta.url),'utf8');
const playlist=kind=>({url:'https://music.apple.com/us/playlist/'+kind+'/pl.'+kind,name:kind});
function boot({mode='private',preferences={playlists:{class:playlist('class'),skill:playlist('skill'),project:playlist('project')}}}={}){
 const dom=new JSDOM('<div id="song-note"></div><div id="settings"></div>',{url:'https://example.com',runScripts:'outside-only'}),w=dom.window,calls=[],values={'sb.music':preferences},events={};
 w.SessionWorkspace={mode};w.SessionCloud={user:{id:'owner'}};w.TV={mode:'task'};w.current={mood:'class'};
 w.recall=(key,fallback)=>values[key]??fallback;w.store=(key,value)=>{values[key]=value};w.renderWork=()=>{};w.renderGuide=()=>{};w.renderSong=()=>{};w.openPlaylist=()=>{};w.playlistUrl=()=>'';w.toast=()=>{};
 const player={isAuthorized:false,isPlaying:false,nowPlayingItem:null,
  addEventListener(name,fn){events[name]=fn},
  removeEventListener(name,fn){if(events[name]===fn)delete events[name]},
  async authorize(){calls.push('authorize');this.isAuthorized=true},
  async unauthorize(){calls.push('unauthorize');this.isAuthorized=false},
  async pause(){calls.push('pause');this.isPlaying=false},
  async play(){calls.push('play');this.isPlaying=true},
  async setQueue(value){calls.push(value)},
  async skipToNextItem(){calls.push('next')},async skipToPreviousItem(){calls.push('prev')},
  api:{async music(url){calls.push(url);return {data:{data:[{id:'p.first',attributes:{name:'First library playlist'}}]}}}}
 };
 w.MusicKit={async configure(value){calls.push({configure:value})},getInstance:()=>player};
 w.eval(source);return {dom,w,calls,values,player,events,music:w.SessionMusic};
}
const token='header.payload.signature';
test('MusicKit stays private and idle until explicitly connected',async()=>{
 const app=boot({mode:'demo'});
 try{app.music.mountSettings(app.w.document.getElementById('settings'));assert.equal(app.w.document.getElementById('settings').hidden,true);await assert.rejects(app.music.connect(token),/Sign in/);assert.deepEqual(app.calls,[]);assert.equal(app.w.document.querySelector('iframe'),null)}finally{app.dom.window.close()}
});
test('connect configures MusicKit without starting playback and transport plays section queues',async()=>{
 const app=boot();try{
  await app.music.connect(token);assert.ok(app.calls.includes('authorize'));assert.equal(app.calls.includes('play'),false);
  assert.equal(app.w.localStorage.getItem('sessiontv.musickit.owner'),token);assert.equal(JSON.stringify(app.values).includes(token),false);
  await app.music.control('play');assert.equal(app.player.isPlaying,true);assert.ok(app.calls.some(value=>value.url===playlist('class').url));
  await app.music.control('next');assert.ok(app.calls.includes('next'));await app.music.control('play');assert.equal(app.player.isPlaying,false);
 }finally{app.dom.window.close()}
});
test('playlist settings validate Apple URLs and retain saved library choices',async()=>{
 const app=boot({preferences:{playlists:{class:{libraryId:'p.saved',name:'Saved playlist'},skill:playlist('skill')}}});try{
  assert.throws(()=>app.music.validateURL('https://example.com/us/playlist/fake'),/music.apple.com/);
  assert.throws(()=>app.music.validateURL('javascript:alert(1)'),/music.apple.com/);
  app.music.mountSettings(app.w.document.getElementById('settings'));const form=app.w.document.querySelector('form');
  assert.equal(form.querySelector('[data-library=class]').value,'p.saved');
  form.dispatchEvent(new app.w.Event('submit',{cancelable:true}));assert.equal(app.values['sb.music'].playlists.class.libraryId,'p.saved');
  await app.music.connect(token);await app.music.loadLibrary();assert.ok(form.querySelector('[data-library=skill]').textContent.includes('First library playlist'));
  app.music.mountSettings(app.w.document.getElementById('settings'));assert.equal(app.w.document.querySelectorAll('form').length,1);
 }finally{app.dom.window.close()}
});
test('section changes serialize queues and never play a stale selection',async()=>{
 const app=boot();try{
  await app.music.connect(token);await app.music.control('play');
  let release;const blocked=new Promise(resolve=>release=resolve);let entered=false;
  app.player.setQueue=async value=>{app.calls.push(value);if(value.url===playlist('skill').url){entered=true;await blocked}};
  app.w.current.mood='skill';app.music.syncSection();
  for(let i=0;i<20&&!entered;i++)await new Promise(resolve=>setTimeout(resolve,0));assert.equal(entered,true);
  app.w.current.mood='project';app.music.syncSection();const plays=app.calls.filter(value=>value==='play').length;release();
  for(let i=0;i<20&&app.calls.filter(value=>value==='play').length===plays;i++)await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(app.calls.filter(value=>value==='play').length,plays+1);
  const lastQueue=app.calls.filter(value=>value&&typeof value==='object'&&value.url).at(-1);assert.equal(lastQueue.url,playlist('project').url);
  app.w.SessionWorkspace.mode='demo';app.music.cleanup();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(app.player.isPlaying,false);
 }finally{app.dom.window.close()}
});
test('failed authorization can be retried with the configured token',async()=>{
 const app=boot();try{
  app.player.authorize=async()=>{throw new Error('Authorization declined')};await assert.rejects(app.music.connect(token),/declined/);
  app.player.authorize=async()=>{app.player.isAuthorized=true};await app.music.connect(token);assert.equal(app.player.isAuthorized,true);
  await app.music.disconnect();assert.equal(app.w.localStorage.getItem('sessiontv.musickit.owner'),null);assert.equal(app.player.isAuthorized,false);
 }finally{app.dom.window.close()}
});


test('MusicKit initialization waits for musickitloaded after the script load event',async()=>{
 const app=boot();try{
  const SDK=app.w.MusicKit;delete app.w.MusicKit;
  const connection=app.music.connect(token);
  const script=app.w.document.querySelector('script');assert.equal(script.src,'https://js-cdn.music.apple.com/musickit/v3/musickit.js');
  script.onload();await Promise.resolve();assert.equal(app.calls.length,0);
  app.w.MusicKit=SDK;app.w.document.dispatchEvent(new app.w.Event('musickitloaded'));
  await connection;assert.equal(app.player.isAuthorized,true);assert.equal(script.onload,null);
 }finally{app.dom.window.close()}
});

test('failed SDK loading cleans up and permits a fresh connection attempt',async()=>{
 const app=boot();try{
  const SDK=app.w.MusicKit;delete app.w.MusicKit;
  const failed=app.music.connect(token);app.w.document.querySelector('script').onerror();
  await assert.rejects(failed,/could not load/);assert.equal(app.w.document.querySelectorAll('script').length,0);
  const retry=app.music.connect(token);app.w.MusicKit=SDK;app.w.document.dispatchEvent(new app.w.Event('musickitloaded'));
  await retry;assert.equal(app.player.isAuthorized,true);
 }finally{app.dom.window.close()}
});

test('cancelled authorization is not reported as connected',async()=>{
 const app=boot();try{
  app.player.authorize=async()=>undefined;
  await assert.rejects(app.music.connect(token),/sign-in was cancelled/);
  assert.equal(app.w.localStorage.getItem('sessiontv.musickit.owner'),null);
  assert.equal(app.w.document.querySelector('[data-sn=play]').disabled,true);
 }finally{app.dom.window.close()}
});

test('library playlist pagination uses authorized API requests and queues library IDs',async()=>{
 const app=boot({preferences:{playlists:{class:{libraryId:'p.saved',name:'Saved playlist'}}}});try{
  await app.music.connect(token);
  let page=0;app.player.api.music=async path=>{
   app.calls.push(path);page++;
   return {data:{data:[{id:'p.'+page,attributes:{name:'Playlist '+page}}],next:page===1?'/v1/me/library/playlists?offset=100':undefined}};
  };
  app.music.mountSettings(app.w.document.getElementById('settings'));await app.music.loadLibrary();
  assert.equal(app.w.document.querySelectorAll('[data-library=class] option').length,4);
  assert.equal(app.calls.filter(value=>value==='authorize').length,2);
  await app.music.control('play');assert.ok(app.calls.some(value=>value.playlist==='p.saved'));
  assert.equal(app.music.validateURL('https://music.apple.com/library/playlists/p.saved'),'https://music.apple.com/library/playlists/p.saved');
 }finally{app.dom.window.close()}
});

test('MusicKit playback and DRM errors surface in settings and disconnect removes listeners',async()=>{
 const app=boot();try{
  await app.music.connect(token);app.music.mountSettings(app.w.document.getElementById('settings'));
  app.events.mediaPlaybackError({message:'Subscription unavailable'});
  assert.match(app.w.document.querySelector('[data-music-status]').textContent,/Subscription unavailable/);
  app.events.drmUnsupported();assert.match(app.w.document.querySelector('[data-music-status]').textContent,/protected-content/);
  await app.music.disconnect();assert.equal(Object.keys(app.events).length,0);
 }finally{app.dom.window.close()}
});


test('sign-out during SDK configuration cannot open Apple authorization or retain a token',async()=>{
 const app=boot();try{
  let release,entered=false;const blocked=new Promise(resolve=>release=resolve);
  app.w.MusicKit.configure=async()=>{entered=true;await blocked};
  const connection=app.music.connect(token);
  for(let i=0;i<20&&!entered;i++)await new Promise(resolve=>setTimeout(resolve,0));
  app.music.cleanup();release();await assert.rejects(connection,/cancelled/);
  assert.equal(app.calls.includes('authorize'),false);
  assert.equal(app.w.localStorage.getItem('sessiontv.musickit.owner'),null);
 }finally{app.dom.window.close()}
});
