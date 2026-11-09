/* drag the number to reorder sprint tasks */
function ppDragInit(ol,onDone){
  if(!ol)return;
  const scroller=el=>{for(let e=el;e&&e!==document.body;e=e.parentElement){const o=getComputedStyle(e).overflowY;if((o==='auto'||o==='scroll')&&e.scrollHeight>e.clientHeight)return e}return null};
  ol.querySelectorAll('li[data-iid] .pp-n').forEach(h=>{
    h.onpointerdown=e=>{
      if(e.button!==0)return;e.preventDefault();
      const li=h.closest('li'),rows=[...ol.querySelectorAll('li[data-iid]')],from=rows.indexOf(li),sc=scroller(ol);
      const sTop=()=>sc?sc.scrollTop:0,top0=sTop();
      const tops=rows.map(r=>{const b=r.getBoundingClientRect();return {top:b.top+top0,h:b.height}});
      let lastY=e.clientY,to=from,raf=0;const y0=e.clientY+top0;
      li.classList.add('dragging');h.setPointerCapture(e.pointerId);
      const place=()=>{const cy=lastY+sTop(),dy=cy-y0;li.style.transform=`translateY(${dy}px)`;
        const mid=tops[from].top+tops[from].h/2+dy;to=tops.findIndex(r=>mid<r.top+r.h/2);if(to<0)to=rows.length-1;
        const H=tops[from].h;rows.forEach((r,i)=>{if(r===li)return;let s=0;if(from<to&&i>from&&i<=to)s=-H;if(from>to&&i<from&&i>=to)s=H;r.style.transform=s?`translateY(${s}px)`:''})};
      const tick=()=>{raf=0;if(!sc)return;const b=sc.getBoundingClientRect(),edge=44;let v=0;
        if(lastY<b.top+edge)v=-Math.ceil((b.top+edge-lastY)/4);else if(lastY>b.bottom-edge)v=Math.ceil((lastY-(b.bottom-edge))/4);
        if(v){const before=sc.scrollTop;sc.scrollTop+=Math.max(-18,Math.min(18,v));if(sc.scrollTop!==before)place();raf=requestAnimationFrame(tick)}};
      const move=ev=>{lastY=ev.clientY;place();if(!raf)raf=requestAnimationFrame(tick)};
      const up=()=>{cancelAnimationFrame(raf);raf=0;h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',up);h.removeEventListener('pointercancel',up);
        rows.forEach(r=>{r.style.transform='';r.classList.remove('dragging')});
        if(to!==from){const ids=rows.map(r=>r.dataset.iid);const [m]=ids.splice(from,1);ids.splice(to,0,m);onDone(ids)}};
      h.addEventListener('pointermove',move);h.addEventListener('pointerup',up);h.addEventListener('pointercancel',up);
    };
    h.onkeydown=e=>{if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;e.preventDefault();const rows=[...ol.querySelectorAll('li[data-iid]')],ids=rows.map(r=>r.dataset.iid),i=ids.indexOf(h.closest('li').dataset.iid),j=i+(e.key==='ArrowUp'?-1:1);if(j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];onDone(ids)};
    h.tabIndex=0;
  });
}
