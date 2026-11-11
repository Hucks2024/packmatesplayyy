/* Packmates landing page: starts the 3D tour (js/tour.js) where <head> decided the browser can draw it,
   and fades the lower sections in as they are scrolled to. Without this file the page still reads fine. */
(() => {
  'use strict';
  const root = document.documentElement;

  if (root.classList.contains('tour')) {
    import('./tour.js?v=1').catch((err) => {
      root.classList.remove('tour', 'tour-ready');
      if (window.console) console.warn('Packmates: the 3D tour is off.', err);
    });
  }

  const items = [...document.querySelectorAll('.reveal')];
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.classList.add('fx');
  const seen = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      seen.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  items.forEach((el, i) => { el.style.setProperty('--i', i % 3); seen.observe(el); });
})();
