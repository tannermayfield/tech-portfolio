/* Connection overview and guided local setup; never infer a connection from a saved preference. */
(()=>{
 let epoch=0,pending=false,busy=false,lastHost=null,lastCheck=0;
 const privateMode=()=>SessionWorkspace.mode==='private'&&!!SessionCloud.user;
 const setup=document.createElement('dialog');setup.id='companion-setup';setup.className='confirm-dlg';setup.setAttribute('aria-labelledby','companion-setup-title');
 setup.innerHTML=`<div class="local-panel"><header class="row spread"><h2 id="companion-setup-title">Connect your computer</h2><button class="btn ghost" data-close>Close</button></header><p>The companion runs on your computer so Codex can access the project folders you choose. Your ChatGPT sign-in alone cannot install it or grant folder access.</p><ol><li>Install <a href="https://nodejs.org/en/download" target="_blank" rel="noopener noreferrer">Node.js LTS</a> and <a href="https://developers.openai.com/codex/cli" target="_blank" rel="noopener noreferrer">Codex CLI</a>.</li><li><a href="https://github.com/tannermayfield/tech-portfolio/archive/refs/heads/main.zip">Download SessionTV</a>, extract the ZIP, open the <code>session-tv</code> folder and double-click <code>Start Session TV.cmd</code>.</li><li>Enter your SessionTV user ID below and at least one project folder when the setup window asks. <code id="setup-owner"></code><button class="btn ghost" data-copy>Copy user ID</button></li><li>Keep that window open. Copy its pairing code into the field below and click Pair computer. Allow local-network access if your browser asks.</li><li>Close this popup and use Sign in with ChatGPT next to Codex. Approve the browser sign-in and return here.</li></ol><form id="setup-pair"><label for="setup-code">Pairing code</label><input id="setup-code" type="password" autocomplete="off" required><button class="btn" type="submit">Pair computer</button><button class="btn ghost" type="button" data-check>Check connection</button></form><details><summary>Start automatically with Windows</summary><p>After the first setup, open PowerShell in the extracted session-tv folder and run:</p><code>powershell -NoProfile -ExecutionPolicy Bypass -File .\\companion\\install-background.ps1</code><p>The companion will start when you sign in to Windows. Your saved settings and pairing are reused.</p></details><p id="setup-message" role="status"></p></div>`;
 document.body.append(setup);setup.querySelector('[data-close]').onclick=()=>setup.close();setup.addEventListener('close',()=>{document.getElementById('setup-code').value=''});
 function guide(){if(!privateMode())return;document.getElementById('setup-owner').textContent=SessionCloud.user.id;document.getElementById('setup-message').textContent='';if(!setup.open)setup.showModal()}
 setup.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(SessionCloud.user.id);document.getElementById('setup-message').textContent='User ID copied.'}catch{document.getElementById('setup-message').textContent='Select and copy the user ID above.'}};
 document.getElementById('setup-pair').onsubmit=async event=>{event.preventDefault();const message=document.getElementById('setup-message'),button=event.submitter;button.disabled=true;try{await SessionCompanion.pair(document.getElementById('setup-code').value);document.getElementById('setup-code').value='';message.textContent='Computer paired. You can now sign in to Codex from the Session Preferences card.';await refresh()}catch(error){message.textContent=error.message}finally{button.disabled=false}};
 setup.querySelector('[data-check]').onclick=async()=>{const status=await SessionCompanion.status();document.getElementById('setup-message').textContent=status.signedIn?'Codex connected.':status.connected?'Computer connected. Sign in to Codex from the Session Preferences card.':status.error||'Computer not connected.';refresh()};
 function canvasSetup(){if(!privateMode())return;SessionTVLocal.openSetup('preferences');document.querySelector('[data-session-tab="session-canvas"]')?.click()}
 function row(label){const node=document.createElement('div');node.className='connection-row';const name=document.createElement('strong');name.textContent=label;const state=document.createElement('span');state.className='connection-state';const action=document.createElement('button');action.className='btn';action.type='button';node.append(name,state,action);return {node,state,action}}
 function render(host,chat,codex,canvas={}){
  if(!host?.isConnected)return;host.replaceChildren();
  for(const [label,status,connect]of [['ChatGPT',chat,()=>login('chatgpt')],['Codex',codex,()=>login('codex')],['Canvas',canvas,canvasSetup]]){
   const item=row(label);item.state.textContent=status.reading?'Reading...':status.connected?'Connected':status.pending?'Finish sign-in in your browser':privateMode()?(status.error||'Not connected'):'Sign in to connect';item.state.classList.toggle('connected',!!status.connected);
   item.action.hidden=!!status.connected||!!status.reading;item.action.disabled=!privateMode();item.action.textContent=label==='Canvas'?'Setup':status.setup?'Setup':status.pending?'Continue sign-in':'Sign in with ChatGPT';item.action.onclick=label==='Canvas'?canvasSetup:status.setup?guide:connect;if(label==='ChatGPT'||label==='Codex')item.action.hidden=true;host.append(item.node);
  }
 }
 async function refresh(){
  const host=document.getElementById('session-connection-summary');if(!host)return;if(privateMode()&&(!host.children.length||!busy))render(host,{reading:true},{reading:true},{reading:true});if(busy)return;lastHost=host;
  if(!privateMode()){render(host,{},{});return}busy=true;lastCheck=Date.now();const version=epoch;
  try{
   const [computer,chat,canvas]=await Promise.all([SessionCompanion.status().catch(error=>({connected:false,error:error.message||'Computer disconnected'})),SessionCompanion.chatGPTStatus().catch(()=>({connected:false})),Promise.resolve().then(()=>SessionCompanion.canvasStatus()).catch(()=>({connected:false,error:'Computer disconnected'}))]);
   if(version!==epoch||!privateMode())return;
   let codex={connected:!!computer.signedIn,setup:!computer.connected,pending:!!computer.loginPending,error:computer.error};pending=pending||!!computer.loginPending;
   if(pending&&computer.connected){const state=await SessionCompanion.codexLoginStatus().catch(()=>({pending:false}));codex={...codex,...state};pending=!!state.pending;}
   if(version===epoch&&privateMode())render(host,chat,codex,canvas);
  }finally{busy=false;if(lastHost!==document.getElementById('session-connection-summary'))refresh()}
 }
 async function login(kind){
  if(!privateMode())return;const version=epoch,popup=window.open('about:blank','sessiontv-'+kind+'-login','popup,width=700,height=800');
  try{
   const computer=await SessionCompanion.status();if(!computer.connected){popup?.close();guide();return}
   const result=await(kind==='codex'?SessionCompanion.codexConnect():SessionCompanion.connectChatGPT());if(version!==epoch||!privateMode()){popup?.close();return}
   if(result.connected){popup?.close();refresh();return}
   const url=new URL(result.authUrl||result.authorizationUrl);if(url.protocol!=='https:'||!['auth.openai.com','chatgpt.com'].includes(url.hostname)||url.username||url.password)throw Error('Invalid sign-in URL.');
   pending=kind==='codex';if(popup){popup.opener=null;popup.location.href=url.href}else{const host=document.getElementById('session-connection-summary'),a=document.createElement('a');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open '+(kind==='codex'?'Codex':'ChatGPT')+' sign-in';host.append(a);return}refresh();
  }catch(error){popup?.close();toast(error.message)}
 }
 SessionTV.hooks.after('settings:render',()=>refresh());
 addEventListener('focus',()=>refresh());addEventListener('sessiontv:auth',()=>{epoch++;pending=false;setup.close();refresh()});
 setInterval(()=>{const host=document.getElementById('session-connection-summary');if(host?.getClientRects().length&&(pending||Date.now()-lastCheck>=20000))refresh()},5000);
 globalThis.SessionConnections={refresh,setup:guide};refresh();
})();
