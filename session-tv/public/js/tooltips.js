/* TV-style tooltips for every element with a title attribute.
   The browser's own tooltip is suppressed by parking the title in data-tv-title (leaving an empty
   title, which also hides any ancestor's title) while the element is hovered or focused; it is
   restored afterwards. While parked, el.title, getAttribute('title'),
   setAttribute('title', …) and removeAttribute('title') keep working, so code can change a title at
   any time (the visible tip follows). Icon-only controls also get an aria-label from their title. */
(() => {
 const PARKED='data-tv-title',OWNED='data-tv-title-label',DELAY=450,WARM=350,GAP=8,EDGE=6;
 const tip=document.createElement('div');tip.id='tv-tooltip';tip.className='tv-tooltip';tip.setAttribute('role','tooltip');tip.hidden=true;
 const text=document.createElement('span');tip.append(text);document.body.append(tip);
 let held=null,heldText=null,hovering=false,focused=false,dismissed=false,timer=0,lastHidden=0,describedBy=false;
 const proto=Element.prototype,isTitle=name=>String(name).toLowerCase()==='title';

 // accessible names: icon-only controls (and unlabeled fields) are named by their title, as before
 function needsLabel(el){
  if(el.hasAttribute('aria-labelledby'))return false;
  if(el.hasAttribute('aria-label')&&!el.hasAttribute(OWNED))return false;
  if(el.matches('iframe'))return true;
  if(el.matches('input, select, textarea'))return !el.labels?.length;
  return el.matches('button, a, [role="button"], svg')&&!el.textContent.trim();
 }
 function label(el,value){
  if(!needsLabel(el))return;
  if(value){el.setAttribute('aria-label',value);el.setAttribute(OWNED,'')}
  else if(el.hasAttribute(OWNED)){el.removeAttribute('aria-label');el.removeAttribute(OWNED)}
 }
 function scan(root){
  if(root.nodeType!==1)return;
  const list=root.matches('[title]')?[root]:[];list.push(...root.querySelectorAll('[title]'));
  for(const el of list)label(el,el.getAttribute('title'));
  // an SVG <title> child becomes the svg's title attribute so it gets the same tip
  for(const node of root.matches('svg')?[root]:root.querySelectorAll('svg'))
   for(const child of [...node.children])if(child.localName==='title'){if(!node.hasAttribute('title'))node.setAttribute('title',child.textContent.trim());child.remove()}
 }

 // park the title while the tip owns the element
 function park(value){
  heldText=value==null?null:String(value);
  if(heldText==null)proto.removeAttribute.call(held,PARKED);else proto.setAttribute.call(held,PARKED,heldText);
  label(held,heldText);
  if(!heldText){hide();return}
  text.textContent=heldText;
  if(!tip.hidden)place();else if((hovering||focused)&&!timer){dismissed=false;schedule(DELAY)}
 }
 function hold(el){
  if(held===el)return;release();
  held=el;heldText=proto.getAttribute.call(el,'title');proto.setAttribute.call(el,PARKED,heldText||'');proto.setAttribute.call(el,'title','');
  Object.defineProperties(el,{
   title:{configurable:true,get:()=>heldText??'',set:value=>park(value)},
   getAttribute:{configurable:true,value:name=>isTitle(name)?heldText:proto.getAttribute.call(el,name)},
   hasAttribute:{configurable:true,value:name=>isTitle(name)?heldText!=null:proto.hasAttribute.call(el,name)},
   setAttribute:{configurable:true,value:(name,value)=>isTitle(name)?park(value):proto.setAttribute.call(el,name,value)},
   removeAttribute:{configurable:true,value:name=>isTitle(name)?park(null):proto.removeAttribute.call(el,name)}
  });
  watcher.observe(document.body,{childList:true,subtree:true});
 }
 function release(){
  if(!held)return;const el=held,value=heldText;
  hide();held=null;heldText=null;hovering=focused=dismissed=false;watcher.disconnect();
  for(const key of ['title','getAttribute','hasAttribute','setAttribute','removeAttribute'])delete el[key];
  proto.removeAttribute.call(el,PARKED);
  if(value==null)el.removeAttribute('title');else el.setAttribute('title',value);
 }
 const watcher=new MutationObserver(()=>{if(held&&!held.isConnected)release()});

 // show, place and hide
 function schedule(delay){clearTimeout(timer);timer=setTimeout(show,delay)}
 function show(){
  timer=0;if(!held||dismissed||!heldText||!held.isConnected)return;
  text.textContent=heldText;
  let host=document.body;try{const dialog=held.closest('dialog');if(dialog?.matches(':modal'))host=dialog}catch{}
  if(tip.parentElement!==host)host.append(tip);
  tip.hidden=false;place();tip.dataset.show='';
  const name=held.getAttribute('aria-label')||held.textContent.trim();
  if(heldText!==name&&!held.hasAttribute(OWNED)){const ids=(proto.getAttribute.call(held,'aria-describedby')||'').split(/\s+/).filter(Boolean);if(!ids.includes(tip.id)){ids.push(tip.id);proto.setAttribute.call(held,'aria-describedby',ids.join(' '));describedBy=true}}
 }
 function place(){
  if(!held||tip.hidden)return;
  const r=held.getBoundingClientRect(),vw=document.documentElement.clientWidth||innerWidth,vh=document.documentElement.clientHeight||innerHeight;
  tip.style.left='0px';tip.style.top='0px';const box=tip.getBoundingClientRect(),w=box.width,h=box.height;
  let top=r.top-h-GAP,side='top';if(top<EDGE){top=r.bottom+GAP;side='bottom'}
  if(top+h>vh-EDGE)top=Math.max(EDGE,vh-h-EDGE);
  const center=r.left+r.width/2,left=Math.min(Math.max(EDGE,center-w/2),Math.max(EDGE,vw-w-EDGE));
  // a transformed or zoomed ancestor shifts fixed positioning; correct by the measured offset
  tip.style.left=(left-box.left)+'px';tip.style.top=(top-box.top)+'px';
  tip.dataset.side=side;tip.style.setProperty('--tip-arrow',Math.min(Math.max(10,center-left),Math.max(10,w-10))+'px');
 }
 function hide(){
  clearTimeout(timer);timer=0;
  if(!tip.hidden)lastHidden=performance.now();
  tip.hidden=true;delete tip.dataset.show;
  if(describedBy&&held){const ids=(proto.getAttribute.call(held,'aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==tip.id);if(ids.length)proto.setAttribute.call(held,'aria-describedby',ids.join(' '));else proto.removeAttribute.call(held,'aria-describedby')}
  describedBy=false;
 }
 const target=node=>node?.nodeType===1&&!tip.contains(node)?node.closest('[title]'):null;
 function enter(el,delay){
  if(!el)return;
  if(held!==el){hold(el);dismissed=false}
  if(!tip.hidden||!heldText)return;
  schedule(performance.now()-lastHidden<WARM?0:delay);
 }

 document.addEventListener('pointerover',event=>{
  if(event.pointerType==='touch')return;const el=target(event.target);if(!el){if(held&&!focused)release();return}
  hovering=true;enter(el,DELAY);
 },true);
 document.addEventListener('pointerout',event=>{
  if(!held||held.contains(event.relatedTarget))return;
  hovering=false;if(!focused)release();else hide();
 },true);
 document.addEventListener('focusin',event=>{
  const el=target(event.target);if(!el)return;let keyboard=true;try{keyboard=event.target.matches(':focus-visible')}catch{}
  focused=true;if(keyboard)enter(el,120);else if(held!==el)hold(el);
 },true);
 document.addEventListener('focusout',event=>{
  if(!held||!held.contains(event.target)||held.contains(event.relatedTarget))return;
  focused=false;if(!hovering)release();else hide();
 },true);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&held){dismissed=true;hide()}},true);
 document.addEventListener('pointerdown',()=>{if(held){dismissed=true;hide()}},true);
 addEventListener('scroll',()=>{if(held&&!tip.hidden){dismissed=true;hide()}},{capture:true,passive:true});
 addEventListener('resize',()=>hide());addEventListener('blur',()=>release());
 document.addEventListener('visibilitychange',()=>{if(document.hidden)release()});

 // keep aria-labels in step with titles as the app renders and changes them
 scan(document.body);
 new MutationObserver(records=>{
  for(const record of records){
   if(record.type==='attributes'){const el=record.target;if(el!==held&&el.hasAttribute('title'))label(el,el.getAttribute('title'))}
   else for(const node of record.addedNodes)scan(node);
  }
 }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['title']});

 globalThis.SessionTooltips=Object.freeze({hide:()=>{dismissed=true;hide()},get element(){return tip}});
})();
