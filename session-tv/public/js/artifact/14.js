/* in-screen TV-style calendar for the sprint end date */
function ppCal(start,end){
  const mStr=TV.calM||(end||start).slice(0,7),first=parseDay(mStr+'-01'),y=first.getFullYear(),mo=first.getMonth();
  const days=new Date(y,mo+1,0).getDate(),lead=first.getDay(),today=gdYmd(new Date());
  const minM=start.slice(0,7),canPrev=mStr>minM;
  let cells='';for(let i=0;i<lead;i++)cells+='<span></span>';
  for(let d=1;d<=days;d++){const ds=gdYmd(new Date(y,mo,d));const dis=ds<=start,sel=ds===end,inR=end&&ds>start&&ds<end,isT=ds===today;
    cells+=`<button type="button" class="cal-d${sel?' sel':''}${ds===start?' st':''}${inR?' in':''}${isT?' tod':''}" ${dis?'disabled':`data-cday="${ds}"`} aria-label="${new Date(y,mo,d).toDateString()}"${sel?' aria-pressed="true"':''}>${d}</button>`}
  return `<div class="cal"><div class="cal-h"><button type="button" class="cal-nav" data-cnav="-1" ${canPrev?'':'disabled'} aria-label="Previous month">◀</button><span>${first.toLocaleDateString(undefined,{month:'long',year:'numeric'}).toUpperCase()}</span><button type="button" class="cal-nav" data-cnav="1" aria-label="Next month">▶</button></div>
    <div class="cal-w">${['S','M','T','W','T','F','S'].map(x=>`<span>${x}</span>`).join('')}</div><div class="cal-g">${cells}</div></div>`;
}
