/* Shared viewport-image gestures. Loaded once on each site entry page. */
(function () {
  "use strict";
  const selector = '.shared-interview-lightbox, .shared-live-kv-lightbox, #tlLightbox, #lightbox';
  const attached = new WeakSet();
  function attach(box) {
    if (attached.has(box)) return;
    attached.add(box);
    let img, baseTransform = '', scale = 1, x = 0, y = 0, bounds;
    let suppressUntil = 0, moved = false, pinched = false;
    const points = new Map();
    function draw() {
      if (!img || !bounds) return;
      const maxX = Math.max(0, (bounds.width * scale - box.clientWidth) / 2);
      const maxY = Math.max(0, (bounds.height * scale - box.clientHeight) / 2);
      x = Math.max(-maxX, Math.min(maxX, x));
      y = Math.max(-maxY, Math.min(maxY, y));
      img.style.transform = baseTransform + ' translate(' + x + 'px,' + y + 'px) scale(' + scale + ')';
      img.style.cursor = scale > 1 ? 'grab' : 'default';
      box.dataset.imageZoomed = scale > 1 ? 'true' : 'false';

    }
    function reset() {
      scale = 1; x = y = 0;
      if (img) {
        img.style.removeProperty('transform');
        baseTransform = getComputedStyle(img).transform;
        if (baseTransform === 'none') baseTransform = '';
        bounds = img.getBoundingClientRect();
      }
      draw();
    }
    function sync() {
      const open = box.classList.contains('active') || box.classList.contains('shared-live-active');
      const next = open ? box.querySelector('img.active:not([hidden]), img.shared-live-active:not([hidden])') : null;
      if (next === img) return;
      if (img) { img.style.removeProperty('transform'); img.style.cursor = ''; }
      img = next; points.clear();
      box.dataset.imageZoomed = 'false';
      if (img) {
        baseTransform = getComputedStyle(img).transform;
        if (baseTransform === 'none') baseTransform = '';
        reset();
      }
    }
    function zoom(value, cx, cy) {
      if (!img || !bounds) return;
      const next = Math.max(1, Math.min(5, value));
      const ratio = next / scale;
      x = (cx - bounds.left - bounds.width / 2) * (1 - ratio) + x * ratio;
      y = (cy - bounds.top - bounds.height / 2) * (1 - ratio) + y * ratio;
      scale = next; draw();
    }
    box.addEventListener('wheel', e => {
      if (!img || e.target.closest('button, a')) return;
      e.preventDefault(); e.stopPropagation();
      zoom(scale * Math.exp(-e.deltaY * 0.002), e.clientX, e.clientY);
    }, { passive: false });
    function pair() {
      const a = Array.from(points.values());
      return { x: (a[0].x+a[1].x)/2, y: (a[0].y+a[1].y)/2, d: Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y) };
    }
    box.addEventListener('pointerdown', e => {
      if (!img || e.target.closest('button, a') || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if (!points.size) { moved = false; pinched = false; }
      points.set(e.pointerId, { x:e.clientX, y:e.clientY });
      if (points.size > 1) pinched = true;
      // Capture on the image so a stationary click remains an image click.
      // Capturing on the backdrop would make Live interpret it as a close.
      if (e.target === img) img.setPointerCapture(e.pointerId);
    });
    box.addEventListener('pointermove', e => {
      const old = points.get(e.pointerId);
      if (!old) return;
      const before = points.size === 2 ? pair() : null;
      points.set(e.pointerId, { x:e.clientX, y:e.clientY });
      if (before) {
        const after = pair();
        if (before.d > 0) zoom(scale * after.d / before.d, before.x, before.y);
        x += after.x-before.x; y += after.y-before.y; draw(); moved = true;
      } else if (scale > 1) {
        x += e.clientX-old.x; y += e.clientY-old.y; draw();
        if (Math.abs(e.clientX-old.x)+Math.abs(e.clientY-old.y) > 2) moved = true;
      }
      if (moved) suppressUntil = performance.now()+500;
    });
    function end(e) {
      points.delete(e.pointerId);
      if (moved || pinched) suppressUntil = performance.now()+500;
    }
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
    box.addEventListener('lostpointercapture', end);
    box.addEventListener('dragstart', e => { if (e.target === img) e.preventDefault(); });
    box.addEventListener('click', e => {
      if (!e.target.closest('button, a') && performance.now() < suppressUntil) {
        e.preventDefault(); e.stopImmediatePropagation();
      }
    }, true);
    ['touchstart', 'touchend'].forEach(type => box.addEventListener(type, e => {
      if (scale > 1 || pinched || e.touches.length > 1) e.stopImmediatePropagation();
    }, { capture:true, passive:true }));
    box.addEventListener('load', e => { if (e.target === img) reset(); }, true);
    window.addEventListener('resize', reset);
    new MutationObserver(sync).observe(box, { subtree:true, childList:true, attributes:true, attributeFilter:['class','hidden','src'] });
    sync();
  }
  function scan() { document.querySelectorAll(selector).forEach(attach); }
  const style = document.createElement('style');
  style.textContent = `${selector} { overflow:hidden; touch-action:none; }
    ${selector.split(', ').map(s=>s+' img').join(',')} { user-select:none; }`;
  document.head.appendChild(style);
  new MutationObserver(scan).observe(document.body, { childList:true, subtree:true });
  scan();
})();
