from pathlib import Path
import subprocess
import re

root = Path(__file__).resolve().parents[1]
html = (root / 'gallery/index.html').read_text(encoding='utf-8')
html = html.replace('<head>', '<head><base href="' + (root / 'gallery').as_uri() + '/">')
check = r'''
<script>
try {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const click = value => document.querySelector('[data-filter="' + value + '"]').click();
  const visible = () => [...document.querySelectorAll('.masonry-item:not(.hidden)')];
  const tags = card => JSON.parse(card.dataset.tags);
  assert(galleryData.length === 984, 'image count');
  assert(new Set(galleryData.map(x => x.filename)).size === 984, 'duplicate images');
  assert(visible().length === 984, 'initial render');
  click('类型:Live返图');
  assert(visible().length > 0 && visible().every(c => tags(c)['类型'].includes('Live返图')), 'type filter');
  click('LIVE:0th');
  assert(visible().length === 9, 'cross dimension intersection');
  click('类型:主视觉');
  assert(visible().length === 10, 'same dimension union');
  click('类型:主视觉');
  assert(visible().length === 9, 'toggle off');
  click('LIVE');
  assert(visible().length > 9, 'clear category');
  click('all');
  assert(visible().length === 984, 'clear all');
  const input = document.getElementById('gallerySearchInput');
  input.value = 'no-results-123456789';
  input.dispatchEvent(new Event('input'));
  assert(visible().length === 0, 'search and empty state');
  input.value = ''; input.dispatchEvent(new Event('input'));
  assert(visible().length === 984, 'restore search');
  assert(document.documentElement.scrollWidth <= window.innerWidth, 'horizontal overflow');
  document.body.dataset.testResult = 'PASS';
} catch (e) { document.body.dataset.testResult = 'FAIL: ' + e.message; }
</script>
'''
html = html.replace('</body>', check + '</body>')
page = root / '.tmp/gallery-check.html'
page.write_text(html, encoding='utf-8')
command = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '--headless=new',
           '--disable-gpu', '--no-first-run', '--disable-extensions', '--dump-dom',
           '--virtual-time-budget=1000', '--window-size=390,844',
           '--user-data-dir=' + str(root / '.tmp/gallery-browser-check'), page.as_uri()]
result = subprocess.run(command, capture_output=True, timeout=40, creationflags=subprocess.CREATE_NO_WINDOW)
output = result.stdout.decode('utf-8', errors='replace')
matches = re.findall(r'data-test-result="([^"]+)"', output)
print(matches or result.stderr.decode('utf-8', errors='replace')[-1500:])
assert matches == ['PASS'], matches
