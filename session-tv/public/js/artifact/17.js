/* "Signal Lost" test card when nothing is tuned in */
function noSigSVG(){
  const ray=(cx,cy,r0,r1,ang,n,spread,w)=>{let d='';for(let i=0;i<n;i++){const a=(ang+(i-(n-1)/2)*spread)*Math.PI/180;d+=`M${(cx+Math.cos(a)*r0).toFixed(1)} ${(cy+Math.sin(a)*r0).toFixed(1)}L${(cx+Math.cos(a)*r1).toFixed(1)} ${(cy+Math.sin(a)*r1).toFixed(1)}`}return `<path d="${d}" stroke-width="${w}"/>`};
  const dial=(cx,cy,R,w)=>{const s=R/360;let g=`<circle cx="${cx}" cy="${cy}" r="${R}" stroke-width="${w*1.4}" fill="var(--ns-paper)"/>`;
    for(const a of [0,90,180,270])g+=ray(cx,cy,R*.24,R*.94,a,11,1.5,w*.9);
    for(const r of [.2,.17,.14,.11])g+=`<circle cx="${cx}" cy="${cy}" r="${R*r}" stroke-width="${w}" fill="${r===.2?'var(--ns-paper)':'none'}"/>`;
    for(const [r,a0] of [[.55,20],[.68,24],[.8,28]])for(const q of [0,90,180,270]){const a1=(q+a0)*Math.PI/180,a2=(q+90-a0)*Math.PI/180;
      g+=`<path d="M${cx+Math.cos(a1)*R*r} ${cy+Math.sin(a1)*R*r}A${R*r} ${R*r} 0 0 1 ${cx+Math.cos(a2)*R*r} ${cy+Math.sin(a2)*R*r}" stroke-width="${w*.8}" stroke-dasharray="${18*s} ${14*s}" fill="none"/>`}
    g+=`<path d="M${cx-R*.7} ${cy-R*.7}L${cx+R*.7} ${cy+R*.7}M${cx+R*.7} ${cy-R*.7}L${cx-R*.7} ${cy+R*.7}" stroke-width="${w*.6}" opacity=".7"/>`;return g};
  let grid='';for(let x=0;x<=1600;x+=100)grid+=`M${x} 0V1000`;for(let y=0;y<=1000;y+=100)grid+=`M0 ${y}H1600`;
  const sq=[[0,300],[100,200],[300,200],[700,0],[1100,0],[1200,200],[1300,400],[0,500],[500,600],[1100,700],[1400,500],[200,900],[900,800],[1500,300],[600,100],[1300,900],[400,900]].map(([x,y])=>`<rect x="${x}" y="${y}" width="100" height="100"/>`).join('');
  const txt=(y,t,size)=>`<text x="800" y="${y}" text-anchor="middle" font-size="${size}" class="ns-t">${t}</text>`;
  return `<svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><filter id="ns-grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .3  0 0 0 0 .25  0 0 0 .55 0"/></filter></defs>
    <rect width="1600" height="1000" fill="var(--ns-paper)"/>
    <g fill="var(--ns-ink)" opacity=".13">${sq}</g>
    <path d="${grid}" stroke="var(--ns-ink)" stroke-width="2" opacity=".18"/>
    <g stroke="var(--ns-ink)" fill="none">${dial(800,500,380,4)}${dial(190,190,125,3)}${dial(1410,190,125,3)}${dial(190,810,125,3)}${dial(1410,810,125,3)}</g>
    ${txt(250,'SIGNAL LOST',128)}${txt(845,'PLEASE OPEN THE MENU',74)}
    <rect width="1600" height="1000" filter="url(#ns-grain)" opacity=".5"/>
  </svg>`;
}
function ppNoSignal(on){
  let el=$('nosig');
  if(!on){if(el)el.hidden=true;$('work-main').classList.remove('nosig-on');return}
  if(!el){el=document.createElement('button');el.type='button';el.id='nosig';el.className='nosig';el.setAttribute('aria-label','Signal lost. Please open the menu');el.innerHTML=noSigSVG();el.onclick=()=>openGuide();$('work-main').appendChild(el)}
  el.hidden=false;$('work-main').classList.add('nosig-on');
}
