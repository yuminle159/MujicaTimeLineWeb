from pathlib import Path
import json
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
html = (root / 'gallery/index.html').read_text(encoding='utf-8')
files = re.findall(r'filename: "([^"]+)"', (root / 'gallery/data.js').read_text(encoding='utf-8'))
fixture = [{'hash_id': f'test{i}', 'filename': files[i % len(files)], 'title': f'item-{i}',
            'tags': {'类型': ['甲' if i % 2 == 0 else '乙'], '人物': ['丙' if i % 3 == 0 else '丁']},
            'date': '2026/10/22', 'description': 'not displayed'} for i in range(61)]
html = re.sub(r'<script src="data.js[^\"]*"></script>', lambda _: '<script>var galleryData = ' + json.dumps(fixture, ensure_ascii=False) + ';</script>', html)
check = r'''
<script>
(async () => {
try {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const key = key => document.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles:true}));
  const touch = (type, x, y) => {
    const event = new Event(type, {bubbles:true});
    event.touches = type === 'touchstart' ? [{clientX:x,clientY:y}] : [];
    event.changedTouches = [{clientX:x,clientY:y}];
    lightboxImg.dispatchEvent(event);
  };
  document.querySelector('.masonry-item').click();
  assert(lightboxItems.length === 61, 'all pages in scope');
  lightboxPrev.click();
  assert(activeItem.hash_id === 'test60', 'previous wraps');
  lightboxNext.click();
  assert(activeItem.hash_id === 'test0', 'next wraps; arrow does not close');
  openLightbox(galleryData[49]);
  key('ArrowRight');
  assert(activeItem.hash_id === 'test50', 'page boundary');
  key('ArrowLeft');
  assert(activeItem.hash_id === 'test49', 'left keyboard');
  key('Escape');
  assert(!lightbox.classList.contains('active'), 'escape close');
  filterBy('类型:甲'); filterBy('人物:丙');
  openLightbox(galleryData[0]);
  assert(lightboxItems.length === 11, 'filter intersection');
  for (let i=0; i<15; i++) {
    moveLightbox(1);
    assert(Number(activeItem.hash_id.slice(4)) % 6 === 0, 'stay in filter');
  }
  const oldIndex = lightboxIndex;
  touch('touchstart', 300, 200); touch('touchend', 100, 205);
  assert(lightboxIndex === (oldIndex+1)%11, 'swipe next');
  key('Tab'); assert(lightbox.contains(document.activeElement), 'focus remains in dialog');
  closeLightbox();
  gallerySearchQuery = 'item-60'; applyGalleryFilters();
  openLightbox(galleryData[60]);
  assert(lightboxItems.length === 1 && lightboxPrev.hidden && lightboxNext.hidden, 'single search result');
  moveLightbox(1); assert(activeItem.hash_id === 'test60', 'single item stays');
  assert(!document.getElementById('lightboxDate') && !document.querySelector('.lightbox-info'), 'no metadata');
  closeLightbox();
  gallerySearchQuery = 'no-results'; applyGalleryFilters();
  assert(filteredGalleryImages().length === 0, 'empty results');
  gallerySearchQuery = ''; filterBy('all');
  const NativeImage = window.Image;
  const requests = [];
  window.Image = class {
    set src(value) { this.url = value; requests.push(this); }
    get src() { return this.url; }
    decode() { return Promise.resolve(); }
  };
  openLightbox(galleryData[0]);
  moveLightbox(1);
  const pending = requests.filter(image => image.onload);
  const selected = lightboxImg;
  assert(!selected.hidden && selected.classList.contains('active'), 'immediate selection while loading');
  await pending[0].onload();
  assert(lightboxImg === selected && selected.alt.includes('2 / 61'), 'ignore late previous image');
  await pending[1].onload();
  assert(!lightboxImg.hidden && lightboxImg.alt.includes('2 / 61'), 'latest image wins');
  pending[1].onerror();
  assert(!lightboxRetry.hidden, 'error retry shown');
  lightboxRetry.click();
  assert(requests.filter(image => image.onload).length === 3 && activeItem.hash_id === 'test1', 'retry keeps position');
  window.Image = NativeImage;
  await new Promise(resolve => setTimeout(resolve, 500));
  lightboxImg.click(); assert(lightbox.classList.contains('active'), 'image click stays');
  lightbox.click(); assert(!lightbox.classList.contains('active'), 'backdrop close');
  openLightbox(galleryData[0]);
  for (let i = 0; i < 30 && !lightboxImg.naturalWidth; i++) await new Promise(resolve => setTimeout(resolve, 100));
  assert(!lightboxImg.hidden && lightboxImg.naturalWidth > 0, 'real image loaded: ' + JSON.stringify({hidden:lightboxImg.hidden, width:lightboxImg.naturalWidth, source:lightboxImg.src, error:lightboxLoadMessage.textContent, active:activeItem.filename}));
  assert(document.documentElement.scrollWidth <= window.innerWidth, 'no mobile overflow');
  const closeRect = lightboxClose.getBoundingClientRect();
  assert(document.elementFromPoint(closeRect.x + closeRect.width / 2, closeRect.y + closeRect.height / 2) === lightboxClose, 'close button is unobstructed');
  assert(!document.querySelector('.lightbox-spinner'), 'no spinner');
  assert(getComputedStyle(lightboxImg).transitionDuration.includes('0.3s'), 'timeline transition');
  document.body.dataset.testResult = 'PASS';
} catch (error) { document.body.dataset.testResult = 'FAIL: ' + error.stack; }
})();
</script>
'''
html = html.replace('</body>', check + '</body>')
page = root / 'gallery/.carousel-check.html'
page.write_text(html, encoding='utf-8')
command = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '--headless=new',
           '--disable-gpu', '--no-first-run', '--disable-extensions', '--dump-dom',
           '--virtual-time-budget=5000', '--window-size=' + (sys.argv[1] if len(sys.argv) > 1 else '1280,900'),
           '--screenshot=' + str(root / '.tmp/gallery-carousel-preview.png'),
           '--user-data-dir=' + str(root / '.tmp/gallery-browser-check'), page.as_uri()]
try:
    result = subprocess.run(command, capture_output=True, timeout=40, creationflags=subprocess.CREATE_NO_WINDOW)
finally:
    page.unlink(missing_ok=True)
matches = re.findall(r'data-test-result="([^"]+)"', result.stdout.decode('utf-8', errors='replace'))
print(matches or result.stderr.decode('utf-8', errors='replace')[-1000:])
assert matches == ['PASS'], matches
