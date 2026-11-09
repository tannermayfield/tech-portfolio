/* Isolated persistence. Original local data is never selected by the public demo. */
(() => {
 const memory = new Map(), callbacks = new Set();
 let native; try { native=window.localStorage; const k='sessiontv.probe';native.setItem(k,'1');native.removeItem(k); } catch { native=null; }
 const legacy = ['localhost','127.0.0.1'].includes(location.hostname) && !location.pathname.startsWith('/session-tv');
 let mode=legacy?'legacy':'demo', privateValues={};
 const keys=()=>mode==='private'?Object.keys(privateValues):mode==='legacy'&&native?Array.from({length:native.length},(_,i)=>native.key(i)).filter(k=>k==='sessiontv.database.v1'||k.startsWith('sb.')):[...memory.keys()];
 const storage={get length(){return keys().length},key:i=>keys()[i]??null,
  getItem(key){if(mode==='private')return privateValues[key]??null;if(mode==='demo')return memory.get(key)??null;return memory.has(key)?memory.get(key):native?.getItem(key)??null},
  setItem(key,value){value=String(value);if(mode==='demo'){memory.set(key,value);return;}if(mode==='private'){privateValues[key]=value;for(const cb of callbacks)cb(key,value);return;}try{if(!native)throw Error();native.setItem(key,value);memory.delete(key)}catch{memory.set(key,value)}},
  removeItem(key){if(mode==='private'){delete privateValues[key];for(const cb of callbacks)cb(key,null);return;}memory.delete(key);if(mode==='demo')return;try{native?.removeItem(key)}catch{}},
  clear(){for(const key of keys())storage.removeItem(key)}
 };
 function sample(){const due=days=>new Date(Date.now()+days*864e5).toISOString().slice(0,10);return {tasks:{
  'demo-cs':{track:'class',title:'Practice loops and functions',course:'CS 101 — Introduction to Programming',goal:'Explain a loop with a small example',due:due(2),status:'todo',order:1},
  'demo-math':{track:'class',title:'Compare sample distributions',course:'MATH 210 — Applied Statistics',due:due(4),status:'todo',order:2},
  'demo-db':{track:'class',title:'Draw a library database schema',course:'IS 350 — Database Fundamentals',due:due(6),status:'todo',order:3},
  'demo-sql':{track:'develop',title:'SQL joins and grouping',course:'SQL',level:2,status:'todo',order:1},
  'demo-js':{track:'develop',title:'JavaScript fundamentals',course:'JavaScript',level:1,status:'todo',order:2},
  'demo-project':{track:'project',title:'Build the reading list screen',course:'Campus Reading List',goal:'Create an accessible list and filter',status:'todo',order:1},
  'demo-project-test':{track:'project',title:'Test keyboard navigation',course:'Campus Reading List',status:'todo',order:2}
 },settings:{main:{portfolioUrl:'https://tannermayfield.dev/',autoOpen:false}},projects:{},sessions:{},state:{}}}
 if(mode==='demo')storage.setItem('sessiontv.database.v1',JSON.stringify(window.SessionTVDemo?.database?SessionStore.validate(window.SessionTVDemo.database):sample()));
 window.SessionWorkspace={get mode(){return mode},get readOnly(){return mode==='demo'},get snapshotSource(){return window.SessionTVDemo?.source||'sample'},storage,get persistent(){return mode!=='demo'&&!!native},
  setPrivate(id){if(!id)throw Error('User required');mode='private';privateValues={}},
  hydratePrivate(values){privateValues={...values}},clearPrivate(){privateValues={};callbacks.clear()},onPrivateChange(cb){callbacks.add(cb);return()=>callbacks.delete(cb)},
  resetDemo(){throw Error('This preview is read-only. Reload to return to the published snapshot.')},
  legacyBackup(){const values={};if(native)for(let i=0;i<native.length;i++){const k=native.key(i);if(k==='sessiontv.database.v1'||k.startsWith('sb.'))values[k]=native.getItem(k)}return {format:'session-tv-backup',version:1,createdAt:new Date().toISOString(),values}},
  sample
 };
})();
