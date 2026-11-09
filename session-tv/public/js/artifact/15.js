/* points → time guide */
const PT_H={1:.25,2:.5,3:1,5:3,8:5,13:10};
function fmtH(h){if(h<1)return Math.round(h*60)+' m';const r=Math.round(h*4)/4;return (Number.isInteger(r)?r:r.toFixed(r*4%2?2:1).replace(/0$/,''))+' h'}
function ppPtsMenu(items){
  const tot=items.reduce((a,b)=>a+(b.pts||0),0),hrs=items.reduce((a,b)=>a+(PT_H[b.pts]||0),0);
  return `<div class="pp-ptmenu" role="menu" id="pp-ptmenu"><div class="pp-ptsum"><b>${tot} pts</b><span>≈ ${fmtH(hrs)}</span></div><div class="pp-ptsep"></div>${PTS.map(p=>`<div class="pp-ptrow"><b>${p} pt${p===1?'':'s'}</b><span>≈ ${fmtH(PT_H[p])}</span></div>`).join('')}</div>`;
}
document.addEventListener('click',e=>{if(TV.ptOpen&&!(e.target.closest&&e.target.closest('.pp-ptw'))){TV.ptOpen=false;const t=T(current&&current.active);if(t&&$('pp')&&!$('pp').hidden)ppRender(t)}});
addEventListener('keydown',e=>{if(e.key==='Escape'&&TV.ptOpen){e.stopImmediatePropagation();TV.ptOpen=false;const t=T(current&&current.active);if(t)ppRender(t)}},true);
