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
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const page=await context.newPage();const errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)missing.push(r.url())});
 await page.goto(origin+'/session-tv/');await page.waitForFunction(()=>typeof loaded!=='undefined'&&loaded.tasks&&current);assert.equal(await page.evaluate(()=>SessionWorkspace.mode),'demo');assert.equal(await page.evaluate(()=>tasks.length),7);
 await page.evaluate(()=>db.doc('tasks/demo-cs').update({title:'Edited public assignment',status:'done'}));await page.reload();await page.waitForFunction(()=>typeof loaded!=='undefined'&&loaded.tasks&&current);assert.equal(await page.evaluate(()=>tasks.find(t=>t.id==='demo-cs').status),'done');
 await page.evaluate(()=>go('log'));await page.waitForURL('**/#log');await page.reload();await page.waitForFunction(()=>typeof loaded!=='undefined'&&loaded.tasks&&current);assert.equal(await page.locator('#view-log').isVisible(),true);await page.goBack();
 await page.goto(origin+'/session-tv/');await page.waitForFunction(()=>typeof loaded!=='undefined'&&loaded.tasks&&current);await page.locator('#workspace-open').click();await page.locator('#companion-controls').isHidden().then(assert.ok);page.once('dialog',d=>d.accept());await page.locator('#demo-reset').click();await page.waitForFunction(()=>typeof loaded!=='undefined'&&loaded.tasks&&tasks.find(t=>t.id==='demo-cs')?.status==='todo');
 const visitor=await browser.newContext();const second=await visitor.newPage();await second.goto(origin+'/session-tv/');await second.waitForFunction(()=>typeof loaded!=='undefined'&&loaded.tasks);assert.equal(await second.evaluate(()=>tasks.find(t=>t.id==='demo-cs').title),'Practice loops and functions');await visitor.close();
 await page.evaluate(()=>tune('demo-cs',{cut:false}));await page.waitForTimeout(400);await mkdir('public/images',{recursive:true});await page.screenshot({path:'public/images/session-tv.png',fullPage:false});
 await page.setViewportSize({width:390,height:844});await page.locator('#workspace-open').click();assert.equal(await page.locator('#local-setup').isVisible(),true);await page.locator('#local-close').click();assert.equal(await page.locator('#workspace-open').isVisible(),true);
 assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('Static Pages demo: editable persistence, hash refresh, visitor isolation, reset, AI gate, mobile, assets and authentic screenshot passed.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
