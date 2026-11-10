/* The power-on screen appears on every page load, including an auth reload. */
(() => {
 const home = $('tv-home');
 function showHome() {
  stopCut(); document.body.classList.add('tv-home-active'); home.hidden = false;
  $('tv-home-start').focus({preventScroll:true});
 }
 $('tv-home-start').onclick = () => {
  document.body.classList.remove('tv-home-active'); home.hidden = true;
  openGuide(); $('btn-menu').focus({preventScroll:true});
 };
 showHome();
})();
