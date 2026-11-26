/* ---------- workspace: a hands-on editor beside the chat for skills you practice in code ---------- */
const CDN='https://cdnjs.cloudflare.com/ajax/libs/';
const WS_KINDS={
  sql:{label:'SQL editor',lang:'sql',mode:'text/x-sql',run:'Run query',file:'query.sql',
    starter:'-- Practice against the airline sample database. Click Tables to see what\'s in it.\nSELECT origin, COUNT(*) AS flights\nFROM flights\nGROUP BY origin\nORDER BY flights DESC;\n'},
  python:{label:'Python editor',lang:'python',mode:'python',run:'Run',file:'main.py',
    starter:'# The airline sample data is here too: flights.csv, airports.csv, airlines.csv, bookings.csv\nimport csv\n\nwith open("flights.csv") as f:\n    rows = list(csv.DictReader(f))\nprint(len(rows), "flights")\n'},
  js:{label:'JavaScript editor',lang:'javascript',mode:'javascript',run:'Run',file:'main.js',
    starter:'// console.log() output shows below\nconst delays = [12, null, 45, 0, 7];\nconst valid = delays.filter(d => d !== null);\nconsole.log(valid.reduce((a, b) => a + b, 0) / valid.length);\n'},
  html:{label:'HTML/CSS editor',lang:'html',mode:'htmlmixed',run:'Preview',file:'index.html',
    starter:'<!doctype html>\n<html>\n<head>\n\n</head>\n<body>\n  <h1>Hello</h1>\n</body>\n</html>\n'}
};
// the editor a skill starts with when its owner has not picked one in Settings → Skills
const WS_BY_COURSE={SQL:'sql',Databases:'sql',Python:'python','Python (Data)':'python','Python (Software)':'python',JavaScript:'js','Node.js':'js','HTML/CSS':'html'};
// the choices in Settings → Skills; 'none' hides the editor for that skill
const WS_CHOICES=[['none','None'],...Object.entries(WS_KINDS).map(([kind,K])=>[kind,K.label])];
// a skill's editor kind (or null): the choice stored on its skill channel, else the default for its name
function wsEditorOf(category,skill){
  const chosen=(recall('sb.skillChannels')[skillChannelId(category,skill)]||{}).editor;
  if(chosen==='none')return null;
  return WS_KINDS[chosen]?chosen:WS_BY_COURSE[skill]||null;
}
// a skill channel or one of its tools opens its skill's editor
const wsKindOf=t=>t&&typeOf(t)==='skill'?wsEditorOf(catOf(t),t.course||'Other'):null;

/* sample airline data (same rows in SQL and as CSV files for Python), seeded so it never changes */
const AIR=(()=>{
  let seed=42;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648};const pick=a=>a[Math.floor(rnd()*a.length)];
  const airlines=[['DL','Delta Air Lines'],['AA','American Airlines'],['UA','United Airlines'],['WN','Southwest Airlines']];
  const airports=[['ATL','Atlanta','GA',1],['SLC','Salt Lake City','UT',1],['MSP','Minneapolis','MN',1],['DTW','Detroit','MI',1],['JFK','New York','NY',1],['LAX','Los Angeles','CA',0],['SEA','Seattle','WA',0],['DEN','Denver','CO',0],['ORD','Chicago','IL',0],['BOS','Boston','MA',0]];
  const aircraft=[['N101DL','A321',191],['N102DL','B737-900',180],['N103DL','A220-300',130],['N201AA','A321',190],['N202AA','B737-800',172],['N301UA','B737-900',179],['N302UA','A320',150],['N401WN','B737-800',175],['N402WN','B737 MAX 8',175]];
  const dist={};const mi=(a,b)=>{const k=[a,b].sort().join();return dist[k]=dist[k]||300+Math.floor(rnd()*2200)};
  const flights=[],bookings=[];let bid=1;
  for(let i=1;i<=240;i++){
    const al=pick(airlines)[0],o=pick(airports)[0];let d=pick(airports)[0];while(d===o)d=pick(airports)[0];
    const day=1+Math.floor(rnd()*31),hr=5+Math.floor(rnd()*17),mn=pick([0,10,15,25,30,40,45,55]);
    const canc=rnd()<.04?1:0,missing=!canc&&rnd()<.05;
    const dep=canc||missing?null:Math.max(-12,Math.round((rnd()<.62?rnd()*12-6:rnd()*95)));
    const arr=dep==null?null:dep+Math.round(rnd()*16-9);
    const ac=pick(aircraft.filter(a=>a[0].endsWith(al)))||pick(aircraft);
    flights.push([i,al,al+(100+Math.floor(rnd()*2800)),o,d,`2026-10-${String(day).padStart(2,'0')} ${String(hr).padStart(2,'0')}:${String(mn).padStart(2,'0')}`,dep,arr,canc,mi(o,d),ac[0]]);
    if(!canc){const n=2+Math.floor(rnd()*4);for(let k=0;k<n;k++){const fc=pick(['Main','Main','Main','Comfort+','First']);bookings.push([bid++,i,fc,Math.round((fc==='First'?420:fc==='Comfort+'?260:140)*(0.7+rnd()*.8)),Math.floor(rnd()*3)])}}
  }
  return {
    tables:{
      airlines:{cols:['code TEXT PRIMARY KEY','name TEXT'],rows:airlines},
      airports:{cols:['code TEXT PRIMARY KEY','city TEXT','state TEXT','is_hub INTEGER'],rows:airports},
      aircraft:{cols:['tail_number TEXT PRIMARY KEY','model TEXT','seats INTEGER'],rows:aircraft},
      flights:{cols:['flight_id INTEGER PRIMARY KEY','airline TEXT','flight_no TEXT','origin TEXT','dest TEXT','sched_dep TEXT','dep_delay_min INTEGER','arr_delay_min INTEGER','cancelled INTEGER','distance_mi INTEGER','tail_number TEXT'],rows:flights},
      bookings:{cols:['booking_id INTEGER PRIMARY KEY','flight_id INTEGER','fare_class TEXT','fare_usd INTEGER','checked_bags INTEGER'],rows:bookings}
    }
  };
})();
const AIR_SCHEMA=Object.entries(AIR.tables).map(([n,t])=>`${n}(${t.cols.join(', ')}) -- ${t.rows.length} rows`).join('\n')+
  '\nNotes: sched_dep is "YYYY-MM-DD HH:MM" in Oct 2026; dep_delay_min/arr_delay_min are NULL for cancelled flights and a few with missing data; negative delay = early.';
const csvOf=name=>{const t=AIR.tables[name];const head=t.cols.map(c=>c.split(' ')[0]).join(',');return head+'\n'+t.rows.map(r=>r.map(v=>v==null?'':/[",\n]/.test(String(v))?`"${String(v).replace(/"/g,'""')}"`:v).join(',')).join('\n')+'\n'};

/* script loading */
const loaded$={};
function loadScript(src){return loaded$[src]=loaded$[src]||new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>{delete loaded$[src];no(new Error('load failed: '+src))};document.head.appendChild(s)})}
async function loadCM(kind){
  await loadScript(CDN+'codemirror/5.65.16/codemirror.min.js');
  const modes={sql:['sql'],python:['python'],js:['javascript'],html:['xml','javascript','css','htmlmixed']}[kind];
  for(const m of modes)await loadScript(`${CDN}codemirror/5.65.16/mode/${m}/${m}.min.js`);
}
let SQLdb=null;
const withTimeout=(pr,ms,what)=>Promise.race([pr,new Promise((_,no)=>setTimeout(()=>no(new Error('timeout: '+what)),ms))]);
let SQLinit=null;
const wsStatus=t=>{const o=$('ws-out');if(o&&WS.busy)o.innerHTML=`<div class="ws-hint">${t}</div>`};
// can this page compile WebAssembly at all? (a strict sandbox throws right away)
const wasmAllowed=(()=>{try{return typeof WebAssembly==='object'&&!!new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]))}catch(e){return false}})();
async function sqlEngine(){
  if(wasmAllowed){
    try{
      wsStatus('Loading the SQL engine…');
      await withTimeout(loadScript(CDN+'sql.js/1.8.0/sql-wasm.js'),8000,'sql-wasm.js');
      // fetch the engine ourselves so a blocked download fails fast instead of hanging
      const bin=await withTimeout(fetch(CDN+'sql.js/1.8.0/sql-wasm.wasm').then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.arrayBuffer()}),8000,'sql-wasm.wasm');
      return await withTimeout(window.initSqlJs({wasmBinary:bin}),8000,'sql-wasm start');
    }catch(e){console.warn('[ws] WebAssembly SQL engine failed, using the JavaScript build',e)}
  }
  wsStatus('Loading the SQL engine (JavaScript version, first run takes a few seconds)…');
  try{delete window.initSqlJs}catch(_){window.initSqlJs=undefined}
  await withTimeout(loadScript(CDN+'sql.js/1.8.0/sql-asm.js'),20000,'sql-asm.js');
  return await withTimeout(window.initSqlJs(),15000,'sql-asm start');
}
async function sqlDb(){
  if(SQLdb)return SQLdb;
  const SQL=await (SQLinit=SQLinit||sqlEngine().catch(e=>{SQLinit=null;throw e}));
  const db=new SQL.Database();
  for(const [n,t] of Object.entries(AIR.tables)){
    db.run(`CREATE TABLE ${n} (${t.cols.join(', ')})`);
    const st=db.prepare(`INSERT INTO ${n} VALUES (${t.cols.map(()=>'?').join(',')})`);t.rows.forEach(r=>st.run(r));st.free();
  }
  return SQLdb=db;
}
let PY=null;
async function pyodide(){
  if(PY)return PY;
  await loadScript('https://cdn.jsdelivr.net/npm/pyodide@0.26.4/pyodide.js');
  PY=await window.loadPyodide({indexURL:'https://cdn.jsdelivr.net/npm/pyodide@0.26.4/'});
  for(const n of Object.keys(AIR.tables))PY.FS.writeFile(n+'.csv',csvOf(n));
  return PY;
}

/* the editor: CodeMirror when it loads, a plain text box otherwise */
const WS={kind:null,id:null,ed:null,flags:[],out:'',busy:false};
// drafts are kept per skill and editor kind, so switching a skill's editor never puts SQL in the Python editor
const wsKey=(id,kind)=>'sb.ws.'+id+'.'+kind;
// drafts saved before editors could be chosen used sb.ws.<id>, and always belonged to the skill's default editor
function wsDraft(t,kind){
  try{const own=SessionWorkspace.storage.getItem(wsKey(t.id,kind));if(own!=null||WS_BY_COURSE[t.course]!==kind)return own;return SessionWorkspace.storage.getItem('sb.ws.'+t.id)}catch(e){return null}
}
function wsMakeEditor(host,kind,text){
  host.innerHTML='';
  if(window.CodeMirror){
    const cm=window.CodeMirror(host,{value:text,mode:WS_KINDS[kind].mode,lineNumbers:true,indentUnit:kind==='python'?4:2,tabSize:4,lineWrapping:false,
      extraKeys:{'Ctrl-Enter':()=>wsRun(),'Cmd-Enter':()=>wsRun(),Tab:c=>c.somethingSelected()?c.indentSelection('add'):c.replaceSelection(kind==='python'?'    ':'  ')}});
    cm.on('change',()=>{wsSave();if(WS.flags.length)wsClearFlags()});
    // CodeMirror measures the line-number gutter once; re-measure whenever the panel resizes or the code font finishes loading,
    // so the code never slides under the line numbers
    setTimeout(()=>cm.refresh(),30);
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>cm.refresh());
    if(window.ResizeObserver){let raf=0;new ResizeObserver(()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>cm.refresh())}).observe(host)}
    return {get:()=>cm.getValue(),set:v=>cm.setValue(v),focus:()=>cm.focus(),
      flag:ls=>{ls.forEach(n=>{if(n>=1&&n<=cm.lineCount())cm.addLineClass(n-1,'wrap','ws-flag')});if(ls.length)cm.scrollIntoView({line:ls[0]-1,ch:0},60)},
      clear:()=>{for(let i=0;i<cm.lineCount();i++)cm.removeLineClass(i,'wrap','ws-flag')},refresh:()=>cm.refresh()};
  }
  const ta=document.createElement('textarea');ta.className='ws-plain';ta.spellcheck=false;ta.value=text;ta.setAttribute('aria-label','Code editor');host.appendChild(ta);
  ta.addEventListener('input',()=>{wsSave();if(WS.flags.length)wsClearFlags()});
  ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();wsRun()}else if(e.key==='Tab'){e.preventDefault();const s=ta.selectionStart;ta.setRangeText(kind==='python'?'    ':'  ',s,ta.selectionEnd,'end');wsSave()}});
  return {get:()=>ta.value,set:v=>{ta.value=v},focus:()=>ta.focus(),flag:()=>{},clear:()=>{},refresh:()=>{}};
}
function wsSave(){if(!WS.id||!WS.ed)return;try{SessionWorkspace.storage.setItem(wsKey(WS.id,WS.kind),WS.ed.get())}catch(e){}}
function wsClearFlags(){WS.flags=[];WS.ed&&WS.ed.clear();$('ws-flagnote').hidden=true}
function wsFlag(lines){WS.flags=lines;WS.ed.clear();WS.ed.flag(lines);const n=$('ws-flagnote');n.hidden=!lines.length;n.textContent=`AI coach marked line${lines.length>1?'s':''} ${fmtLines(lines)}`}
const fmtLines=ls=>{const out=[];let a=null,b=null;ls.forEach(n=>{if(a==null){a=b=n}else if(n===b+1)b=n;else{out.push(a===b?a:a+'–'+b);a=b=n}});if(a!=null)out.push(a===b?a:a+'–'+b);return out.join(', ')};
const parseLines=s=>{const set=new Set();s.split(/[,\s]+/).forEach(p=>{const m=p.match(/^(\d+)(?:[-–](\d+))?$/);if(m){const a=+m[1],b=+(m[2]||m[1]);for(let i=a;i<=Math.min(b,a+60);i++)set.add(i)}});return [...set].sort((x,y)=>x-y)};

async function wsMount(t){
  const kind=wsKindOf(t),main=$('work-main');
  main.classList.toggle('has-ws',!!kind);$('ws').hidden=!kind;$('ws-split').hidden=!kind;
  $('work-mid').classList.toggle('split',!!kind);wsApplyWidth();
  if(!kind){WS.kind=WS.id=null;return}
  if(WS.id===t.id&&WS.kind===kind&&WS.ed){WS.ed.refresh();return}
  wsSave();
  const K=WS_KINDS[kind];WS.kind=kind;WS.id=t.id;WS.flags=[];WS.out='';
  $('ws-title').textContent=K.label;$('ws-file').textContent=K.file;$('ws-run').innerHTML='<svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true" style="margin-right:5px;vertical-align:-1px"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/></svg>Run';$('ws-run').setAttribute('aria-label',K.run);
  $('ws-tables').hidden=kind!=='sql';$('ws-flagnote').hidden=true;
  $('ws-out').innerHTML=`<div class="ws-hint">${kind==='sql'?'Results show here. <b>Ctrl/⌘ + Enter</b> runs the query.':kind==='html'?'Your page previews here.':kind==='python'?'Output shows here. The first run loads Python, which takes a few seconds.':'console.log output shows here.'}</div>`;
  const text=wsDraft(t,kind);
  const host=$('ws-ed');host.innerHTML='<div class="ws-hint" style="padding:14px">Loading editor…</div>';
  try{await loadCM(kind)}catch(e){}
  if(WS.id!==t.id||WS.kind!==kind)return;
  WS.ed=wsMakeEditor(host,kind,text??K.starter);
}
async function wsRun(){
  if(!WS.ed||WS.busy)return;const code=WS.ed.get(),out=$('ws-out'),kind=WS.kind;
  WS.busy=true;$('ws-run').disabled=true;out.innerHTML='<div class="ws-hint">Running…</div>';
  try{
    if(kind==='sql'){
      const db=await sqlDb();const res=db.exec(code);
      if(!res.length){out.innerHTML='<div class="ws-hint">Ran fine. No rows returned.</div>';WS.out='Ran with no rows returned.'}
      else{const r=res[res.length-1],rows=r.values.slice(0,200);
        out.innerHTML=`<div class="ws-meta">${r.values.length} row${r.values.length===1?'':'s'}${r.values.length>200?' · showing 200':''}</div><div class="ws-table-wrap"><table class="ws-table"><thead><tr>${r.columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(v=>`<tr>${v.map(x=>`<td${x==null?' class="null"':''}>${x==null?'NULL':esc(typeof x==='number'&&!Number.isInteger(x)?String(+x.toFixed(4)):String(x))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
        WS.out=`${r.values.length} rows. Columns: ${r.columns.join(', ')}\n`+r.values.slice(0,8).map(v=>v.map(x=>x==null?'NULL':x).join(' | ')).join('\n')}
    } else if(kind==='js'){
      const logs=await runJs(code);out.innerHTML=`<pre class="ws-console">${esc(logs.text)||'<span class="muted">(no output)</span>'}</pre>`;WS.out=logs.text.slice(0,1500);
      if(logs.error)out.querySelector('pre').classList.add('err');
    } else if(kind==='html'){
      out.innerHTML='<iframe class="ws-preview" sandbox="allow-scripts" title="Preview of your page"></iframe>';out.querySelector('iframe').srcdoc=code;WS.out='(rendered preview)';
    } else if(kind==='python'){
      let py;try{py=await pyodide()}catch(e){out.innerHTML='<div class="ws-err">Python couldn\'t load here. You can still send your code to AI coach to review.</div>';WS.out='';return}
      let buf='';py.setStdout({batched:s=>buf+=s+'\n'});py.setStderr({batched:s=>buf+=s+'\n'});
      try{await py.loadPackagesFromImports(code)}catch(e){buf+='(Some packages, like pandas, may not be available here.)\n'}
      try{const r=await py.runPythonAsync(code);if(r!==undefined&&r!==null)buf+=String(r)+'\n';out.innerHTML=`<pre class="ws-console">${esc(buf)||'<span class="muted">(no output)</span>'}</pre>`}
      catch(e){buf+=String(e.message||e);out.innerHTML=`<pre class="ws-console err">${esc(buf)}</pre>`}
      WS.out=buf.slice(-1500);
    }
  }catch(e){
    const msg=String(e.message||e),infra=/^(load failed|timeout:)/.test(msg);
    out.innerHTML=`<div class="ws-err">${esc(infra?`The ${kind==='sql'?'SQL engine':'runner'} couldn't load in this view (${msg.replace(/^(load failed|timeout): /,'')}). You can still send your code to AI coach to review.`:msg)}</div>`;WS.out=infra?'':'Error: '+msg;
  }finally{WS.busy=false;$('ws-run').disabled=false}
}
function runJs(code){
  return new Promise(res=>{
    const src=`const out=[];const fmt=a=>a.map(x=>typeof x==='string'?x:(()=>{try{return JSON.stringify(x)}catch(e){return String(x)}})()).join(' ');
      console.log=(...a)=>{out.push(fmt(a))};console.error=console.warn=console.info=console.log;
      onmessage=e=>{try{const r=(0,eval)(e.data);if(r!==undefined)out.push('← '+fmt([r]));postMessage({text:out.join('\\n')})}catch(err){out.push(String(err));postMessage({text:out.join('\\n'),error:true})}}`;
    const url=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));let w;
    try{w=new Worker(url)}catch(e){res({text:'Running JavaScript isn\'t available here.',error:true});return}
    const done=r=>{clearTimeout(tm);w.terminate();URL.revokeObjectURL(url);res(r)};
    const tm=setTimeout(()=>done({text:'Stopped after 3 seconds (infinite loop?).',error:true}),3000);
    w.onmessage=e=>done(e.data);w.onerror=e=>{e.preventDefault();done({text:String(e.message||'Error'),error:true})};
    w.postMessage(code);
  });
}
function wsSend(){
  if(!WS.ed)return;const code=WS.ed.get().replace(/\s+$/,'');if(!code)return;
  const K=WS_KINDS[WS.kind],numbered=code.split('\n').map((l,i)=>`${String(i+1).padStart(3)}| ${l}`).join('\n');
  const show=`Here's my ${K.lang==='sql'?'SQL':K.lang==='javascript'?'JavaScript':K.lang==='html'?'HTML/CSS':'Python'}:\n\`\`\`${K.lang}\n${code}\n\`\`\``+(WS.out?`\n\nOutput:\n${WS.out.split('\n').slice(0,5).join('\n')}${WS.out.split('\n').length>5?'\n…':''}`:'');
  const model=`Here is my ${K.label.replace(' editor','')} code (line numbers on the left are not part of the code):\n${numbered}`+(WS.out?`\n\nWhen I ran it:\n${WS.out}`:'\n\n(I have not run it yet.)')+'\n\nReview it.';
  wsClearFlags();sendCoach(model,show);
}
// what the coach should know about the editor beside the chat; flags:false leaves out the LINES: reply line for chats that cannot mark lines
function wsRulesFor(t,{flags=true}={}){
  const kind=wsKindOf(t);if(!kind)return '';
  const K=WS_KINDS[kind];
  return coachSay`\n\nHe has a ${K.label} open beside this chat${kind==='sql'?` connected to a SQLite sample airline database. Write practice problems against these tables only:\n${AIR_SCHEMA}`:kind==='python'?` that runs Python in the browser with flights.csv, airports.csv, airlines.csv and bookings.csv in the working folder (same columns as the airline database: ${Object.entries(AIR.tables).map(([n,t])=>`${n}: ${t.cols.map(c=>c.split(' ')[0]).join(', ')}`).join('; ')}). pandas may not be available, so prefer the csv module unless the skill is about pandas`:kind==='js'?' that runs plain JavaScript and shows console.log output (no Node modules)':' with a live preview'}.\nWhen you give him a problem, have him write the answer in the editor. When he sends code, review it like an interviewer would: say what works, point out bugs, edge cases and style issues, and ask him to fix them himself rather than rewriting it for him. ${flags?coachSay`If specific lines need attention, end your reply with one final line exactly like "LINES: 3, 7-9" using his line numbers. `:''}If you give starter code or a sample schema, put it in one fenced code block.`;
}
/* draggable divider: the chat stops at a usable width; the editor stops at its smallest useful width */
const WS_MIN=330,CHAT_MIN=360;
let wsW=(()=>{try{return +SessionWorkspace.storage.getItem('sb.wsW')||0}catch(e){return 0}})();
function wsApplyWidth(){
  const mid=$('work-mid');if(!mid.classList.contains('split'))return;
  const total=mid.clientWidth;if(!total)return;
  let w=wsW||Math.round(total*.52);w=Math.max(WS_MIN,Math.min(total-CHAT_MIN-9,w));
  mid.style.setProperty('--wsw',w+'px');
}
(function(){
  const sp=$('ws-split');let start=null;
  sp.addEventListener('pointerdown',e=>{if(e.button!==0)return;const mid=$('work-mid');
    start={x:e.clientX,w:$('ws').getBoundingClientRect().width,total:mid.clientWidth};sp.setPointerCapture(e.pointerId);sp.classList.add('drag');document.body.classList.add('ws-dragging')});
  sp.addEventListener('pointermove',e=>{if(!start)return;
    const want=start.w-(e.clientX-start.x),max=start.total-CHAT_MIN-9;
    const w=Math.max(WS_MIN,Math.min(max,want));
    wsW=w;$('work-mid').style.setProperty('--wsw',w+'px');WS.ed&&WS.ed.refresh()});
  const end=e=>{if(!start)return;start=null;sp.classList.remove('drag');document.body.classList.remove('ws-dragging');$('ws').style.opacity='';
    try{SessionWorkspace.storage.setItem('sb.wsW',String(wsW))}catch(_){}
    WS.ed&&WS.ed.refresh()};
  sp.addEventListener('pointerup',end);sp.addEventListener('pointercancel',end);
  sp.addEventListener('keydown',e=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();
    const mid=$('work-mid'),cur=$('ws').getBoundingClientRect().width,next=cur+(e.key==='ArrowLeft'?40:-40);
    wsW=Math.max(WS_MIN,Math.min(mid.clientWidth-CHAT_MIN-9,next));try{SessionWorkspace.storage.setItem('sb.wsW',String(wsW))}catch(_){}wsApplyWidth();WS.ed&&WS.ed.refresh()});
  window.addEventListener('resize',()=>wsApplyWidth());
})();
(function(){
  const hs=$('ws-hsplit'),ED_MIN=110,OUT_MIN=70;let st=null;
  const apply=h=>{const ws=$('ws'),avail=$('ws-ed').getBoundingClientRect().height+$('ws-out').getBoundingClientRect().height;
    h=Math.max(OUT_MIN,Math.min(avail-ED_MIN,h));ws.style.setProperty('--wsout',h+'px');WS.ed&&WS.ed.refresh();return h};
  try{const h=+SessionWorkspace.storage.getItem('sb.wsOutH');if(h)$('ws').style.setProperty('--wsout',h+'px')}catch(e){}
  hs.addEventListener('pointerdown',e=>{if(e.button!==0)return;st={y:e.clientY,h:$('ws-out').getBoundingClientRect().height};hs.setPointerCapture(e.pointerId);document.body.classList.add('ws-vdrag')});
  hs.addEventListener('pointermove',e=>{if(st)st.last=apply(st.h-(e.clientY-st.y))});
  const end=()=>{if(!st)return;document.body.classList.remove('ws-vdrag');if(st.last)try{SessionWorkspace.storage.setItem('sb.wsOutH',String(Math.round(st.last)))}catch(e){}st=null};
  hs.addEventListener('pointerup',end);hs.addEventListener('pointercancel',end);
  hs.addEventListener('keydown',e=>{if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;e.preventDefault();const h=apply($('ws-out').getBoundingClientRect().height+(e.key==='ArrowUp'?30:-30));try{SessionWorkspace.storage.setItem('sb.wsOutH',String(Math.round(h)))}catch(_){}});
})();
$('ws-run').onclick=wsRun;
$('ws-send').onclick=wsSend;
$('ws-reset').onclick=()=>{if(!WS.ed)return;WS.ed.set(WS_KINDS[WS.kind].starter);wsSave();wsClearFlags()};
/* ERD of the airline sample database (crow's foot: bar = one, fork = many) */
const ERD={W:200,H:26,R:20,
  boxes:{bookings:[20,24],airlines:[20,190],flights:[300,24],airports:[580,84],aircraft:[580,214]},
  rels:[['flights','airline','airlines','code',272],['bookings','flight_id','flights','flight_id',248],['flights','origin','airports','code',540],['flights','dest','airports','code',540],['flights','tail_number','aircraft','tail_number',540]]}; // last value = the lane each connector runs in
function erdSvg(){
  const {W,H,R,boxes,rels}=ERD,fk={};rels.forEach(([t,c])=>fk[t+'.'+c]=1);
  const cols=n=>AIR.tables[n].cols.map(c=>{const [nm,...ty]=c.split(' ');return {nm,ty:ty.join(' ').replace(' PRIMARY KEY','').toLowerCase(),pk:/PRIMARY KEY/.test(c)}});
  const rowY=(n,c)=>boxes[n][1]+H+cols(n).findIndex(x=>x.nm===c)*R+R/2;
  let g='',lines='';
  for(const [n,[x,y]] of Object.entries(boxes)){
    const cs=cols(n),h=H+cs.length*R;
    g+=`<g><rect x="${x}" y="${y}" width="${W}" height="${h}" rx="8" fill="#fff" stroke="#9FB8D2"/><path d="M${x} ${y+8}a8 8 0 0 1 8-8h${W-16}a8 8 0 0 1 8 8v${H-8}h-${W}z" fill="#2569C9"/>
      <text x="${x+10}" y="${y+17}" fill="#fff" font-weight="700" font-size="12.5">${n}</text><text x="${x+W-10}" y="${y+17}" fill="#D6E6FA" font-size="10.5" text-anchor="end">${AIR.tables[n].rows.length} rows</text>`+
      cs.map((c,i)=>{const ry=y+H+i*R,isfk=fk[n+'.'+c.nm];return `${i?`<line x1="${x}" x2="${x+W}" y1="${ry}" y2="${ry}" stroke="#E3ECF5"/>`:''}
        <text x="${x+10}" y="${ry+14}" font-size="11.5" fill="#13304D" font-weight="${c.pk?700:400}">${c.nm}</text>
        <text x="${x+W-10}" y="${ry+14}" font-size="10" text-anchor="end" fill="${c.pk?'#B4520A':isfk?'#2569C9':'#7D8E9E'}" font-weight="${c.pk||isfk?700:400}">${c.pk?'PK':isfk?'FK':''}${c.pk||isfk?' · ':''}${c.ty}</text>`}).join('')+`</g>`;
  }
  const off={};
  rels.forEach(([ft,fc,pt,pc,lane])=>{
    const fy=rowY(ft,fc),py0=rowY(pt,pc),k=pt+pc;off[k]=(off[k]||0)+1;const n=rels.filter(r=>r[2]+r[3]===k).length,py=py0+(n>1?(off[k]-1)*8-4:0);
    const fx0=boxes[ft][0],px0=boxes[pt][0],leftOfPk=fx0<px0;
    const fx=leftOfPk?fx0+W:fx0,px=leftOfPk?px0:px0+W,dir=leftOfPk?1:-1,mx=lane;
    lines+=`<path d="M${fx} ${fy}H${mx}V${py}H${px}" fill="none" stroke="#5E7FA3" stroke-width="1.4"/>`;
    // many (crow's foot) at the FK end, one (double bar) at the PK end
    lines+=`<path d="M${fx+dir*12} ${fy}L${fx} ${fy-6}M${fx+dir*12} ${fy}L${fx} ${fy+6}M${fx+dir*12} ${fy}L${fx} ${fy}" stroke="#5E7FA3" stroke-width="1.4" fill="none"/>`;
    lines+=`<path d="M${px-dir*7} ${py-6}V${py+6}M${px-dir*11} ${py-6}V${py+6}" stroke="#5E7FA3" stroke-width="1.4"/>`;
  });
  const maxY=Math.max(...Object.entries(boxes).map(([n,[x,y]])=>y+H+cols(n).length*R))+16;
  return `<svg class="erd" viewBox="0 0 800 ${maxY}" width="800" height="${maxY}" role="img" aria-label="Diagram of the airline database: flights links to airlines, aircraft and airports (origin and destination); bookings links to flights" font-family="ui-monospace,SFMono-Regular,Menlo,monospace">${lines}${g}</svg>`;
}
$('ws-tables').onclick=()=>{
  $('ws-out').innerHTML=`<div class="ws-meta" style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span>Airline sample database · each line runs from a foreign key (fork = many) to the key it points at (bar = one)</span><button type="button" class="btn ghost" id="erd-big" style="padding:3px 10px;flex:none">Open larger</button></div><div class="erd-wrap">${erdSvg()}</div>`;
  $('erd-big').onclick=()=>{$('erd-dlg-body').innerHTML=erdSvg();$('erd-dlg').showModal()};
};
$('ws-flagnote').onclick=()=>{if(WS.flags.length)WS.ed.flag(WS.flags)};
