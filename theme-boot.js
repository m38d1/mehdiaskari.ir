/* theme-boot.js — runs synchronously in <head>, before the first paint.
 *
 * The saved choice wins; otherwise follow the system preference. Without this
 * every page painted the hard-coded dark default first and then flipped to
 * light (FOUC), and a theme the visitor had chosen was forgotten on the very
 * next navigation.
 */
(function () {
  var t;
  try { t = localStorage.getItem('theme'); } catch (e) {}
  if (t !== 'light' && t !== 'dark') {
    t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches)
      ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', t);
  window.__theme = t;
})();
