/* Workspace and AI controls; preserve the original TV interface. */
(() => {
 let noticeTimer;
 let setupView='login';
 toast=message=>{const el=$('toast');el.textContent=message;el.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>el.hidden=true,6500)};
 addEventListener('sessiontv:error',event=>toast(event.detail));
 const baseSettings=renderSettings;
 renderSettings=function(){baseSettings();if(TV.dbView)return;$('local-open').onclick=async()=>{if(SessionWorkspace.mode==='private'){try{await SessionCloud.signOut()}catch(error){toast(error.message)}}else openLocalSetup()};$('session-preferences-open').onclick=()=>openLocalSetup('preferences');$('preferences-open').onclick=openPreferences};
 const dialog=document.createElement('dialog');dialog.id='local-setup';dialog.className='confirm-dlg';dialog.setAttribute('aria-labelledby','local-heading');
 dialog.innerHTML=`<div class="local-panel"><div class="row spread"><h2 id="local-heading">Session Login</h2><button class="btn ghost" id="local-close" autofocus>Close</button></div>
 <p id="workspace-status" class="small"></p>
 <section id="workspace-auth"><form id="workspace-login">
 <label for="workspace-email" id="workspace-identifier-label">Email address</label><input id="workspace-email" name="email" type="email" required autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="you@example.com">
 <label for="workspace-password">Password</label><div class="password-field"><input id="workspace-password" name="password" type="password" required autocomplete="current-password" placeholder="Your password"><button class="btn ghost" id="workspace-show-password" type="button" aria-controls="workspace-password" aria-pressed="false">Show</button></div>
 <div class="local-actions"><button class="btn primary" id="workspace-signin" type="submit">Sign In</button></div>
</form></section>
 <button class="btn" id="workspace-signout" hidden>Sign out</button>
 <details id="ai-connections"><summary>AI Connections</summary><h3>ChatGPT</h3><p class="small muted" id="local-ai-status">Not connected</p>
 <h3>Codex & Local AI Companion</h3><p class="small muted" id="companion-status">Computer disconnected</p>
 <div id="companion-controls" hidden><label>Pairing code <input id="companion-code" autocomplete="off" type="password"></label><button class="btn" id="companion-pair">Pair companion</button><button class="btn" id="companion-check">Check status</button><div hidden><label>Authorized workspace <select id="companion-workspace"></select></label><label>Coding request <textarea id="companion-prompt" rows="3" placeholder="Describe the project change"></textarea></label><button class="btn" id="companion-start">Start Codex session</button><pre id="companion-log" aria-live="polite"></pre></div></div>
 </details><section id="session-music"><h3>Apple Music</h3><button class="btn" disabled>Setup coming later</button></section>
 <p class="small" id="local-message" role="status"></p></div>`;
 document.body.appendChild(dialog);
 const preferences=document.createElement('dialog');preferences.id='appearance-preferences';preferences.className='confirm-dlg';preferences.setAttribute('aria-labelledby','preferences-heading');
 const group=(label,name,options)=>`<section class="preference-row"><h3>${label}</h3><div class="seg" role="group" aria-label="${label}">${options.map(([value,text])=>`<button type="button" data-pref="${name}" data-value="${value}" aria-pressed="false">${text}</button>`).join('')}</div></section>`;
 preferences.innerHTML=`<div class="local-panel"><div class="row spread"><h2 id="preferences-heading">Appearance</h2><button class="btn ghost" id="preferences-close" autofocus>Close</button></div>${group('Light / Dark Mode','scheme',[['auto','Auto'],['light','Light'],['dark','Dark']])}${group('TV Screen Effect','screenEffect',[['off','Off'],['on','On']])}${group('Channel Cutscenes','cut',[['0','Off'],['4','On']])}</div>`;
 document.body.appendChild(preferences);
 TV.screenEffect=recall('sb.screenEffect',true)!==false;
 function syncPreferences(){document.body.dataset.screenEffect=TV.screenEffect?'on':'off';preferences.querySelectorAll('[data-pref]').forEach(button=>{const value=button.dataset.pref==='scheme'?TV.scheme:button.dataset.pref==='screenEffect'?(TV.screenEffect?'on':'off'):String(TV.cutLen);button.setAttribute('aria-pressed',String(button.dataset.value===value))})}
 function openPreferences(){syncPreferences();preferences.showModal()}
 $('preferences-close').onclick=()=>preferences.close();
 preferences.addEventListener('click',event=>{const button=event.target.closest('[data-pref]');if(!button)return;const name=button.dataset.pref,value=button.dataset.value;if(name==='scheme'){TV.scheme=value;store('sb.scheme',value);applyScheme()}else if(name==='screenEffect'){TV.screenEffect=value==='on';store('sb.screenEffect',TV.screenEffect)}else if(name==='cut'){TV.cutLen=Number(value);store('sb.cutLen',TV.cutLen)}syncPreferences()});
 syncPreferences();
 function update(){const mode=SessionWorkspace.mode,privateMode=mode==='private';$('workspace-status').textContent=privateMode?'Private account active. Records are saved to Supabase.':mode==='demo'?'Browse courses, assignments, skills and projects. Editing and AI are disabled.':'Sign in to use Supabase, then add your records in My Database.';$('workspace-auth').hidden=privateMode;$('workspace-signout').hidden=true;$('companion-controls').hidden=!privateMode;$('workspace-status').hidden=true;$('ai-connections').hidden=!privateMode||setupView!=='preferences';$('session-music').hidden=!privateMode||setupView!=='preferences';if($('local-open'))$('local-open').textContent=privateMode?'Logout':'Login to Session';}
 async function openLocalSetup(view=SessionWorkspace.mode==='private'?'preferences':'login'){setupView=view==='preferences'?'preferences':'login';$('local-heading').textContent=setupView==='preferences'?'Session Preferences':'Session Login';update();$('local-message').textContent='';dialog.showModal();if(SessionCloud.user){$('companion-status').textContent='Checking computer connection…';status().catch(error=>{$('companion-status').textContent=error.message});}}
 function fail(error){$('local-message').textContent=error.message}
 $('workspace-show-password').onclick=()=>{const input=$('workspace-password'),visible=input.type==='password';input.type=visible?'text':'password';$('workspace-show-password').textContent=visible?'Hide':'Show';$('workspace-show-password').setAttribute('aria-pressed',String(visible))};
 $('workspace-login').onsubmit=async e=>{e.preventDefault();const button=$('workspace-signin');button.disabled=true;button.textContent='Signing in...';$('local-message').textContent='';try{await SessionCloud.signInWithPassword($('workspace-email').value,$('workspace-password').value)}catch(error){fail(error)}finally{$('workspace-password').value='';button.disabled=false;button.textContent='Sign In'}};
 $('workspace-signout').onclick=async()=>{try{await SessionCloud.signOut()}catch(error){fail(error)}};
 $('local-close').onclick=()=>dialog.close(); async function status(){const value=await SessionCompanion.status();$('companion-status').textContent=value.error||(!value.connected?'Computer disconnected':value.busy?'Codex is working':value.signedIn?'Computer connected · Codex ready':'Computer connected · Sign in to Codex');const list=value.workspaces||[];$('companion-workspace').replaceChildren(...list.map(w=>{const o=document.createElement('option');o.value=typeof w==='string'?w:w.id||w.path;o.textContent=typeof w==='string'?w:w.name||w.path||w.id;return o}));return value}
 $('companion-pair').onclick=async()=>{try{await SessionCompanion.pair($('companion-code').value);$('companion-code').value='';await status()}catch(error){fail(error)}};
 $('ai-connections').addEventListener('toggle',()=>{if($('ai-connections').open&&SessionCloud.user)status().catch(error=>{$('companion-status').textContent=error.message})});
 $('companion-check').onclick=async()=>{try{await status()}catch(error){$('companion-status').textContent='Disconnected: '+error.message}};
 $('companion-start').onclick=async()=>{const button=$('companion-start');button.disabled=true;$('companion-log').textContent='';try{await SessionCompanion.start({workspace:$('companion-workspace').value,prompt:$('companion-prompt').value,onEvent:event=>{$('companion-log').textContent+=JSON.stringify(event)+'\n'}})}catch(error){fail(error)}finally{button.disabled=false}};
 const isBoardKey=key=>key===SessionStore.KEY||key.startsWith('sb.');
 function backup(){wsSave();const values={};const storage=SessionWorkspace.storage;for(let i=0;i<storage.length;i++){const key=storage.key(i);if(isBoardKey(key))values[key]=storage.getItem(key)}return {format:'session-tv-backup',version:1,createdAt:new Date().toISOString(),values}}
 function validateBackup(file){if(file?.format!=='session-tv-backup'||file.version!==1||!file.values||typeof file.values!=='object'||Array.isArray(file.values))throw Error('Choose a Session TV backup.');for(const [key,value]of Object.entries(file.values))if(!isBoardKey(key)||typeof value!=='string')throw Error('Invalid backup data.');if(!Object.hasOwn(file.values,SessionStore.KEY))throw Error('This backup has no database.');SessionStore.validate(JSON.parse(file.values[SessionStore.KEY]));return file.values}
 const originalCoachLog=renderCoachLog;renderCoachLog=function(){if(current){const saved=recall('sb.localChats',null);if(saved?.startedAt===current.startedAt&&!Object.keys(coachTurns).length)coachTurns=saved.turns||{};store('sb.localChats',{startedAt:current.startedAt,turns:coachTurns})}return originalCoachLog()};
 addEventListener('pagehide',()=>{if(SessionWorkspace.mode==='private'&&!SessionCloud.user)return;wsSave();if(current){accumulate();saveState();store('sb.localChats',{startedAt:current.startedAt,turns:coachTurns})}});
 window.SessionTVLocal={backup,validateBackup,openSetup:openLocalSetup};update();
})();
