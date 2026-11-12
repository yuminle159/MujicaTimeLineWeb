// Load fonts without blocking rendering; fall back once on network errors or timeout.
(() => {
  'use strict';
  const url = document.currentScript.dataset.fontUrl;
  if (!url) return;
  let mirror = false;
  let timer;
  let link;
  const fallback = () => {
    if (mirror) return;
    mirror = true;
    clearTimeout(timer);
    if (link) link.remove();
    load(url.replace('https://fonts.googleapis.com/', 'https://fonts.font.im/'));
  };
  function load(href) {
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onerror = fallback;
    link.onload = () => {
      if (mirror || !document.fonts) return;
      // Wait for layout to request the font faces actually used on this page.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        document.fonts.ready.then(() => {
          if (mirror) return;
          const failed = Array.from(document.fonts).some(face => face.status === 'error');
          if (failed) fallback();
          else clearTimeout(timer);
        });
      }));
    };
    document.head.appendChild(link);
  }
  if (document.fonts) document.fonts.addEventListener('loadingerror', fallback);
  timer = setTimeout(fallback, 3500);
  load(url);
})();
