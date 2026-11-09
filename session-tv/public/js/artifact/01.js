(function(){
  const crt=()=>document.getElementById('crt');
  function place(){const c=crt();if(!c)return;const r=c.getBoundingClientRect(),st=document.documentElement.style;
    st.setProperty('--crt-x',r.left+'px');st.setProperty('--crt-y',r.top+'px');st.setProperty('--crt-w',r.width+'px');st.setProperty('--crt-h',r.height+'px')}
  function sync(){const c=crt();if(c)c.classList.toggle('dlg-dim',!!document.querySelector('dialog.confirm-dlg[open]'))}
  const orig=HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal=function(){if(!this.classList.contains('confirm-dlg'))return orig.apply(this,arguments);
    place();{const c=crt();if(c&&this.parentElement!==c)c.insertBefore(this,c.querySelector('#tv-noise')||null)}document.querySelectorAll('dialog.confirm-dlg[open]').forEach(d=>{if(d!==this)d.close()});if(!this.open)this.show();
    const f=this.querySelector('[autofocus]')||this.querySelector('button,input,textarea,select');try{f&&f.focus()}catch(e){}sync()};
  window.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(document.activeElement&&document.activeElement.id==='timer-in')return;const d=[...document.querySelectorAll('dialog.confirm-dlg[open]')].pop();if(!d)return;
    const ev=new Event('cancel',{cancelable:true});if(d.dispatchEvent(ev))d.close();e.preventDefault();e.stopImmediatePropagation()},true);
  /* using a TV control (knob, buttons, timer, radio) closes the on-screen popup first */
  document.addEventListener('pointerdown',e=>{const d=document.querySelector('dialog.confirm-dlg[open]');if(!d||d.contains(e.target))return;
    const c=crt();if(c&&c.contains(e.target)){d.close();return}if(e.target.closest('#knob-main,#knob-sub,#btn-menu,#btn-set,#tv-timer.expired'))d.close()},true);
  document.addEventListener('close',e=>{if(e.target.matches&&e.target.matches('dialog.confirm-dlg'))setTimeout(sync,0)},true);
  addEventListener('resize',place);place();
})();
