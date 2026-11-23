import http from 'node:http';
import {readFile,stat,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const root=path.resolve('out');
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};
const server=http.createServer(async(req,res)=>{try{let f=path.join(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname));if((await stat(f)).isDirectory())f=path.join(f,'index.html');res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');res.end(await readFile(f))}catch{res.writeHead(404);res.end('Not found')}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
async function startTV(page){await page.waitForFunction(()=>!!document.getElementById('tv-home-start')?.onclick);if(await page.locator('#tv-home-start').isVisible())await page.locator('#tv-home-start').click()}
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const page=await context.newPage();const errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)missing.push(r.url())});
 await page.goto(origin+'/session-tv/');await page.waitForFunction(()=>typeof loaded!=='undefined'&&loaded.tasks&&current&&document.body.dataset.readonly==='true');await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/session-tv-home.png'});await startTV(page);assert.equal(await page.evaluate(()=>SessionWorkspace.mode),'demo');const published=await page.evaluate(()=>tasks.map(t=>({id:t.id,title:t.title,status:t.status})));assert.ok(published.length);
 const result=await page.evaluate(async()=>{try{await db.doc('tasks/'+tasks[0].id).update({title:'Unauthorized edit'});return 'allowed'}catch(error){return error.message}});assert.match(result,/read-only/);assert.equal(await page.evaluate(()=>sessionPlatform.use('sample')),null);assert.match(await page.evaluate(()=>SessionCompanion.pair('unauthorized').catch(e=>e.message)),/Demo visitors/);
 await page.evaluate(()=>openTask(tasks[0].id));assert.equal(await page.locator('#td-edit').isVisible(),false);await page.reload();await page.waitForFunction(()=>typeof loaded!=='undefined'&&loaded.tasks&&current);await startTV(page);assert.deepEqual(await page.evaluate(()=>tasks.map(t=>({id:t.id,title:t.title,status:t.status}))),published);
 await page.evaluate(()=>go('log'));await page.waitForURL('**/#log');await page.reload();await page.waitForFunction(()=>typeof loaded!=='undefined'&&loaded.tasks&&current);await startTV(page);assert.equal(await page.locator('#view-log').isVisible(),true);await page.goBack();await page.goForward();await page.goto(origin+'/session-tv/');await page.waitForFunction(()=>typeof loaded!=='undefined'&&loaded.tasks&&current&&document.body.dataset.readonly==='true');
 await startTV(page);if(await page.locator('#btn-set').getAttribute('aria-pressed')!=='true')await page.locator('#btn-set').click();await page.locator('#local-open').click();assert.equal(await page.locator('#local-heading').textContent(),'Session Login');assert.equal(await page.locator('#workspace-email').isEnabled(),true);assert.equal(await page.locator('#workspace-password').getAttribute('type'),'password');await mkdir('public/images',{recursive:true});await page.locator('#local-setup').screenshot({path:'public/images/session-tv-login.png'});await page.route('**/auth/v1/token?grant_type=password',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'Incorrect username or password.'})}));await page.locator('#workspace-email').fill('preview@example.com');await page.locator('#workspace-password').fill('not-a-real-password');await page.locator('#workspace-signin').click();await page.waitForFunction(()=>document.getElementById('local-message').textContent.includes('Incorrect'));assert.equal(await page.locator('#workspace-password').inputValue(),'');assert.equal(await page.evaluate(()=>SessionWorkspace.mode),'demo');await page.locator('#workspace-email').fill('');await page.locator('#workspace-show-password').click();assert.equal(await page.locator('#workspace-password').getAttribute('type'),'text');assert.equal(await page.locator('#workspace-email').getAttribute('type'),'email');assert.equal(await page.locator('#workspace-google').isVisible(),true);const gaps=await page.evaluate(()=>{const label=document.querySelector('label[for=workspace-password]').getBoundingClientRect(),input=document.querySelector('.password-field').getBoundingClientRect(),actions=document.querySelector('#workspace-login .local-actions').getBoundingClientRect();return {label:input.top-label.bottom,after:actions.top-input.bottom}});assert.ok(gaps.label>=0&&gaps.label<=8&&gaps.after>=15);assert.equal(await page.locator('#workspace-data').isVisible(),false);assert.equal(await page.locator('#demo-reset').isVisible(),false);assert.equal(await page.locator('#ai-connections').isVisible(),false);assert.equal(await page.locator('#companion-controls').isVisible(),false);await page.locator('#local-close').click();
 assert.equal(await page.locator('#workspace-banner').count(),0);const headings=await page.locator('#tv-settings .set-card > h3').allTextContents();assert.deepEqual(headings.slice(0,3),['Session Login','Appearance','Exit SessionTV']);assert.equal(await page.locator('#session-exit').getAttribute('href'),'https://tannermayfield.dev/#projects');await page.locator('#preferences-open').click();await page.locator('[data-pref="scheme"][data-value="dark"]').click();assert.equal(await page.locator('body').getAttribute('data-scheme'),'dark');await page.locator('[data-pref="screenEffect"][data-value="off"]').click();assert.equal(await page.locator('#tv-noise').isVisible(),false);await page.locator('[data-pref="cut"][data-value="0"]').click();assert.equal(await page.evaluate(()=>TV.cutLen),0);await page.locator('[data-pref="scheme"][data-value="auto"]').click();await page.locator('[data-pref="screenEffect"][data-value="on"]').click();await page.locator('[data-pref="cut"][data-value="4"]').click();await page.locator('#preferences-close').click();await page.locator('#tv-settings').screenshot({path:'public/images/session-tv-settings.png'});await page.locator('#preferences-open').click();await page.locator('#appearance-preferences').screenshot({path:'public/images/session-tv-preferences.png'});await page.locator('#preferences-close').click();
 const proportions=[];
 for(const viewport of [{width:1280,height:628},{width:1920,height:905}]){
  await page.setViewportSize(viewport);
  const ratio=await page.evaluate(()=>{const tv=document.querySelector('.room').getBoundingClientRect(),button=document.getElementById('preferences-open').getBoundingClientRect();return {buttonHeight:button.height/tv.height,buttonWidth:button.width/tv.width,tvWidth:tv.width,tvHeight:tv.height}});
  proportions.push(ratio);await page.screenshot({path:'test-results/session-tv-scale-'+viewport.width+'.png'});
 }
 assert.ok(Math.abs(proportions[0].buttonHeight-proportions[1].buttonHeight)<.001);
 assert.ok(Math.abs(proportions[0].buttonWidth-proportions[1].buttonWidth)<.001);
 await page.setViewportSize({width:1440,height:1000});
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:width===390?844:628});
  for(const view of ['classes','skills','projects']){
   await page.locator('[data-db="'+view+'"]').click();
   assert.equal(await page.locator('#tv-settings .sheet-head #db-add').count(),1);
   assert.equal(await page.locator('#set-x').getAttribute('aria-label'),'Back to settings');
   if(view==='classes')assert.ok(await page.locator('.class-section [data-add-assignment]').count()>0);
   assert.equal(await page.locator('#set-x').evaluate(el=>el.previousElementSibling.id),'db-add');
   await page.screenshot({path:'test-results/settings-'+view+'-'+width+'.png'});
   await page.locator('#set-x').click();assert.equal(await page.locator('#preferences-open').isVisible(),true);
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 const visitor=await browser.newContext();const second=await visitor.newPage();await second.goto(origin+'/session-tv/');await second.waitForFunction(()=>typeof loaded!=='undefined'&&loaded.tasks);assert.deepEqual(await second.evaluate(()=>tasks.map(t=>({id:t.id,title:t.title,status:t.status}))),published);await visitor.close();
 await page.evaluate(()=>tune(tasks[0].id,{cut:false}));await page.waitForTimeout(400);await mkdir('public/images',{recursive:true});if(process.env.UPDATE_SESSION_TV_SCREENSHOT)await page.screenshot({path:'public/images/session-tv.png',fullPage:false});
 await page.setViewportSize({width:390,height:844});if(await page.locator('#btn-set').getAttribute('aria-pressed')!=='true')await page.locator('#btn-set').click();await page.locator('#local-open').click();assert.equal(await page.locator('#local-setup').isVisible(),true);await page.locator('#local-close').click();assert.equal(await page.locator('#local-open').isVisible(),true);await page.locator('#preferences-open').click();assert.equal(await page.locator('#appearance-preferences').evaluate(el=>el.scrollHeight>el.clientHeight+1),false);const mobilePreferences=await page.locator('#appearance-preferences').boundingBox();assert.ok(mobilePreferences.x>=0&&mobilePreferences.x+mobilePreferences.width<=391);await mkdir('test-results',{recursive:true});await page.locator('#appearance-preferences').screenshot({path:'test-results/session-tv-mobile-preferences.png'});await page.locator('#preferences-close').click();
 // Exercise private settings with a test-only workspace, without real account data.
 const privateContext=await browser.newContext({viewport:{width:1280,height:628},reducedMotion:'reduce'});
 const privatePage=await privateContext.newPage();privatePage.on('pageerror',error=>errors.push(error.message));
 await privatePage.route(/\/js\/preview\.js(?:\?|$)/,route=>route.fulfill({contentType:'text/javascript',body:'/* Private settings test context. */'}));
 await privatePage.goto(origin+'/session-tv/');await privatePage.waitForFunction(()=>!!globalThis.SessionSpeech&&!!globalThis.SessionMusic&&current&&loaded.tasks&&loaded.state);
 await privatePage.evaluate(()=>{SessionWorkspace.setPrivate('test-owner');renderSettings()});await startTV(privatePage);
 await privatePage.locator('#tv-guide [data-act=add-assignment]').click();assert.equal(await privatePage.locator('#create-assignment').isVisible(),true);assert.equal(await privatePage.locator('#create-assignment [name=course]').inputValue(),'');assert.ok(await privatePage.locator('#create-assignment [name=course] option').count()>1);await privatePage.locator('#create-assignment [data-close-form]').click();
 await privatePage.locator('#btn-set').click();assert.equal(await privatePage.locator('#account-settings-open').isVisible(),true);await privatePage.evaluate(()=>{Object.defineProperty(SessionCloud,'user',{get:()=>({id:'test-owner',email:'owner@example.test'}),configurable:true});SessionCompanion.status=async()=>({connected:true,signedIn:true,workspaces:[]});SessionCompanion.chatGPTStatus=async()=>({connected:true});return SessionConnections.refresh()});await privatePage.waitForFunction(()=>document.querySelectorAll('#session-connection-summary .connected').length===2);assert.equal(await privatePage.locator('#session-preferences-open').textContent(),'Open Full Preferences');
 await privatePage.evaluate(()=>{Object.defineProperty(SessionCloud,'user',{get:()=>({id:'test-owner',email:'owner@example.test'}),configurable:true});SessionCloud.accountInfo=async()=>({id:'test-owner',email:'owner@example.test',identities:[{provider:'email'}]})});
 await privatePage.locator('#account-settings-open').click();await privatePage.waitForFunction(()=>document.getElementById('account-email').textContent==='owner@example.test');
 for(const width of [1280,390]){await privatePage.setViewportSize({width,height:width===390?844:628});const box=await privatePage.locator('#account-settings').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);await privatePage.locator('#account-settings').screenshot({path:'test-results/account-settings-'+width+'.png'})}
 await privatePage.locator('#account-settings [data-close]').click();await privatePage.locator('#session-preferences-open').click();
 for(const width of [1280,390]){
  await privatePage.setViewportSize({width,height:width===390?844:628});
  for(const tab of ['sections','voices','music','ai']){
   await privatePage.locator('#pref-tab-'+tab).click();
   const panel=privatePage.locator('#session-'+(tab==='ai'?'ai':tab));assert.equal(await panel.isVisible(),true);
   const box=await privatePage.locator('#local-setup').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);
   await privatePage.screenshot({path:'test-results/session-preferences-'+tab+'-'+width+'.png'});
  }
 }
 await privatePage.locator('#local-close').click();await privatePage.locator('#set-x').click();
 await privatePage.evaluate(async()=>{await tune(tasks.find(task=>typeOf(task)==='project').id,{cut:false});closeSheets();go('work');document.getElementById('coach-form').hidden=false;});
 assert.equal(await privatePage.locator('#coach-form .speech-controls').count(),1);
 await privatePage.setViewportSize({width:1280,height:628});await privatePage.screenshot({path:'test-results/session-tv-speech-controls.png'});
 await privatePage.route('https://embed.music.apple.com/**',route=>route.fulfill({contentType:'text/html',body:'<button>Play</button><p>Apple player test fixture</p>'}));
 await privatePage.evaluate(()=>SessionMusic.openRadio());
 const radioFrame=privatePage.locator('#tv-radio iframe');assert.equal(await radioFrame.count(),1);assert.match(await radioFrame.getAttribute('src'),/pl.u-RRbVLGNTebXKMbo/);
 await radioFrame.evaluate(el=>el.dataset.radioTest='persistent');await privatePage.locator('[data-radio-close]').click();assert.equal(await radioFrame.getAttribute('data-radio-test'),'persistent');
 await privatePage.evaluate(()=>{TV.mode='guide';TV.guideCat='class';renderGuide()});assert.match(await radioFrame.getAttribute('src'),/pl.u-vxy6JJxI82jM32P/);
 await privatePage.evaluate(()=>SessionMusic.openRadio());
 for(const width of [1280,390]){
  await privatePage.setViewportSize({width,height:width===390?844:628});
  const box=await privatePage.locator('#tv-radio').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);
  await privatePage.locator('[data-radio-stop]').click();assert.equal(await privatePage.locator('#tv-radio iframe').count(),0);
  await privatePage.locator('[data-radio-close]').click();await privatePage.evaluate(()=>SessionMusic.openRadio());
 }
 // Exercise subscription chat with mocked local transport; no paid inference or account access.
 await privatePage.evaluate(()=>{
  SessionCompanion.chatGPTStatus=async()=>({connected:true,account:{client_id:'test-client',email:'owner@example.test'},planUsageEnabled:true});
  SessionCompanion.chatGPTModels=async()=>({models:[{slug:'account-model',display_name:'Account model'}]});
  SessionCompanion.chatGPTStart=async({onEvent})=>{onEvent({type:'response.output_text.delta',delta:'**Formatted** reply'});onEvent({type:'response.completed'})};
 });
 await privatePage.evaluate(()=>SessionChatGPT.open());
 await privatePage.locator('#chatgpt-input').fill('Hello');await privatePage.locator('#chatgpt-send').click();
 await privatePage.waitForFunction(()=>document.getElementById('chatgpt-log').textContent.includes('Formatted'));
 assert.equal(await privatePage.locator('#chatgpt-log strong').textContent(),'Formatted');
 assert.equal(await privatePage.locator('#chatgpt-form .speech-controls').count(),1);
 for(const width of [1280,390]){
  await privatePage.setViewportSize({width,height:width===390?844:628});
  const box=await privatePage.locator('#chatgpt-chat').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);
  await privatePage.locator('#chatgpt-chat').screenshot({path:'test-results/session-tv-chatgpt-'+width+'.png'});
 }
 await privatePage.locator('#chatgpt-chat [data-close]').click();
 // Work resets to Medium on reentry, while Plan and Apply keep Light.
 await privatePage.evaluate(async()=>{
  const task=tasks.find(task=>typeOf(task)==='project'),name=task.course;
  store('sb.projectCodingChats',{[name]:{folder:'test-folder',chats:['plan','apply','work'].map(mode=>({mode,threadId:mode,messages:[]}))}});
  SessionCompanion.models=async()=>({models:[{id:'latest-codex',displayName:'Latest Codex'}],selectedModel:'latest-codex',efforts:['low','medium','high','xhigh']});
  current.projModes={...(current.projModes||{}),[name]:'work'};await tune(task.id,{cut:false});closeSheets();go('work');renderWork();
 });
 await privatePage.waitForFunction(()=>document.getElementById('project-reasoning')&&!document.getElementById('project-reasoning').disabled);
 assert.equal(await privatePage.locator('#project-reasoning').inputValue(),'medium');
 await privatePage.locator('#project-reasoning').selectOption('xhigh');assert.equal(await privatePage.locator('#project-reasoning').inputValue(),'xhigh');
 await privatePage.evaluate(()=>{openSettings();closeSheets();renderWork()});assert.equal(await privatePage.locator('#project-reasoning').inputValue(),'medium');
 for(const mode of ['plan','apply']){
  await privatePage.evaluate(mode=>{const task=tasks.find(task=>typeOf(task)==='project');current.projModes[task.course]=mode;renderWork()},mode);
  assert.equal(await privatePage.locator('#project-reasoning').count(),0);assert.match(await privatePage.locator('.project-model-controls').textContent(),/Light/);
 }
 await privateContext.close();
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('Static Pages preview: immutable records, navigation/refresh, visitor isolation, hidden edit controls, usable sign-in, AI gate, mobile and assets passed.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
