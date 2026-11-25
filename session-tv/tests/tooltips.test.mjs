import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {source} from './manifest.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function boot(body){
 const dom=new JSDOM('<!doctype html><body data-scheme="dark">'+body+'</body>',{url:'https://session.test/',runScripts:'dangerously',pretendToBeVisual:true}),w=dom.window;
 w.eval(source('tooltips.js'));
 const Pointer=w.PointerEvent||w.MouseEvent;
 const over=(el,related=null)=>el.dispatchEvent(new Pointer('pointerover',{bubbles:true,pointerType:'mouse',relatedTarget:related}));
 const out=(el,related=null)=>el.dispatchEvent(new Pointer('pointerout',{bubbles:true,pointerType:'mouse',relatedTarget:related}));
 return {dom,w,tip:w.document.getElementById('tv-tooltip'),over,out};
}

test('hovering parks the title, shows the TV tip after a delay and restores the title on leave',async()=>{
 const {dom,w,tip,over,out}=boot('<button id="b" title="Open the menu">Menu</button><p id="away">x</p>');try{
  const b=w.document.getElementById('b');assert.equal(tip.getAttribute('role'),'tooltip');
  over(b);
  assert.equal(b.getAttribute('data-tv-title'),'Open the menu');
  assert.equal(w.Element.prototype.getAttribute.call(b,'title'),'','the native tooltip is suppressed while hovered');
  assert.equal(b.title,'Open the menu');assert.equal(b.getAttribute('title'),'Open the menu');
  assert.equal(tip.hidden,true,'waits before showing');
  await wait(520);
  assert.equal(tip.hidden,false);assert.equal(tip.textContent,'Open the menu');
  assert.match(b.getAttribute('aria-describedby')||'',/tv-tooltip/);
  out(b,w.document.getElementById('away'));
  assert.equal(tip.hidden,true);
  assert.equal(b.getAttribute('title'),'Open the menu');assert.equal(b.hasAttribute('data-tv-title'),false);assert.equal(b.hasAttribute('aria-describedby'),false);
 }finally{dom.window.close()}
});

test('title changes while hovered update the tip and are kept after leaving',async()=>{
 const {dom,w,tip,over,out}=boot('<a id="item" href="#" title="Weekly quiz">Weekly quiz</a><button id="x" title="Remove">×</button><p id="away">x</p>');try{
  const item=w.document.getElementById('item'),away=w.document.getElementById('away');
  over(item);await wait(520);assert.equal(tip.hidden,false);
  item.title='Click again to open';
  assert.equal(tip.textContent,'Click again to open');assert.equal(item.title,'Click again to open');
  item.setAttribute('title','Selected');assert.equal(tip.textContent,'Selected');
  out(item,away);assert.equal(item.getAttribute('title'),'Selected');
  over(item);item.removeAttribute('title');assert.equal(tip.hidden,true);assert.equal(item.hasAttribute('title'),false);
  out(item,away);assert.equal(item.hasAttribute('title'),false,'a title removed while hovered stays removed');
  // a click dismisses the tip; a new title set by the click shows again
  const x=w.document.getElementById('x');over(x);await wait(520);assert.equal(tip.hidden,false);
  x.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true}));assert.equal(tip.hidden,true);
  x.title='Click again to remove';await wait(520);assert.equal(tip.hidden,false);assert.equal(tip.textContent,'Click again to remove');
 }finally{dom.window.close()}
});

test('keyboard focus shows the tip, Escape hides it and blur restores the title',async()=>{
 const {dom,w,tip}=boot('<button id="b" title="Settings"><svg aria-hidden="true"></svg></button><button id="c">Next</button>');try{
  const b=w.document.getElementById('b');
  assert.equal(b.getAttribute('aria-label'),'Settings','icon-only controls are named by their title');
  b.focus();await wait(200);assert.equal(tip.hidden,false);assert.equal(tip.textContent,'Settings');
  assert.equal(b.getAttribute('aria-describedby'),null,'no duplicate description when the title is the name');
  w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(tip.hidden,true);
  w.document.getElementById('c').focus();
  assert.equal(b.getAttribute('title'),'Settings');assert.equal(b.hasAttribute('data-tv-title'),false);
  b.title='Preferences';await wait(0);assert.equal(b.getAttribute('aria-label'),'Preferences','owned labels follow title changes');
  const text=w.document.getElementById('c');text.title='Go on';await wait(0);assert.equal(text.hasAttribute('aria-label'),false,'controls with text keep their own name');
 }finally{dom.window.close()}
});

test('the tip stays inside the viewport and flips below elements near the top',async()=>{
 const {dom,w,tip,over}=boot('<button id="b" title="A long explanation for a control at the edge">!</button>');try{
  const b=w.document.getElementById('b');
  b.getBoundingClientRect=()=>({left:990,right:1010,top:5,bottom:25,width:20,height:20});
  tip.getBoundingClientRect=()=>({left:0,top:0,right:120,bottom:20,width:120,height:20});
  over(b);await wait(520);
  assert.equal(tip.dataset.side,'bottom');assert.equal(tip.style.top,'33px');
  assert.ok(parseFloat(tip.style.left)+120<=w.innerWidth-6,'kept inside the right edge: '+tip.style.left);
  b.remove();await wait(0);assert.equal(tip.hidden,true,'removing the element hides its tip');
 }finally{dom.window.close()}
});
