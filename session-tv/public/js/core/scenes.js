/* ================= original animated scenes for the channel cutscenes =================
   Each theme: {id, name, song (label only, music comes later), pal (ambient colors), init(W,H) -> state, draw(ctx,W,H,t,state)} */
const SC=(()=>{
  const mk=s=>()=>{s=(s*16807)%2147483647;return s/2147483647};
  const lerp=(a,b,k)=>a+(b-a)*k,TAU=Math.PI*2;
  const grad=(x,W,H,stops,y0=0,y1=H)=>{const g=x.createLinearGradient(0,y0,0,y1);stops.forEach(([o,c])=>g.addColorStop(o,c));x.fillStyle=g;x.fillRect(0,y0,W,y1-y0)};
  const glow=(x,cx,cy,r,col,a=1)=>{const g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');x.globalAlpha=a;x.fillStyle=g;x.fillRect(cx-r,cy-r,r*2,r*2);x.globalAlpha=1};
  const starsInit=(r,n)=>Array.from({length:n},()=>({x:r(),y:r(),s:r()*1.4+.3,p:r()*TAU,k:.5+r()*2}));
  const drawStars=(x,st,W,H,t,maxY=1,a=1)=>{for(const s of st){if(s.y>maxY)continue;x.globalAlpha=a*(.45+.55*Math.abs(Math.sin(t*s.k+s.p)));x.fillStyle='#fff';x.fillRect(s.x*W,s.y*H,s.s*W/900,s.s*W/900)}x.globalAlpha=1};
  const ridge=(x,W,H,base,amp,f,ph,col,seed=1)=>{x.fillStyle=col;x.beginPath();x.moveTo(0,H);for(let i=0;i<=60;i++){const u=i/60;const y=H*(base-amp*(.55*Math.sin(u*f*TAU+ph)+.3*Math.sin(u*f*2.7*TAU+ph*1.7+seed)+.15*Math.sin(u*f*6.1*TAU+seed)));x.lineTo(u*W,y)}x.lineTo(W,H);x.closePath();x.fill()};
  const rainInit=(r,n)=>Array.from({length:n},()=>({x:r(),y:r(),l:.02+r()*.04,v:.9+r()*.8}));
  const drawRain=(x,rn,W,H,t,col='rgba(200,215,235,.45)',slant=.12)=>{x.strokeStyle=col;x.lineWidth=Math.max(1,W/1200);x.beginPath();for(const d of rn){const y=((d.y+t*d.v*.9)%1.1)-.05,xx=((d.x+y*slant)%1)*W;x.moveTo(xx,y*H);x.lineTo(xx+d.l*slant*H,(y+d.l)*H)}x.stroke()};
  const puff=(x,cx,cy,s,col,shade)=>{const b=[[-.9,.15,.55],[-.4,-.15,.75],[.25,-.25,.85],[.85,.1,.6],[0,.2,.7]];if(shade){x.fillStyle=shade;b.forEach(([dx,dy,r])=>{x.beginPath();x.arc(cx+dx*s,cy+dy*s+s*.12,r*s,0,TAU);x.fill()})}x.fillStyle=col;b.forEach(([dx,dy,r])=>{x.beginPath();x.arc(cx+dx*s,cy+dy*s,r*s,0,TAU);x.fill()})};
  const windows=(x,bx,by,bw,bh,r,lit,col)=>{const cw=Math.max(3,bw/7),ch=Math.max(4,cw*1.3);for(let yy=by+ch;yy<by+bh-ch;yy+=ch*1.7)for(let xx=bx+cw*.8;xx<bx+bw-cw;xx+=cw*1.7){if(r()<lit){x.fillStyle=col;x.fillRect(xx,yy,cw,ch)}}};
  const fadeIn=(x,W,H,t,d=1.2)=>{if(t<d){x.fillStyle=`rgba(0,0,0,${1-t/d})`;x.fillRect(0,0,W,H)}};
  const vignette=(x,W,H,a=.45)=>{const g=x.createRadialGradient(W/2,H/2,Math.min(W,H)*.35,W/2,H/2,Math.max(W,H)*.75);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,`rgba(0,0,0,${a})`);x.fillStyle=g;x.fillRect(0,0,W,H)};
  return {mk,lerp,TAU,grad,glow,starsInit,drawStars,ridge,rainInit,drawRain,puff,windows,fadeIn,vignette};
})();

const THEMES={class:[],skill:[],project:[]};
const addTheme=(k,o)=>THEMES[k].push(o);

/* ===== CLASS · chill, relaxing, romance ===== */
addTheme('class',{id:'paris',name:'Paris at Night',song:'Ratatouille soundtrack',pal:['#141a3a','#2a1f45','#f2b36b','#5a4a9a','#ffd68a'],
  init(W,H){const r=SC.mk(11);return {st:SC.starsInit(r,140),roofs:Array.from({length:26},(_,i)=>({x:i/25,h:.12+r()*.1,w:.05+r()*.04,ch:r()<.6})),r}},
  draw(x,W,H,t,S){const {grad,glow,drawStars,TAU}=SC;const pan=t*W*.006;
    grad(x,W,H,[[0,'#0d1230'],[.55,'#2b2150'],[.8,'#57385e'],[1,'#1a1630']]);drawStars(x,S.st,W,H,t,.55);
    glow(x,W*.8,H*.17,H*.18,'rgba(255,240,210,.35)');x.fillStyle='#fff6e0';x.beginPath();x.arc(W*.8,H*.17,H*.045,0,TAU);x.fill();
    // the tower: a lattice silhouette with twinkling lights
    const tx=W*.42-pan*.4,base=H*.78,top=H*.12,tw=H*.26;x.save();x.strokeStyle='#1a1426';x.fillStyle='#1a1426';x.lineWidth=Math.max(1,W/700);
    x.beginPath();x.moveTo(tx-tw/2,base);x.quadraticCurveTo(tx-tw*.12,H*.5,tx-tw*.03,top);x.lineTo(tx+tw*.03,top);x.quadraticCurveTo(tx+tw*.12,H*.5,tx+tw/2,base);x.lineTo(tx+tw*.3,base);x.quadraticCurveTo(tx,H*.62,tx-tw*.3,base);x.closePath();x.fill();
    x.fillRect(tx-tw*.2,H*.6,tw*.4,H*.012);x.fillRect(tx-tw*.11,H*.42,tw*.22,H*.01);x.fillRect(tx-1,top-H*.04,2,H*.04);
    const sparkle=(t%6)<2.2;for(let i=0;i<70;i++){const u=i/70,yy=lerpY(u),half=(tw/2)*Math.pow(1-u,1.9)*(u<.02?1:1);const xx=tx+(i%2?1:-1)*half*((i*37)%10)/10;
      x.globalAlpha=sparkle?(Math.random()<.5?1:.15):.55;x.fillStyle=sparkle?'#fff':'#ffcf7a';x.fillRect(xx,yy,W/600,W/600)}x.globalAlpha=1;x.restore();
    function lerpY(u){return base-(base-top)*u}
    glow(x,tx,top+H*.02,H*.06,'rgba(255,220,150,.5)');
    // rooftops with chimneys and warm windows
    const r2=SC.mk(5);x.fillStyle='#120f1d';for(const rf of S.roofs){const bx=((rf.x*W*1.1-pan)%(W*1.1)+W*1.1)%(W*1.1)-W*.05,bw=rf.w*W,by=H*(1-rf.h)-H*.06;
      x.beginPath();x.moveTo(bx,H);x.lineTo(bx,by);x.lineTo(bx+bw*.15,by-H*.03);x.lineTo(bx+bw*.85,by-H*.03);x.lineTo(bx+bw,by);x.lineTo(bx+bw,H);x.fill();if(rf.ch)x.fillRect(bx+bw*.6,by-H*.06,bw*.09,H*.04);
      SC.windows(x,bx,by,bw,H-by-H*.06,r2,.35,'rgba(255,200,110,.85)');x.fillStyle='#120f1d'}
    // the river with light reflections
    grad(x,W,H,[[0,'#1b1838'],[1,'#0a0a18']],H*.9,H);x.fillStyle='#0d0c1c';x.fillRect(0,H*.9,W,H*.1);
    for(let i=0;i<40;i++){const xx=(i/40)*W+Math.sin(t*2+i)*W*.004;x.fillStyle=`rgba(255,200,120,${.25+.2*Math.sin(t*3+i*1.7)})`;x.fillRect(xx,H*(.92+(i%5)*.015),W*.02,H*.003)}
    SC.vignette(x,W,H);SC.fadeIn(x,W,H,t)}});

addTheme('class',{id:'rainstreet',name:'Rainy City Street',song:'La La Land soundtrack',pal:['#0b1022','#2a1c46','#e0a35c','#3d5aa8','#a06bd0'],
  init(W,H){const r=SC.mk(23);return {rn:SC.rainInit(r,420),b:Array.from({length:14},(_,i)=>({h:.35+r()*.4,w:.07+r()*.05})),r}},
  draw(x,W,H,t,S){const {grad,glow}=SC;grad(x,W,H,[[0,'#0b0f26'],[.5,'#2a1d48'],[.62,'#3b2650'],[1,'#0b0d1a']]);
    const hz=H*.6;let bx=0;S.b.forEach((b,i)=>{const bw=b.w*W;x.fillStyle=i%2?'#151431':'#1b1838';x.fillRect(bx,hz-b.h*H*.6,bw,b.h*H*.6);SC.windows(x,bx,hz-b.h*H*.6,bw,b.h*H*.6,SC.mk(i+3),.3,'rgba(255,210,140,.6)');bx+=bw+W*.005});
    // street in perspective and wet reflections
    x.fillStyle='#0e0d1c';x.beginPath();x.moveTo(0,H);x.lineTo(W*.45,hz);x.lineTo(W*.55,hz);x.lineTo(W,H);x.fill();
    x.fillStyle='#17152a';x.fillRect(0,hz,W*.45,H-hz);x.fillRect(W*.55,hz,W*.45,H-hz);
    for(let i=0;i<7;i++){const k=i/6,z=Math.pow(k,1.6);const lx=SC.lerp(W*.44,W*.06,z),ly=SC.lerp(hz,H*.95,z),lh=SC.lerp(H*.05,H*.55,z);
      x.fillStyle='#0a0a14';x.fillRect(lx-1,ly-lh,Math.max(2,W/500*(1+z*3)),lh);glow(x,lx,ly-lh,H*(.03+z*.08),'rgba(255,205,120,.75)');
      const g=x.createLinearGradient(0,ly,0,ly+H*.25*z);g.addColorStop(0,'rgba(255,200,110,.45)');g.addColorStop(1,'rgba(255,200,110,0)');x.fillStyle=g;x.fillRect(lx-W*.006*(1+z*2),ly,W*.012*(1+z*2),H*.25*z);
      const rx=W-lx;x.fillStyle='#0a0a14';x.fillRect(rx-1,ly-lh,Math.max(2,W/500*(1+z*3)),lh);glow(x,rx,ly-lh,H*(.03+z*.08),'rgba(200,160,255,.65)')}
    // passing car lights
    const c=(t*.13)%1.4;if(c<1){const z=Math.pow(c,2),cx=SC.lerp(W*.5,W*.62,z),cy=SC.lerp(hz,H*.98,z),s=H*(.01+z*.06);glow(x,cx-s,cy,s*3,'rgba(255,250,230,.9)');glow(x,cx+s,cy,s*3,'rgba(255,250,230,.9)')}
    SC.drawRain(x,S.rn,W,H,t*1.6,'rgba(190,200,240,.35)',.08);SC.vignette(x,W,H,.55);SC.fadeIn(x,W,H,t)}});

addTheme('class',{id:'studydesk',name:'Late-Night Study Desk',song:'Love themes (slow piano)',pal:['#151018','#2a1d22','#f0a85a','#3b4e7a','#ffcf8a'],
  init(W,H){const r=SC.mk(31);return {drops:Array.from({length:40},()=>({x:r(),y:r(),v:.03+r()*.08,s:.003+r()*.006})),bok:Array.from({length:45},()=>({x:r(),y:r(),r:.01+r()*.03,c:r()})),r}},
  draw(x,W,H,t,S){const {glow,TAU}=SC;x.fillStyle='#1a1418';x.fillRect(0,0,W,H);
    // window with a blurred rainy city
    const wx=W*.18,wy=H*.08,ww=W*.5,wh=H*.5;x.fillStyle='#0f1630';x.fillRect(wx,wy,ww,wh);
    x.save();x.beginPath();x.rect(wx,wy,ww,wh);x.clip();for(const b of S.bok){x.globalAlpha=.35+.25*Math.sin(t+b.c*9);x.fillStyle=b.c<.5?'#ffc070':b.c<.8?'#7aa0ff':'#ff8fa8';x.beginPath();x.arc(wx+b.x*ww,wy+b.y*wh,b.r*W,0,TAU);x.fill()}x.globalAlpha=1;
    for(const d of S.drops){const yy=((d.y+t*d.v)%1);x.fillStyle='rgba(220,230,255,.5)';x.beginPath();x.ellipse(wx+d.x*ww,wy+yy*wh,d.s*W*.6,d.s*W,0,0,TAU);x.fill();x.fillStyle='rgba(220,230,255,.12)';x.fillRect(wx+d.x*ww-1,wy+(yy-.08)*wh,2,.08*wh)}x.restore();
    x.strokeStyle='#3a2a22';x.lineWidth=W*.008;x.strokeRect(wx,wy,ww,wh);x.beginPath();x.moveTo(wx+ww/2,wy);x.lineTo(wx+ww/2,wy+wh);x.moveTo(wx,wy+wh/2);x.lineTo(wx+ww,wy+wh/2);x.stroke();
    // desk, lamp light, books, mug with steam, glowing laptop
    x.fillStyle='#3a2618';x.fillRect(0,H*.66,W,H*.34);x.fillStyle='#2b1b10';x.fillRect(0,H*.66,W,H*.02);
    const lx=W*.78,ly=H*.3;glow(x,lx,H*.7,H*.55,'rgba(255,190,110,.42)');
    x.strokeStyle='#1b1410';x.lineWidth=W*.006;x.beginPath();x.moveTo(lx+W*.06,H*.68);x.lineTo(lx+W*.08,H*.45);x.lineTo(lx,ly);x.stroke();
    x.fillStyle='#2a1f19';x.beginPath();x.moveTo(lx-W*.05,ly+H*.05);x.lineTo(lx+W*.03,ly-H*.04);x.lineTo(lx+W*.06,ly+H*.02);x.closePath();x.fill();glow(x,lx-W*.01,ly+H*.05,H*.08,'rgba(255,230,170,.9)');
    [['#6b2f2f',.08],['#2f4f6b',.06],['#6b5a2f',.07]].forEach(([c,h],i)=>{x.fillStyle=c;x.fillRect(W*(.08+i*.035),H*(.66-h),W*.03,H*h)});
    x.fillStyle='#d9d1c4';x.fillRect(W*.6,H*.6,W*.045,H*.07);x.strokeStyle='#d9d1c4';x.lineWidth=W*.005;x.beginPath();x.arc(W*.648,H*.635,H*.02,-1.2,1.2);x.stroke();
    for(let i=0;i<3;i++){x.strokeStyle=`rgba(255,255,255,${.12+.05*i})`;x.lineWidth=W*.003;x.beginPath();for(let k=0;k<20;k++){const yy=H*(.59-k*.008),xx=W*(.62+i*.008)+Math.sin(t*1.5+k*.5+i)*W*.006;k?x.lineTo(xx,yy):x.moveTo(xx,yy)}x.stroke()}
    x.fillStyle='#1d2230';x.beginPath();x.moveTo(W*.3,H*.68);x.lineTo(W*.52,H*.68);x.lineTo(W*.5,H*.5);x.lineTo(W*.32,H*.5);x.fill();glow(x,W*.41,H*.6,H*.18,'rgba(120,170,255,.35)');x.fillStyle='rgba(150,190,255,.55)';x.fillRect(W*.335,H*.515,W*.16,H*.15);
    SC.vignette(x,W,H,.55);SC.fadeIn(x,W,H,t)}});

addTheme('class',{id:'lanterns',name:'Lanterns Over the Lake',song:'Up soundtrack',pal:['#2b1b3d','#d07a4a','#ffcf7a','#7a3d6b','#ff9a5a'],
  init(W,H){const r=SC.mk(41);return {L:Array.from({length:70},()=>({x:r(),y:1+r()*.9,v:.02+r()*.035,s:.5+r(),p:r()*6})),st:SC.starsInit(r,80)}},
  draw(x,W,H,t,S){const {grad,glow,ridge}=SC;grad(x,W,H,[[0,'#1d1433'],[.45,'#5b2d57'],[.7,'#d0704a'],[.78,'#f0a560'],[1,'#3a1f2c']]);SC.drawStars(x,S.st,W,H,t,.35,.7);
    ridge(x,W,H,.74,.06,1.3,1,'#3a1f3d',2);ridge(x,W,H,.8,.05,2,3,'#25142a',5);
    grad(x,W,H,[[0,'#6b3a4a'],[1,'#1a0f1c']],H*.8,H);x.fillRect(0,H*.8,W,H*.2);
    for(const l of S.L){const y=l.y-t*l.v,yy=y*H*.85,xx=(l.x+Math.sin(t*.3+l.p)*.01)*W;if(y<-.1||y>1.1)continue;const s=W*.007*l.s*(1-y*.3);
      glow(x,xx,yy,s*4,'rgba(255,180,90,.45)');x.fillStyle='#ffcf7a';x.fillRect(xx-s/2,yy-s*.7,s,s*1.3);x.fillStyle='#fff1c4';x.fillRect(xx-s/4,yy+s*.2,s/2,s*.3);
      if(y>.0&&y<.95){x.globalAlpha=.25;x.fillStyle='#ffcf7a';x.fillRect(xx-s/2,H*.8+(H*.8-yy)*.12,s,s*.5);x.globalAlpha=1}}
    SC.vignette(x,W,H,.45);SC.fadeIn(x,W,H,t)}});

addTheme('class',{id:'reef',name:'Coral Reef',song:'Finding Nemo soundtrack',pal:['#0b3b63','#06213b','#2fb4c9','#ff8a6a','#7ae0d0'],
  init(W,H){const r=SC.mk(53);return {fish:Array.from({length:26},(_,i)=>({y:.25+r()*.45,v:.03+r()*.05,s:.6+r(),c:['#ffd36b','#7ad0ff','#ff9ec4','#b7ff8a','#c9a0ff'][i%5],o:r()})),bub:Array.from({length:40},()=>({x:r(),y:r(),v:.03+r()*.05,s:r()})),cor:Array.from({length:16},(_,i)=>({x:i/15+r()*.03,h:.12+r()*.16,c:['#ff7f6a','#ffb36a','#e86ab8','#8a7cff'][i%4]}))}},
  draw(x,W,H,t,S){const {grad,TAU}=SC;grad(x,W,H,[[0,'#2aa7c9'],[.4,'#0f6a97'],[1,'#062641']]);
    for(let i=0;i<6;i++){x.globalAlpha=.07+.04*Math.sin(t*.6+i);x.fillStyle='#e8ffff';x.beginPath();const bx=W*(.1+i*.17)+Math.sin(t*.2+i)*W*.03;x.moveTo(bx,0);x.lineTo(bx+W*.05,0);x.lineTo(bx+W*.2,H);x.lineTo(bx+W*.1,H);x.fill()}x.globalAlpha=1;
    x.fillStyle='#d9c08a';x.beginPath();x.moveTo(0,H);x.lineTo(0,H*.88);for(let i=0;i<=20;i++)x.lineTo(i/20*W,H*(.87+.02*Math.sin(i*1.3)));x.lineTo(W,H);x.fill();
    for(const c of S.cor){const bx=c.x*W,by=H*.9;x.strokeStyle=c.c;x.lineCap='round';x.lineWidth=W*.008;
      const br=(px,py,a,len,d)=>{if(d>3)return;const ex=px+Math.cos(a)*len,ey=py+Math.sin(a)*len;x.beginPath();x.moveTo(px,py);x.lineTo(ex,ey);x.stroke();br(ex,ey,a-.45+Math.sin(t*.8+bx)*.05,len*.7,d+1);br(ex,ey,a+.45,len*.7,d+1)};br(bx,by,-Math.PI/2,c.h*H*.5,0)}
    for(let i=0;i<10;i++){const bx=W*(.05+i*.1),by=H*.9;x.strokeStyle='rgba(120,255,200,.6)';x.lineWidth=W*.004;for(let k=0;k<7;k++){x.beginPath();x.moveTo(bx+k*W*.004,by);x.quadraticCurveTo(bx+k*W*.004+Math.sin(t*1.5+k+i)*W*.012,by-H*.05,bx+k*W*.004+Math.sin(t*1.5+k+i)*W*.02,by-H*.09);x.stroke()}}
    for(const f of S.fish){const xx=((f.o+t*f.v)%1.2-.1)*W,yy=(f.y+Math.sin(t+f.o*9)*.02)*H,s=W*.018*f.s;x.fillStyle=f.c;x.beginPath();x.ellipse(xx,yy,s,s*.45,0,0,TAU);x.fill();x.beginPath();x.moveTo(xx-s*.8,yy);x.lineTo(xx-s*1.5,yy-s*.45*(1+.3*Math.sin(t*8+f.o*5)));x.lineTo(xx-s*1.5,yy+s*.45);x.fill();x.fillStyle='#012';x.beginPath();x.arc(xx+s*.55,yy-s*.1,s*.09,0,TAU);x.fill()}
    for(const b of S.bub){const yy=1-((b.y+t*b.v)%1);x.strokeStyle='rgba(230,255,255,.5)';x.lineWidth=1;x.beginPath();x.arc(b.x*W+Math.sin(t*2+b.s*9)*W*.004,yy*H,W*.003*(1+b.s*2),0,TAU);x.stroke()}
    SC.vignette(x,W,H,.4);SC.fadeIn(x,W,H,t)}});

addTheme('class',{id:'aurora',name:'Northern Lights Cabin',song:'Inside Out soundtrack',pal:['#081428','#0c2a3a','#3cf0b0','#7a6cff','#1f8a8a'],
  init(W,H){const r=SC.mk(67);return {st:SC.starsInit(r,170),snow:Array.from({length:120},()=>({x:r(),y:r(),v:.02+r()*.04,s:r()})),trees:Array.from({length:22},()=>({x:r(),h:.08+r()*.12}))}},
  draw(x,W,H,t,S){const {grad,glow,ridge,TAU}=SC;grad(x,W,H,[[0,'#050b1c'],[.6,'#0d2238'],[1,'#13304a']]);SC.drawStars(x,S.st,W,H,t,.6);
    x.globalCompositeOperation='lighter';for(let b=0;b<3;b++){const c=['rgba(60,240,170,','rgba(120,110,255,','rgba(60,200,220,'][b];
      for(let i=0;i<=80;i++){const u=i/80,yy=H*(.18+b*.07+.07*Math.sin(u*5+t*.35+b)+.03*Math.sin(u*13-t*.5)),h=H*(.16+.06*Math.sin(u*7+t*.4+b));const g=x.createLinearGradient(0,yy,0,yy+h);g.addColorStop(0,c+'0)');g.addColorStop(.3,c+'.22)');g.addColorStop(1,c+'0)');x.fillStyle=g;x.fillRect(u*W,yy,W/80+1,h)}}
    x.globalCompositeOperation='source-over';
    ridge(x,W,H,.72,.08,1,2,'#16324a',3);ridge(x,W,H,.84,.05,1.6,4,'#dfe9f2',6);x.fillStyle='#eaf1f7';x.fillRect(0,H*.88,W,H*.12);
    for(const tr of S.trees){const bx=tr.x*W,by=H*.86,h=tr.h*H;x.fillStyle='#0b1a24';x.beginPath();x.moveTo(bx,by-h);x.lineTo(bx+h*.28,by);x.lineTo(bx-h*.28,by);x.fill()}
    const cx=W*.6,cy=H*.86;x.fillStyle='#3a2416';x.fillRect(cx,cy-H*.09,W*.1,H*.09);x.fillStyle='#24140c';x.beginPath();x.moveTo(cx-W*.01,cy-H*.09);x.lineTo(cx+W*.05,cy-H*.15);x.lineTo(cx+W*.11,cy-H*.09);x.fill();
    x.fillStyle='#ffc773';x.fillRect(cx+W*.02,cy-H*.06,W*.022,H*.03);glow(x,cx+W*.03,cy-H*.045,H*.07,'rgba(255,190,100,.5)');x.fillStyle='#eaf1f7';x.fillRect(cx-W*.01,cy-H*.093,W*.12,H*.008);
    for(let i=0;i<6;i++){const k=((t*.15+i/6)%1);x.globalAlpha=.25*(1-k);x.fillStyle='#cfd8e0';x.beginPath();x.arc(cx+W*.085+Math.sin(k*6)*W*.01,cy-H*(.15+k*.2),W*.008*(1+k*3),0,TAU);x.fill()}x.globalAlpha=1;
    for(const s of S.snow){x.fillStyle='rgba(255,255,255,.8)';x.fillRect(((s.x+Math.sin(t+s.s*9)*.01)%1)*W,((s.y+t*s.v)%1)*H,W/600*(1+s.s),W/600*(1+s.s))}
    SC.vignette(x,W,H,.45);SC.fadeIn(x,W,H,t)}});

/* ===== SKILLS · creative fun ===== */
addTheme('skill',{id:'bluesky',name:'Blue Sky & Clouds',song:'Toy Story soundtrack',pal:['#7cc4f2','#cfeeff','#ffffff','#9ed6ff','#fff3c4'],
  init(W,H){const r=SC.mk(71);return {c:Array.from({length:12},()=>({x:r()*1.3,y:.1+r()*.7,s:.04+r()*.07,v:.006+r()*.012}))}},
  draw(x,W,H,t,S){const {grad,glow,puff,TAU}=SC;grad(x,W,H,[[0,'#5fb2ef'],[.7,'#a9dcfb'],[1,'#d8f1ff']]);glow(x,W*.85,H*.15,H*.4,'rgba(255,255,240,.6)');
    S.c.slice().sort((a,b)=>a.s-b.s).forEach(c=>{const xx=((c.x+t*c.v)%1.3-.15)*W;puff(x,xx,c.y*H,c.s*W,'#ffffff','rgba(170,205,235,.8)')});
    const px=((t*.07)%1.3-.15)*W,py=H*(.45+.08*Math.sin(t*.8));x.save();x.translate(px,py);x.rotate(.08*Math.sin(t*.8+1));const s=W*.03;x.fillStyle='#fff';x.strokeStyle='#8aa';x.lineWidth=1;
    x.beginPath();x.moveTo(s,0);x.lineTo(-s,-s*.45);x.lineTo(-s*.6,0);x.closePath();x.fill();x.stroke();x.fillStyle='#e3ecf2';x.beginPath();x.moveTo(s,0);x.lineTo(-s,s*.25);x.lineTo(-s*.6,0);x.closePath();x.fill();x.stroke();x.restore();
    SC.fadeIn(x,W,H,t)}});

addTheme('skill',{id:'bayou',name:'Bayou at Dusk',song:'The Princess and the Frog soundtrack',pal:['#1b2a3a','#2a3b2a','#f2d06b','#4a6a4a','#c58ad0'],
  init(W,H){const r=SC.mk(83);return {ff:Array.from({length:60},()=>({x:r(),y:.3+r()*.5,p:r()*6,k:.5+r()})),st:SC.starsInit(r,60),pads:Array.from({length:14},()=>({x:r(),y:.82+r()*.14,s:r()}))}},
  draw(x,W,H,t,S){const {grad,glow,TAU}=SC;grad(x,W,H,[[0,'#1d1f3a'],[.45,'#3d3a5a'],[.62,'#a0708a'],[.66,'#2b3a32'],[1,'#0e1a16']]);SC.drawStars(x,S.st,W,H,t,.4,.6);
    x.fillStyle='#fff3c8';x.beginPath();x.arc(W*.28,H*.24,H*.06,0,TAU);x.fill();glow(x,W*.28,H*.24,H*.2,'rgba(255,240,200,.35)');
    for(let i=0;i<7;i++){const bx=W*(.05+i*.15),h=H*(.45+(i%3)*.1),top=H*.66-h;x.fillStyle='#0f1813';x.beginPath();x.moveTo(bx-W*.02,H*.7);x.lineTo(bx-W*.006,top+h*.3);x.lineTo(bx+W*.006,top+h*.3);x.lineTo(bx+W*.02,H*.7);x.fill();
      x.beginPath();x.ellipse(bx,top+h*.2,W*.06,H*.07,0,0,TAU);x.fill();x.strokeStyle='rgba(90,110,80,.7)';x.lineWidth=W*.002;
      for(let k=0;k<9;k++){const mx=bx-W*.05+k*W*.012;x.beginPath();x.moveTo(mx,top+h*.22);x.quadraticCurveTo(mx+Math.sin(t*.8+k)*W*.004,top+h*.3,mx+Math.sin(t*.8+k)*W*.006,top+h*(.35+(k%3)*.05));x.stroke()}}
    grad(x,W,H,[[0,'#2a3540'],[1,'#0b1412']],H*.7,H);x.fillRect(0,H*.7,W,H*.3);
    x.globalAlpha=.3;x.fillStyle='#fff3c8';x.beginPath();x.ellipse(W*.28,H*.78,H*.05,H*.012,0,0,TAU);x.fill();for(let i=0;i<6;i++){x.fillRect(W*.25+Math.sin(t*2+i)*W*.01,H*(.8+i*.02),W*.06,H*.003)}x.globalAlpha=1;
    for(const p of S.pads){x.fillStyle='#2f5a36';x.beginPath();x.ellipse(p.x*W,p.y*H+Math.sin(t+p.s*6)*H*.003,W*.025*(.6+p.s),H*.008*(.6+p.s),0,.3,TAU);x.fill()}
    x.globalCompositeOperation='lighter';for(const f of S.ff){const a=Math.max(0,Math.sin(t*f.k*2+f.p));const xx=(f.x+Math.sin(t*.3+f.p)*.02)*W,yy=(f.y+Math.cos(t*.25+f.p)*.03)*H;glow(x,xx,yy,W*.012,`rgba(240,255,140,${.8*a})`)}x.globalCompositeOperation='source-over';
    SC.vignette(x,W,H,.5);SC.fadeIn(x,W,H,t)}});

addTheme('skill',{id:'workshop',name:'Clockwork Workshop',song:'Monsters, Inc. soundtrack',pal:['#2a1a10','#4a2e18','#e0a040','#8a5a2a','#ffd27a'],
  init(W,H){const r=SC.mk(97);return {g:[[.25,.4,.16,14,1],[.46,.62,.11,10,-1.4],[.62,.32,.13,12,1.1],[.8,.6,.09,9,-1.6],[.12,.75,.08,8,1.8],[.88,.22,.07,8,-2]],sp:Array.from({length:30},()=>({x:r(),y:r(),v:r()}))}},
  draw(x,W,H,t,S){const {grad,glow,TAU}=SC;grad(x,W,H,[[0,'#24150c'],[1,'#120a06']]);glow(x,W*.5,H*.45,H*.7,'rgba(255,170,70,.25)');
    const gear=(cx,cy,r,n,a,c1,c2)=>{x.save();x.translate(cx,cy);x.rotate(a);x.fillStyle=c1;x.beginPath();for(let i=0;i<n*2;i++){const rr=i%2?r*.82:r;const a0=i/(n*2)*TAU,a1=(i+1)/(n*2)*TAU;x.lineTo(Math.cos(a0)*rr,Math.sin(a0)*rr);x.lineTo(Math.cos(a1)*rr,Math.sin(a1)*rr)}x.closePath();x.fill();
      x.fillStyle=c2;x.beginPath();x.arc(0,0,r*.62,0,TAU);x.fill();x.fillStyle=c1;for(let k=0;k<5;k++){x.save();x.rotate(k/5*TAU);x.fillRect(-r*.06,0,r*.12,r*.62);x.restore()}x.beginPath();x.arc(0,0,r*.16,0,TAU);x.fill();x.fillStyle='#2a1a10';x.beginPath();x.arc(0,0,r*.07,0,TAU);x.fill();x.restore()};
    S.g.forEach(([gx,gy,r,n,sp],i)=>gear(gx*W,gy*H,r*H,n,t*sp*.5,i%2?'#b8823a':'#d9a24a','#3a2414'));
    const px=W*.5,py=H*.05,len=H*.55,a=.35*Math.sin(t*1.8);x.strokeStyle='#c89a4a';x.lineWidth=W*.004;x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.sin(a)*len,py+Math.cos(a)*len);x.stroke();x.fillStyle='#e7bb5a';x.beginPath();x.arc(px+Math.sin(a)*len,py+Math.cos(a)*len,H*.04,0,TAU);x.fill();
    for(const s of S.sp){const k=(t*.5+s.v)%1;if(k<.25){x.fillStyle=`rgba(255,220,120,${1-k*4})`;x.fillRect(W*.46+k*W*.2*(s.x-.5)*4,H*.62-k*H*.3*s.y,W/400,W/400)}}
    for(let i=0;i<4;i++){const k=(t*.12+i/4)%1;x.globalAlpha=.18*(1-k);x.fillStyle='#e8ded0';x.beginPath();x.arc(W*.9,H*(.95-k*.6),W*.02*(1+k*2),0,TAU);x.fill()}x.globalAlpha=1;
    SC.vignette(x,W,H,.55);SC.fadeIn(x,W,H,t)}});

addTheme('skill',{id:'kelp',name:'Kelp Forest',song:'The Little Mermaid soundtrack',pal:['#0b4a55','#06232b','#3fd0b0','#2f7a9a','#f0e08a'],
  init(W,H){const r=SC.mk(109);return {k:Array.from({length:22},()=>({x:r(),h:.5+r()*.45,w:.6+r(),p:r()*6})),j:Array.from({length:5},()=>({x:r(),y:r(),p:r()*6})),b:Array.from({length:30},()=>({x:r(),y:r(),v:.03+r()*.04})),f:Array.from({length:30},()=>({o:r(),y:.3+r()*.3}))}},
  draw(x,W,H,t,S){const {grad,glow,TAU}=SC;grad(x,W,H,[[0,'#3fb4b8'],[.35,'#126b78'],[1,'#03161c']]);
    for(let i=0;i<5;i++){x.globalAlpha=.08;x.fillStyle='#f0ffe0';x.beginPath();const bx=W*(.15+i*.18)+Math.sin(t*.3+i)*W*.02;x.moveTo(bx,0);x.lineTo(bx+W*.04,0);x.lineTo(bx+W*.16,H);x.lineTo(bx+W*.07,H);x.fill()}x.globalAlpha=1;
    for(const f of S.f){const xx=((f.o+t*.02)%1)*W,yy=(f.y+.03*Math.sin(t*.8+f.o*20))*H;x.fillStyle='rgba(200,240,255,.6)';x.beginPath();x.ellipse(xx,yy,W*.006,W*.0025,0,0,TAU);x.fill()}
    for(const k of S.k){const bx=k.x*W;x.strokeStyle=`rgba(${60+k.w*40|0},${140+k.w*30|0},70,.9)`;x.lineWidth=W*.006*k.w;x.beginPath();x.moveTo(bx,H);for(let i=1;i<=24;i++){const u=i/24;x.lineTo(bx+Math.sin(t*.9+k.p+u*3)*W*.025*u,H-u*k.h*H)}x.stroke();
      for(let i=3;i<24;i+=3){const u=i/24,xx=bx+Math.sin(t*.9+k.p+u*3)*W*.025*u,yy=H-u*k.h*H;x.fillStyle='rgba(110,170,70,.8)';x.beginPath();x.ellipse(xx+W*.008,yy,W*.01,W*.003,.6,0,TAU);x.fill()}}
    for(const j of S.j){const pulse=.85+.15*Math.sin(t*2.5+j.p),xx=(j.x+.02*Math.sin(t*.4+j.p))*W,yy=((j.y-t*.02)%1+1)%1*H*.8+H*.05;x.fillStyle='rgba(255,170,220,.55)';x.beginPath();x.ellipse(xx,yy,W*.025*pulse,W*.018,0,Math.PI,TAU);x.fill();
      x.strokeStyle='rgba(255,190,230,.45)';x.lineWidth=1;for(let k=0;k<6;k++){x.beginPath();x.moveTo(xx-W*.02+k*W*.008,yy);x.quadraticCurveTo(xx-W*.02+k*W*.008+Math.sin(t*3+k)*W*.006,yy+W*.03,xx-W*.02+k*W*.008,yy+W*.05);x.stroke()}}
    for(const b of S.b){const yy=1-((b.y+t*b.v)%1);x.strokeStyle='rgba(220,255,255,.45)';x.beginPath();x.arc(b.x*W,yy*H,W*.003,0,TAU);x.stroke()}
    SC.vignette(x,W,H,.5);SC.fadeIn(x,W,H,t)}});

addTheme('skill',{id:'beach',name:'Sunny Beach',song:'Moana & Rio soundtracks',pal:['#7fd0ef','#f3dfb4','#ffd34a','#2fa8c0','#ffffff'],
  init(W,H){const r=SC.mk(121);return {gulls:Array.from({length:5},()=>({o:r(),y:.15+r()*.2,s:.6+r()*.6})),gl:Array.from({length:40},()=>({x:r(),y:r(),p:r()*6}))}},
  draw(x,W,H,t,S){const {grad,glow,TAU}=SC;grad(x,W,H,[[0,'#56b8ea'],[.5,'#bfe8f6'],[.55,'#bfe8f6']]);glow(x,W*.75,H*.2,H*.35,'rgba(255,240,180,.8)');x.fillStyle='#fff7d6';x.beginPath();x.arc(W*.75,H*.2,H*.07,0,TAU);x.fill();
    grad(x,W,H,[[0,'#3aa9c4'],[1,'#2a8fb0']],H*.52,H*.75);x.fillRect(0,H*.52,W,H*.23);
    for(const g of S.gl){x.fillStyle=`rgba(255,255,255,${.6*Math.max(0,Math.sin(t*2+g.p))})`;x.fillRect(g.x*W,H*(.53+g.y*.2),W*.01,H*.003)}
    for(let i=0;i<4;i++){const yy=H*(.6+i*.04),off=Math.sin(t*1.2+i)*W*.02;x.strokeStyle='rgba(255,255,255,.5)';x.lineWidth=W*.003;x.beginPath();for(let k=0;k<=20;k++){const xx=k/20*W;const y2=yy+Math.sin(k*1.1+t*2+i)*H*.005;k?x.lineTo(xx+off,y2):x.moveTo(xx+off,y2)}x.stroke()}
    const sw=Math.sin(t*1.1)*H*.012;x.fillStyle='rgba(255,255,255,.85)';x.beginPath();x.moveTo(0,H*.74+sw);for(let k=0;k<=30;k++)x.lineTo(k/30*W,H*(.74+.008*Math.sin(k*.8+t*2))+sw);x.lineTo(W,H*.78+sw);x.lineTo(0,H*.78+sw);x.fill();
    grad(x,W,H,[[0,'#f3dfb4'],[1,'#e4c48a']],H*.76,H);x.beginPath();x.moveTo(0,H);x.lineTo(0,H*.77+sw);for(let k=0;k<=30;k++)x.lineTo(k/30*W,H*(.77+.008*Math.sin(k*.8+t*2))+sw);x.lineTo(W,H);x.fill();
    const px=W*.12,py=H*.95;x.strokeStyle='#5a3a1e';x.lineWidth=W*.012;x.beginPath();x.moveTo(px,py);x.quadraticCurveTo(px+W*.04,H*.6,px+W*.08,H*.32);x.stroke();
    for(let i=0;i<6;i++){const a=-2.6+i*.55+Math.sin(t*1.3+i)*.06;x.strokeStyle='#2f7a3a';x.lineWidth=W*.007;x.beginPath();x.moveTo(px+W*.08,H*.32);x.quadraticCurveTo(px+W*.08+Math.cos(a)*W*.06,H*.32+Math.sin(a)*W*.03-W*.02,px+W*.08+Math.cos(a)*W*.11,H*.32+Math.sin(a)*W*.05+W*.03);x.stroke()}
    for(const g of S.gulls){const xx=((g.o+t*.035)%1.2-.1)*W,yy=g.y*H+Math.sin(t*1.5+g.o*9)*H*.01,s=W*.015*g.s,f=Math.sin(t*6+g.o*20)*.6;x.strokeStyle='#33424a';x.lineWidth=Math.max(1.5,W/800);x.beginPath();x.moveTo(xx-s,yy-s*f*.5);x.quadraticCurveTo(xx-s*.4,yy-s*.5,xx,yy);x.quadraticCurveTo(xx+s*.4,yy-s*.5,xx+s,yy-s*f*.5);x.stroke()}
    SC.fadeIn(x,W,H,t)}});

addTheme('skill',{id:'desertdiner',name:'Desert Highway Diner',song:'Cars soundtrack',pal:['#3a1f3a','#f0805a','#ffd06a','#a04a3a','#4ad0d0'],
  init(W,H){const r=SC.mk(131);return {cac:Array.from({length:8},()=>({x:r(),s:.5+r()*.6})),st:SC.starsInit(r,50)}},
  draw(x,W,H,t,S){const {grad,glow,TAU}=SC;grad(x,W,H,[[0,'#2a1b42'],[.35,'#a0466a'],[.55,'#f08a5a'],[.62,'#ffc66a'],[.64,'#c0603a'],[1,'#5a2a1c']]);SC.drawStars(x,S.st,W,H,t,.25,.6);
    glow(x,W*.5,H*.6,H*.3,'rgba(255,200,110,.6)');x.fillStyle='#ffdf8a';x.beginPath();x.arc(W*.5,H*.62,H*.08,Math.PI,TAU);x.fill();
    x.fillStyle='#7a3328';[[.05,.12,.42],[.22,.2,.48],[.7,.18,.44],[.86,.14,.4]].forEach(([mx,mw,mh])=>{x.beginPath();x.moveTo(W*mx,H*.63);x.lineTo(W*(mx+.01),H*mh);x.lineTo(W*(mx+mw-.01),H*mh);x.lineTo(W*(mx+mw),H*.63);x.fill()});
    x.fillStyle='#8a4a2c';x.fillRect(0,H*.62,W,H*.38);x.fillStyle='#2a2226';x.beginPath();x.moveTo(W*.47,H*.62);x.lineTo(W*.53,H*.62);x.lineTo(W*.95,H);x.lineTo(W*.05,H);x.fill();
    for(let i=0;i<10;i++){const k=((i/10+t*.15)%1),z=k*k,y=H*(.62+z*.38),w=W*(.002+z*.012),h=H*(.004+z*.05);x.fillStyle='#ffd36a';x.fillRect(W*.5-w/2,y,w,h)}
    for(const c of S.cac){const bx=c.x<.5?c.x*W*.8:W*.2+c.x*W*.8,by=H*(.7+c.s*.25),h=H*.12*c.s;x.fillStyle='#2a3a24';x.fillRect(bx-W*.005*c.s,by-h,W*.01*c.s,h);x.fillRect(bx-W*.02*c.s,by-h*.65,W*.015*c.s,W*.006*c.s);x.fillRect(bx-W*.02*c.s,by-h*.9,W*.006*c.s,h*.3);x.fillRect(bx+W*.005*c.s,by-h*.5,W*.015*c.s,W*.006*c.s);x.fillRect(bx+W*.014*c.s,by-h*.75,W*.006*c.s,h*.28)}
    const dx=W*.72,dy=H*.66;x.fillStyle='#d8d0c0';x.fillRect(dx,dy-H*.08,W*.16,H*.08);x.fillStyle='#4ad0d0';x.fillRect(dx,dy-H*.085,W*.16,H*.01);x.fillStyle='#ffe0a0';for(let i=0;i<4;i++)x.fillRect(dx+W*(.01+i*.038),dy-H*.06,W*.028,H*.03);
    const on=(Math.floor(t*2)%5)!==0;x.font=`700 ${Math.round(H*.05)}px "Limelight",Georgia,serif`;x.textAlign='center';x.fillStyle=on?'#ff5a8a':'#5a2a3a';if(on){x.shadowColor='#ff5a8a';x.shadowBlur=H*.03}x.fillText('DINER',dx+W*.08,dy-H*.12);x.shadowBlur=0;
    const ck=(t*.09)%1.3;if(ck<1.1){const z=ck,cx=W*(.53+z*.25),cy=H*(.63+z*z*.33),s=W*(.01+z*.05);x.fillStyle='#d9483a';x.beginPath();x.roundRect?x.roundRect(cx-s,cy-s*.5,s*2,s*.6,s*.2):x.rect(cx-s,cy-s*.5,s*2,s*.6);x.fill();x.fillStyle='#1a1416';x.beginPath();x.arc(cx-s*.6,cy+s*.1,s*.2,0,TAU);x.arc(cx+s*.6,cy+s*.1,s*.2,0,TAU);x.fill()}
    SC.vignette(x,W,H,.45);SC.fadeIn(x,W,H,t)}});

/* ===== PROJECTS · fast adventure ===== */
addTheme('project',{id:'retrocity',name:'Retro City Skyline',song:'The Incredibles soundtrack',pal:['#1a1030','#e0703a','#ffb84a','#3a2a6a','#ff5a3a'],
  init(W,H){const r=SC.mk(151);return {b:Array.from({length:22},()=>({w:.03+r()*.05,h:.25+r()*.45,sp:r()<.4,t:r()})),r}},
  draw(x,W,H,t,S){const {grad,glow}=SC;grad(x,W,H,[[0,'#1a1236'],[.5,'#6a2f4a'],[.78,'#f0803a'],[1,'#2a1224']]);
    for(let i=0;i<3;i++){const a=-.9+Math.sin(t*.6+i*2)*.5,bx=W*(.2+i*.3),by=H*.85;x.save();x.globalAlpha=.18;x.fillStyle='#ffe6b0';x.translate(bx,by);x.rotate(a);x.beginPath();x.moveTo(-W*.01,0);x.lineTo(W*.01,0);x.lineTo(W*.07,-H*1.2);x.lineTo(-W*.07,-H*1.2);x.fill();x.restore()}
    let bx=-W*.02;S.b.forEach((b,i)=>{const bw=b.w*W,bh=b.h*H,by=H*.9-bh;x.fillStyle=i%3?'#24183a':'#1b1230';
      x.beginPath();x.moveTo(bx,H);x.lineTo(bx,by+bw*.3);x.lineTo(bx+bw*.5,by);x.lineTo(bx+bw,by+bw*.3);x.lineTo(bx+bw,H);x.fill();if(b.sp){x.fillRect(bx+bw*.47,by-H*.08,bw*.06,H*.08)}
      SC.windows(x,bx,by+bw*.3,bw,bh,SC.mk(i*7+Math.floor(t*2)%2),.45,'rgba(255,190,90,.8)');bx+=bw+W*.004});
    x.fillStyle='#120a1c';x.fillRect(0,H*.9,W,H*.1);
    const k=(t*.25)%1.6;if(k<1){const sx=W*(-.1+k*1.2),sy=H*(.3+.1*Math.sin(k*3));const g=x.createLinearGradient(sx-W*.25,sy,sx,sy);g.addColorStop(0,'rgba(255,90,58,0)');g.addColorStop(1,'rgba(255,140,80,.9)');x.strokeStyle=g;x.lineWidth=H*.01;x.beginPath();x.moveTo(sx-W*.25,sy+H*.03);x.lineTo(sx,sy);x.stroke();glow(x,sx,sy,H*.05,'rgba(255,220,160,.9)')}
    SC.vignette(x,W,H,.45);SC.fadeIn(x,W,H,t)}});

addTheme('project',{id:'jungle',name:'Prehistoric Jungle',song:'Jurassic Park soundtrack',pal:['#0f2a1a','#3a5a2a','#c8e07a','#2a4a3a','#ff8a3a'],
  init(W,H){const r=SC.mk(163);return {fern:Array.from({length:18},()=>({x:r(),s:.6+r()*.7,p:r()*6})),birds:Array.from({length:3},()=>({o:r(),y:.15+r()*.15}))}},
  draw(x,W,H,t,S){const {grad,glow,ridge,TAU}=SC;grad(x,W,H,[[0,'#bcd8a8'],[.45,'#6f9a6a'],[1,'#1a3020']]);
    x.fillStyle='#4a5a4a';x.beginPath();x.moveTo(W*.55,H*.6);x.lineTo(W*.68,H*.25);x.lineTo(W*.73,H*.25);x.lineTo(W*.9,H*.6);x.fill();glow(x,W*.705,H*.25,H*.06,'rgba(255,120,50,.7)');
    for(let i=0;i<8;i++){const k=(t*.06+i/8)%1;x.globalAlpha=.35*(1-k);x.fillStyle='#6a6a6a';x.beginPath();x.arc(W*(.705+k*.08),H*(.22-k*.2),W*.02*(1+k*2),0,TAU);x.fill()}x.globalAlpha=1;
    ridge(x,W,H,.62,.06,1.5,1,'#3e6a48',2);
    const dk=(t*.025)%1.4-.2,dx=W*dk,dy=H*.6,s=H*.11,step=Math.sin(t*2.4);x.fillStyle='#2e4a38';
    x.beginPath();x.ellipse(dx,dy,s*1.1,s*.42,0,0,TAU);x.fill();x.beginPath();x.moveTo(dx+s*.8,dy-s*.1);x.quadraticCurveTo(dx+s*1.6,dy-s*1.2,dx+s*1.9,dy-s*1.6);x.lineTo(dx+s*2.05,dy-s*1.55);x.quadraticCurveTo(dx+s*1.7,dy-s*.9,dx+s*1.05,dy+s*.1);x.fill();
    x.beginPath();x.ellipse(dx+s*2.05,dy-s*1.62,s*.22,s*.11,.2,0,TAU);x.fill();x.beginPath();x.moveTo(dx-s*.9,dy);x.quadraticCurveTo(dx-s*1.8,dy-s*.1,dx-s*2.6,dy+s*.25);x.lineTo(dx-s*.9,dy+s*.25);x.fill();
    [[-.55,step],[-.2,-step],[.35,-step],[.7,step]].forEach(([o,st])=>{x.fillRect(dx+s*o+st*s*.06,dy+s*.2,s*.18,s*.62)});
    for(const b of S.birds){const xx=((b.o+t*.05)%1.3-.15)*W,yy=b.y*H,f=Math.sin(t*4+b.o*9);x.fillStyle='#2a3a30';x.beginPath();x.moveTo(xx,yy);x.lineTo(xx-W*.03,yy-H*.03*f);x.lineTo(xx-W*.012,yy+H*.004);x.lineTo(xx+W*.012,yy+H*.004);x.lineTo(xx+W*.03,yy-H*.03*f);x.closePath();x.fill();x.beginPath();x.moveTo(xx+W*.004,yy);x.lineTo(xx+W*.014,yy-H*.006);x.lineTo(xx+W*.004,yy-H*.004);x.fill()}
    x.fillStyle='rgba(220,240,210,.18)';x.fillRect(0,H*.55,W,H*.08);
    for(const f of S.fern){const bx=f.x*W,by=H,len=H*.32*f.s;for(let k=-3;k<=3;k++){const a=-Math.PI/2+k*.32+Math.sin(t*1.2+f.p)*.05;x.strokeStyle='#183a20';x.lineWidth=W*.004;x.beginPath();x.moveTo(bx,by);x.quadraticCurveTo(bx+Math.cos(a)*len*.5,by+Math.sin(a)*len*.7,bx+Math.cos(a)*len,by+Math.sin(a)*len*.9);x.stroke()}}
    SC.vignette(x,W,H,.45);SC.fadeIn(x,W,H,t)}});

addTheme('project',{id:'fjord',name:'Viking Fjord Village',song:'How to Train Your Dragon soundtrack',pal:['#1a2a3a','#3a5a6a','#ffb06a','#2a4a5a','#e0f0ff'],
  init(W,H){const r=SC.mk(177);return {st:SC.starsInit(r,60),h:Array.from({length:7},(_,i)=>({x:.08+i*.11+r()*.03,s:.7+r()*.5}))}},
  draw(x,W,H,t,S){const {grad,glow,TAU}=SC;grad(x,W,H,[[0,'#1d2a44'],[.4,'#5a6a8a'],[.6,'#e0a070'],[.62,'#2c3e4c'],[1,'#0e1a22']]);SC.drawStars(x,S.st,W,H,t,.3,.6);
    x.fillStyle='#2a3646';x.beginPath();x.moveTo(0,H*.62);x.lineTo(W*.1,H*.25);x.lineTo(W*.25,H*.4);x.lineTo(W*.33,H*.62);x.fill();x.beginPath();x.moveTo(W*.6,H*.62);x.lineTo(W*.75,H*.2);x.lineTo(W*.86,H*.34);x.lineTo(W,H*.3);x.lineTo(W,H*.62);x.fill();
    x.fillStyle='#dfe8f0';x.beginPath();x.moveTo(W*.085,H*.29);x.lineTo(W*.1,H*.25);x.lineTo(W*.12,H*.29);x.fill();x.beginPath();x.moveTo(W*.73,H*.25);x.lineTo(W*.75,H*.2);x.lineTo(W*.775,H*.26);x.fill();
    grad(x,W,H,[[0,'#3a5060'],[1,'#0e1a24']],H*.62,H);x.fillRect(0,H*.62,W,H*.38);for(let i=0;i<12;i++){x.fillStyle='rgba(255,200,140,.18)';x.fillRect(W*.4+Math.sin(t+i)*W*.03,H*(.64+i*.02),W*.12,H*.003)}
    x.fillStyle='#1f2a24';x.beginPath();x.moveTo(0,H*.82);x.quadraticCurveTo(W*.3,H*.7,W*.6,H*.8);x.lineTo(W*.6,H);x.lineTo(0,H);x.fill();
    for(const hs of S.h){if(hs.x>.55)continue;const bx=hs.x*W,by=H*(.78-hs.x*.06),w=W*.07*hs.s,h=H*.06*hs.s;x.fillStyle='#4a3020';x.fillRect(bx,by-h,w,h);x.fillStyle='#2a1a12';x.beginPath();x.moveTo(bx-w*.1,by-h);x.lineTo(bx+w/2,by-h*1.9);x.lineTo(bx+w*1.1,by-h);x.fill();
      x.fillStyle='#ffb46a';x.fillRect(bx+w*.4,by-h*.55,w*.18,h*.4);glow(x,bx+w*.5,by-h*.4,h*.9,'rgba(255,170,90,.45)');
      const k=(t*.2+hs.x*3)%1;x.globalAlpha=.25*(1-k);x.fillStyle='#ccd';x.beginPath();x.arc(bx+w*.5+Math.sin(k*5)*w*.1,by-h*(1.9+k*2.5),w*.08*(1+k*2),0,TAU);x.fill();x.globalAlpha=1}
    const bt=W*(.65+.05*Math.sin(t*.2)),by2=H*.74+Math.sin(t*1.2)*H*.004;x.fillStyle='#2a1a10';x.beginPath();x.moveTo(bt-W*.06,by2);x.quadraticCurveTo(bt,by2+H*.03,bt+W*.06,by2);x.lineTo(bt+W*.07,by2-H*.03);x.lineTo(bt+W*.05,by2-H*.005);x.lineTo(bt-W*.05,by2-H*.005);x.lineTo(bt-W*.07,by2-H*.03);x.fill();x.fillRect(bt-1,by2-H*.12,2,H*.11);x.fillStyle='#b8402a';x.fillRect(bt-W*.025,by2-H*.11,W*.05,H*.07);
    const dk=(t*.07)%1.4-.2,dx=W*dk,dy=H*(.25+.05*Math.sin(t*.9)),s=H*.06,f=Math.sin(t*5);x.fillStyle='#141c22';
    x.beginPath();x.ellipse(dx,dy,s*1.2,s*.3,0,0,TAU);x.fill();x.beginPath();x.moveTo(dx+s,dy);x.quadraticCurveTo(dx+s*1.5,dy-s*.5,dx+s*1.9,dy-s*.4);x.lineTo(dx+s*1.6,dy);x.fill();
    x.beginPath();x.moveTo(dx-s*1.1,dy);x.quadraticCurveTo(dx-s*2,dy+s*.3,dx-s*2.6,dy-s*.1);x.lineTo(dx-s*2.3,dy+s*.1);x.lineTo(dx-s*1,dy+s*.15);x.fill();
    x.beginPath();x.moveTo(dx-s*.4,dy);x.lineTo(dx-s*1.2,dy-s*2*f);x.lineTo(dx+s*.2,dy-s*1.4*f);x.lineTo(dx+s*.5,dy);x.fill();
    SC.vignette(x,W,H,.45);SC.fadeIn(x,W,H,t)}});

addTheme('project',{id:'pixel',name:'8-Bit Platformer',song:'Super Mario Bros. soundtrack',pal:['#5aa0f0','#9ad0ff','#6ad06a','#f0c04a','#ff6a8a'],
  init(W,H){return {}},
  draw(x,W,H,t,S){x.imageSmoothingEnabled=false;const P=Math.max(3,Math.round(H/90)),cols=Math.ceil(W/P),rows=Math.ceil(H/P),scroll=t*14;
    x.fillStyle='#6aa8f0';x.fillRect(0,0,W,H);
    const px=(cx,cy,c)=>{x.fillStyle=c;x.fillRect(Math.round(cx)*P,Math.round(cy)*P,P,P)};
    for(let i=0;i<4;i++){const cx=((i*40-scroll*.3)%(cols+40)+cols+40)%(cols+40)-20,cy=10+i%2*8;for(let a=0;a<12;a++)for(let b=0;b<4;b++)if((a>1&&a<10)||b>0&&b<3)px(cx+a,cy+b,b===3?'#d8ecff':'#fff')}
    for(let i=0;i<5;i++){const hx=((i*55-scroll*.5)%(cols+60)+cols+60)%(cols+60)-30,hy=rows-12;for(let a=-14;a<=14;a++){const hh=Math.round(10*Math.cos(a/14*Math.PI/2));for(let b=0;b<hh;b++)px(hx+a,hy-b,b===hh-1?'#4ab04a':'#3a9a5a')}}
    const ground=rows-10;for(let c=0;c<=cols;c++)for(let r=ground;r<rows;r++){const wc=c+Math.floor(scroll);px(c-(scroll%1),r,r===ground?'#5ad04a':((wc+r)%4===0?'#a0603a':'#c07a40'))}
    const plats=[[30,ground-12,8],[55,ground-20,6],[80,ground-14,10],[110,ground-22,7]];
    plats.forEach(([pxw,py,len])=>{const bx=((pxw-scroll)%140+140)%140-10;for(let a=0;a<len;a++){px(bx+a,py,'#c86a3a');px(bx+a,py+1,'#a0502a')}
      const gx=bx+len/2,gy=py-3-Math.abs(Math.sin(t*3+pxw))*1.2,sw=Math.abs(Math.cos(t*4+pxw));for(let k=-1;k<=1;k++)px(gx+k*sw,gy,'#4af0f0');px(gx,gy-1,'#c0ffff');px(gx,gy+1,'#2ab0c0')});
    // the hero: a small original robot that runs and jumps
    const hx=Math.round(cols*.3),jump=Math.max(0,Math.sin(t*2.2))*10,hy=ground-1-Math.round(jump),leg=Math.floor(t*8)%2;
    const R=[[0,-8,'#ffe060'],[0,-7,'#888'],[-2,-6,'#3ad0c0'],[-1,-6,'#3ad0c0'],[0,-6,'#3ad0c0'],[1,-6,'#3ad0c0'],[2,-6,'#3ad0c0'],[-2,-5,'#3ad0c0'],[-1,-5,'#102030'],[0,-5,'#3ad0c0'],[1,-5,'#102030'],[2,-5,'#3ad0c0'],[-2,-4,'#2ab0a0'],[-1,-4,'#2ab0a0'],[0,-4,'#2ab0a0'],[1,-4,'#2ab0a0'],[2,-4,'#2ab0a0'],
      [-2,-3,'#f06a8a'],[-1,-3,'#f06a8a'],[0,-3,'#f06a8a'],[1,-3,'#f06a8a'],[2,-3,'#f06a8a'],[-3,-3,'#3ad0c0'],[3,-3,'#3ad0c0'],[-2,-2,'#f06a8a'],[-1,-2,'#ffe060'],[0,-2,'#f06a8a'],[1,-2,'#f06a8a'],[2,-2,'#f06a8a'],[-1,-1,'#444'],[1,-1,'#444'],[leg?-2:-1,0,'#222'],[leg?2:1,0,'#222']];
    R.forEach(([dx,dy,c])=>px(hx+dx,hy+dy,c));
    for(let i=0;i<6;i++){const cx=((i*23+10-scroll)%140+140)%140,cy=ground-6-(i%2)*4;if(Math.abs(cx-hx)<2&&jump>2)continue;px(cx,cy,(Math.floor(t*6+i)%2)?'#ffd84a':'#fff0a0')}
    x.imageSmoothingEnabled=true;SC.fadeIn(x,W,H,t,.6)}});

addTheme('project',{id:'themepark',name:'Theme Park Fireworks',song:'Disney World park music',pal:['#140c2a','#3a1a5a','#ff6ad0','#5ad0ff','#ffd04a'],
  init(W,H){const r=SC.mk(191);return {fw:[],r,next:0,st:SC.starsInit(r,90)}},
  draw(x,W,H,t,S){const {grad,glow,TAU}=SC;grad(x,W,H,[[0,'#0e0820'],[.7,'#2a1448'],[1,'#3a1a40']]);SC.drawStars(x,S.st,W,H,t,.6,.5);
    if(t>S.next){S.next=t+.5+S.r()*.7;S.fw.push({x:.15+S.r()*.7,y:.15+S.r()*.3,t0:t,c:['#ff6ad0','#5ad0ff','#ffd04a','#9aff6a','#ff8a4a'][Math.floor(S.r()*5)]})}
    x.globalCompositeOperation='lighter';S.fw=S.fw.filter(f=>t-f.t0<2.2);for(const f of S.fw){const k=(t-f.t0)/2.2,r=H*.18*Math.sqrt(k);for(let i=0;i<36;i++){const a=i/36*TAU,xx=f.x*W+Math.cos(a)*r,yy=f.y*H+Math.sin(a)*r+k*k*H*.06;x.globalAlpha=1-k;x.fillStyle=f.c;x.fillRect(xx,yy,W/500+1,W/500+1)}glow(x,f.x*W,f.y*H,r*.6,f.c,.15*(1-k))}x.globalAlpha=1;x.globalCompositeOperation='source-over';
    const cx=W*.72,cy=H*.6,R=H*.24;x.strokeStyle='#1a1030';x.lineWidth=W*.006;x.beginPath();x.moveTo(cx-R*.6,H*.92);x.lineTo(cx,cy);x.lineTo(cx+R*.6,H*.92);x.stroke();x.strokeStyle='rgba(255,220,160,.5)';x.lineWidth=W*.002;x.beginPath();x.arc(cx,cy,R,0,TAU);x.stroke();
    for(let i=0;i<12;i++){const a=i/12*TAU+t*.25;x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+Math.cos(a)*R,cy+Math.sin(a)*R);x.stroke();const c=['#ff6ad0','#5ad0ff','#ffd04a'][i%3];glow(x,cx+Math.cos(a)*R,cy+Math.sin(a)*R,W*.012,c);x.fillStyle=c;x.fillRect(cx+Math.cos(a)*R-W*.008,cy+Math.sin(a)*R,W*.016,H*.02)}
    x.strokeStyle='#1a1030';x.lineWidth=W*.004;x.beginPath();for(let i=0;i<=60;i++){const u=i/60,xx=W*(.02+u*.5),yy=H*(.8-.25*Math.sin(u*Math.PI*2.2)*(1-u*.4));i?x.lineTo(xx,yy):x.moveTo(xx,yy)}x.stroke();
    for(let i=0;i<10;i++)x.fillRect(W*(.03+i*.05),H*.82,W*.003,H*.1);
    const ck=(t*.18)%1,u=ck,xx=W*(.02+u*.5),yy=H*(.8-.25*Math.sin(u*Math.PI*2.2)*(1-u*.4));x.fillStyle='#ffd04a';x.fillRect(xx-W*.012,yy-H*.025,W*.024,H*.02);
    x.fillStyle='#0a0614';x.fillRect(0,H*.92,W,H*.08);for(let i=0;i<30;i++){x.fillStyle=['#ff6ad0','#5ad0ff','#ffd04a'][i%3];x.globalAlpha=.5+.5*Math.sin(t*4+i);x.fillRect(i/30*W,H*.92,W*.01,H*.006)}x.globalAlpha=1;
    SC.vignette(x,W,H,.4);SC.fadeIn(x,W,H,t)}});

addTheme('project',{id:'spacefight',name:'Space Dogfight',song:'Star Wars soundtrack',pal:['#05060f','#121a3a','#ff7a3a','#3ad0ff','#a06aff'],
  init(W,H){const r=SC.mk(203);return {st:Array.from({length:220},()=>({x:r()*2-1,y:r()*2-1,z:r()})),r,bolts:[],booms:[],nb:0}},
  draw(x,W,H,t,S){const {glow,TAU}=SC;x.fillStyle='#04050c';x.fillRect(0,0,W,H);const cx=W/2,cy=H/2;
    for(const s of S.st){s.z-=.004;if(s.z<=.02){s.z=1;s.x=S.r()*2-1;s.y=S.r()*2-1}const k=1/s.z,xx=cx+s.x*W*.5*k*.3,yy=cy+s.y*H*.5*k*.3;if(xx<0||xx>W||yy<0||yy>H)continue;x.fillStyle=`rgba(255,255,255,${Math.min(1,(1-s.z)*1.3)})`;x.fillRect(xx,yy,1+(1-s.z)*2,1+(1-s.z)*2)}
    const pg=x.createRadialGradient(W*.82,H*.78,0,W*.82,H*.78,H*.4);pg.addColorStop(0,'#7a4aa0');pg.addColorStop(.8,'#2a1a4a');pg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=pg;x.beginPath();x.arc(W*.82,H*.78,H*.38,0,TAU);x.fill();
    // original ships: an orange arrowhead chased by two blue crescent fighters
    const hero=[W*(.45+.2*Math.sin(t*.7)),H*(.45+.15*Math.sin(t*1.1))],ha=Math.atan2(Math.cos(t*1.1)*.15*H*1.1,Math.cos(t*.7)*.2*W*.7);
    const arrow=(px,py,a,s)=>{x.save();x.translate(px,py);x.rotate(a);x.fillStyle='#ff8a3a';x.beginPath();x.moveTo(s,0);x.lineTo(-s*.7,-s*.6);x.lineTo(-s*.4,0);x.lineTo(-s*.7,s*.6);x.closePath();x.fill();x.fillStyle='#ffe0b0';x.fillRect(-s*.1,-s*.1,s*.4,s*.2);glow(x,-s*.6,0,s*.6,'rgba(120,200,255,.9)');x.restore()};
    const cres=(px,py,a,s)=>{x.save();x.translate(px,py);x.rotate(a);x.fillStyle='#3ab0ff';x.beginPath();x.arc(0,0,s,-1.2,1.2);x.arc(-s*.45,0,s*.75,1.1,-1.1,true);x.fill();x.fillStyle='#dff4ff';x.beginPath();x.arc(s*.25,0,s*.18,0,TAU);x.fill();glow(x,-s*.5,0,s*.5,'rgba(160,110,255,.8)');x.restore()};
    arrow(hero[0],hero[1],ha,H*.05);
    const ch=[[hero[0]-W*.22-W*.03*Math.sin(t*1.3),hero[1]+H*.1*Math.sin(t*.9)],[hero[0]-W*.3,hero[1]-H*.12+H*.08*Math.cos(t*1.2)]];ch.forEach(([px,py])=>cres(px,py,Math.atan2(hero[1]-py,hero[0]-px),H*.04));
    if(t>S.nb){S.nb=t+.25+S.r()*.3;const c=ch[Math.floor(S.r()*2)];S.bolts.push({x:c[0],y:c[1],a:Math.atan2(hero[1]-c[1],hero[0]-c[0])+(S.r()-.5)*.2,t0:t,c:'#7affb0'});if(S.r()<.5)S.bolts.push({x:hero[0],y:hero[1],a:ha+Math.PI+(S.r()-.5)*.3,t0:t,c:'#ff6a6a'})}
    S.bolts=S.bolts.filter(b=>t-b.t0<1);for(const b of S.bolts){const k=(t-b.t0)*W*.9,bx=b.x+Math.cos(b.a)*k,by=b.y+Math.sin(b.a)*k;x.strokeStyle=b.c;x.lineWidth=H*.006;x.beginPath();x.moveTo(bx,by);x.lineTo(bx-Math.cos(b.a)*W*.04,by-Math.sin(b.a)*W*.04);x.stroke();glow(x,bx,by,H*.02,b.c,.6)}
    const bk=t%5;if(bk<.8){const k=bk/.8;glow(x,W*.25,H*.25,H*.15*k+H*.02,`rgba(255,190,90,${1-k})`)}
    SC.vignette(x,W,H,.5);SC.fadeIn(x,W,H,t)}});

addTheme('project',{id:'icepalace',name:'Ice Crystal Palace',song:'Frozen soundtrack',pal:['#0a1a3a','#1a3a6a','#9ae0ff','#5a7aff','#e0f6ff'],
  init(W,H){const r=SC.mk(217);return {st:SC.starsInit(r,140),sn:Array.from({length:140},()=>({x:r(),y:r(),v:.02+r()*.04,s:r(),p:r()*6})),sp:[[.5,.62,.5],[.38,.46,.32],[.62,.46,.32],[.28,.32,.2],[.72,.32,.2],[.45,.36,.38],[.55,.36,.38]]}},
  draw(x,W,H,t,S){const {grad,glow}=SC;grad(x,W,H,[[0,'#060d24'],[.6,'#15306a'],[1,'#2a5a9a']]);SC.drawStars(x,S.st,W,H,t,.55);
    x.globalCompositeOperation='lighter';for(let i=0;i<=60;i++){const u=i/60,yy=H*(.12+.06*Math.sin(u*6+t*.4)),h=H*.18;const g=x.createLinearGradient(0,yy,0,yy+h);g.addColorStop(0,'rgba(120,200,255,0)');g.addColorStop(.4,'rgba(140,220,255,.16)');g.addColorStop(1,'rgba(120,200,255,0)');x.fillStyle=g;x.fillRect(u*W,yy,W/60+1,h)}x.globalCompositeOperation='source-over';
    x.fillStyle='#cfe6f6';x.beginPath();x.moveTo(0,H*.82);x.quadraticCurveTo(W*.5,H*.74,W,H*.82);x.lineTo(W,H);x.lineTo(0,H);x.fill();
    glow(x,W*.5,H*.55,H*.45,'rgba(150,220,255,.4)');
    S.sp.slice().sort((a,b)=>a[2]-b[2]).forEach(([sx,base,h],i)=>{const bx=sx*W,by=H*base+H*.3,top=by-h*H,w=W*.04*(h+.4);const g=x.createLinearGradient(bx-w,0,bx+w,0);g.addColorStop(0,'#7ab8e8');g.addColorStop(.5,'#e8f8ff');g.addColorStop(1,'#5a90d0');x.fillStyle=g;
      x.beginPath();x.moveTo(bx,top);x.lineTo(bx+w,by-h*H*.25);x.lineTo(bx+w*.8,by);x.lineTo(bx-w*.8,by);x.lineTo(bx-w,by-h*H*.25);x.closePath();x.fill();
      x.strokeStyle='rgba(255,255,255,.6)';x.lineWidth=1;x.beginPath();x.moveTo(bx,top);x.lineTo(bx,by);x.stroke();const sh=(t*.5+i*.3)%2;if(sh<1){x.fillStyle=`rgba(255,255,255,${.6*(1-Math.abs(sh-.5)*2)})`;x.fillRect(bx-w,top+(by-top)*sh,w*2,H*.01)}});
    for(const s of S.sn){const xx=((s.x+Math.sin(t*.8+s.p)*.02)%1)*W,yy=((s.y+t*s.v)%1)*H;x.fillStyle='rgba(255,255,255,.85)';x.fillRect(xx,yy,W/700*(1+s.s*2),W/700*(1+s.s*2))}
    SC.vignette(x,W,H,.45);SC.fadeIn(x,W,H,t)}});

/* ===== channel guide + teach back looks ===== */
const MENU_THEME={id:'menu',name:'Channel Guide',song:"Breakfast at Tiffany's soundtrack · The Entertainer",pal:['#3a3226','#1a1610','#c9a86a','#7a6a4a','#e8d8b0'],grain:true};
const TB_THEME={id:'tb',name:'Intermission',song:"Let's All Go to the Lobby",pal:['#2a2a2a','#0a0a0a','#8a8a8a','#5a5a5a','#c0c0c0'],grain:true,
  draw(x,W,H,t){// classic color bars, a stand-by card, film grain and flicker
    const bars=['#c0c0c0','#c0c000','#00c0c0','#00c000','#c000c0','#c00000','#0000c0'];bars.forEach((c,i)=>{x.fillStyle=c;x.fillRect(i*W/7,0,W/7+1,H*.68)});
    const lo=['#0000c0','#131313','#c000c0','#131313','#00c0c0','#131313','#c0c0c0'];lo.forEach((c,i)=>{x.fillStyle=c;x.fillRect(i*W/7,H*.68,W/7+1,H*.08)});
    x.fillStyle='#1a1a1a';x.fillRect(0,H*.76,W,H*.24);for(let i=0;i<4;i++){x.fillStyle=['#00214c','#fff','#32006a','#131313'][i];x.fillRect(i*W/6,H*.76,W/6,H*.24)}
    for(let i=0;i<W*H/120;i++){x.fillStyle=`rgba(${Math.random()<.5?0:255},${Math.random()<.5?0:255},${Math.random()<.5?0:255},.06)`;x.fillRect(Math.random()*W,Math.random()*H,2,2)}
    if(Math.random()<.1){x.fillStyle='rgba(255,255,255,.08)';x.fillRect(0,0,W,H)}
    const y=(t*.3%1)*H;x.fillStyle='rgba(255,255,255,.05)';x.fillRect(0,y,W,H*.06)}};
