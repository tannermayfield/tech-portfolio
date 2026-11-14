/* Scale the desktop TV from the compact 1280 × 628 layout as one unit. */
(() => {
 function resize() {
  const desktop = innerWidth > 860;
  const scale = desktop ? Math.min(innerWidth / 1280, innerHeight / 628) : 1;
  const style = document.documentElement.style;
  style.setProperty('--tv-scale', String(scale));
    style.setProperty('--tv-vw', desktop ? '12.8px' : '1vw');
    style.setProperty('--tv-vh', desktop ? '6.28px' : '1vh');
  style.setProperty('--tv-left', Math.max(0, (innerWidth - 1280 * scale) / 2) + 'px');
  style.setProperty('--tv-top', Math.max(0, (innerHeight - 628 * scale) / 2) + 'px');
 }
 resize();
 addEventListener('resize', resize);
})();
