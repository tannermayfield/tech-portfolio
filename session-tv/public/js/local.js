/* Sign in (email and password, or Google), backups and Work chat persistence; preserve the original TV interface.
   Preferences live in session-preferences.js; openSetup('preferences') opens them. */
(() => {
 SessionTV.hooks.after('settings:render',()=>{if(TV.dbView)return;$('local-open').onclick=async()=>{if(SessionWorkspace.mode==='private'){try{await SessionCloud.signOut()}catch(error){toast(error.message)}}else openLocalSetup('login')};if($('account-settings-open'))$('account-settings-open').onclick=()=>SessionAccount.open()});
 const dialog=document.createElement('dialog');dialog.id='local-setup';dialog.className='confirm-dlg';dialog.setAttribute('aria-labelledby','local-heading');
 dialog.innerHTML=`<div class="local-panel"><div class="row spread"><h2 id="local-heading">Sign in</h2><button class="btn ghost" id="local-close" type="button">Close</button></div>
 <p id="workspace-status" class="small"></p>
 <section id="workspace-auth"><form id="workspace-login">
 <label for="workspace-email">Email address</label><input id="workspace-email" name="email" type="email" required autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="you@example.com">
 <label for="workspace-password">Password</label><div class="password-field"><input id="workspace-password" name="password" type="password" required autocomplete="current-password" placeholder="Your password"><button class="btn ghost" id="workspace-show-password" type="button" aria-controls="workspace-password" aria-pressed="false">Show</button></div>
 <div class="local-actions"><button class="btn primary" id="workspace-signin" type="submit">Sign in</button></div></form>
 <p class="login-or" aria-hidden="true"><span>or</span></p>
 <button class="btn" id="workspace-google" type="button">Continue with Google</button></section>
 <button class="btn" id="workspace-signout" type="button" hidden>Sign out</button>
 <p class="small" id="local-message" role="status"></p></div>`;
 document.body.appendChild(dialog);
 function update(){
  const privateMode=SessionWorkspace.mode==='private';
  $('workspace-status').textContent=privateMode?(SessionCloud.user?.email?'Signed in as '+SessionCloud.user.email+'. ':'Signed in. ')+'Records are saved to your private workspace.':'Sign in with your email and password, or continue with Google.';
  $('workspace-auth').hidden=privateMode;$('workspace-signout').hidden=!privateMode;
  if($('local-open')){$('local-open').textContent=privateMode?'Sign out':'Sign in';$('local-open').dataset.sessionAction=privateMode?'logout':'login';}
 }
 function openLocalSetup(view=SessionWorkspace.mode==='private'?'preferences':'login',tab){
  if(view==='preferences'&&globalThis.SessionPreferences){SessionPreferences.open(tab);return}
  update();$('local-message').textContent='';dialog.showModal();if(SessionWorkspace.mode!=='private')$('workspace-email').focus();
 }
 function fail(error){$('local-message').textContent=error.message}
 $('workspace-show-password').onclick=()=>{const input=$('workspace-password'),visible=input.type==='password';input.type=visible?'text':'password';$('workspace-show-password').textContent=visible?'Hide':'Show';$('workspace-show-password').setAttribute('aria-pressed',String(visible))};
 $('workspace-login').onsubmit=async e=>{e.preventDefault();const button=$('workspace-signin');button.disabled=true;button.textContent='Signing in…';$('local-message').textContent='';try{await SessionCloud.signInWithPassword($('workspace-email').value,$('workspace-password').value)}catch(error){fail(error)}finally{$('workspace-password').value='';button.disabled=false;button.textContent='Sign in'}};
 $('workspace-google').onclick=async()=>{try{await SessionCloud.signInWithGoogle()}catch(error){fail(error)}};
 $('workspace-signout').onclick=async()=>{try{await SessionCloud.signOut()}catch(error){fail(error)}};
 $('local-close').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{$('workspace-password').value=''});
 const isBoardKey=key=>key===SessionStore.KEY||key.startsWith('sb.');
 function backup(){wsSave();const values={};const storage=SessionWorkspace.storage;for(let i=0;i<storage.length;i++){const key=storage.key(i);if(isBoardKey(key))values[key]=storage.getItem(key)}return {format:'session-tv-backup',version:1,createdAt:new Date().toISOString(),values}}
 function validateBackup(file){if(file?.format!=='session-tv-backup'||file.version!==1||!file.values||typeof file.values!=='object'||Array.isArray(file.values))throw Error('Choose a Session TV backup.');for(const [key,value]of Object.entries(file.values))if(!isBoardKey(key)||typeof value!=='string')throw Error('Invalid backup data.');if(!Object.hasOwn(file.values,SessionStore.KEY))throw Error('This backup has no database.');SessionStore.validate(JSON.parse(file.values[SessionStore.KEY]));return file.values}
 // keep the Work chat across reloads of the same session
 SessionTV.hooks.before('coach:render',()=>{if(current){const saved=recall('sb.localChats');if(saved?.startedAt===current.startedAt&&!Object.keys(coachTurns).length)coachTurns=saved.turns||{};store('sb.localChats',{startedAt:current.startedAt,turns:coachTurns})}});
 addEventListener('pagehide',()=>{if(SessionWorkspace.mode==='private'&&!SessionCloud.user)return;wsSave();if(current){accumulate();saveState();store('sb.localChats',{startedAt:current.startedAt,turns:coachTurns})}});
 window.SessionTVLocal={backup,validateBackup,openSetup:openLocalSetup};update();
})();
