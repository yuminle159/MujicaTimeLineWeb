from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[1]
page = root / '.tmp/text-arrows-check.html'
page.write_text(r'''<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="../css/emoji.css">
<script defer src="../js/vendor/twemoji/twemoji.min.js"></script>
<script defer src="../js/emoji.js"></script>
</head><body>
<a id="plain">外链 ↗</a><a id="entity">SOURCE &#8599;</a>
<a id="color">↗️</a><a id="text">↗︎</a>
<span id="native" data-native-emoji>↗ 💖</span>
<p id="mixed">正文 💖 ↗ 🕊</p><code id="code">↗</code>
<script>
window.addEventListener('load', async () => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const wait = () => new Promise(resolve => setTimeout(resolve, 80));
  try {
    for (const id of ['plain','entity','color','text','native']) {
      const node = document.getElementById(id);
      assert(node.textContent.includes('\u2197\ufe0e'), id + ' text presentation');
      assert(!node.querySelector('img'), id + ' no emoji image');
    }
    assert(document.querySelectorAll('#mixed .site-emoji').length === 2, 'other emoji preserved');
    assert(document.getElementById('code').textContent === '↗', 'code untouched');
    const dynamic = document.createElement('a');
    dynamic.textContent = '动态链接 ↗'; document.body.append(dynamic); await wait();
    assert(dynamic.textContent === '动态链接 ↗\ufe0e' && !dynamic.querySelector('img'), 'added links');
    dynamic.firstChild.nodeValue = '改动 ↗️ 💖'; await wait();
    assert(dynamic.textContent.includes('↗\ufe0e') && dynamic.querySelectorAll('img').length === 1, 'text mutations');
    const native = document.createElement('span'); native.setAttribute('data-native-emoji','');
    native.textContent = '↗️ 💖'; document.body.append(native); await wait();
    assert(native.textContent.includes('↗\ufe0e') && !native.querySelector('img'), 'native dynamically added');
    const template = WijipediaEmoji.prepareText('来源 ↗ 💖');
    assert(template.textContent.includes('↗\ufe0e') && template.querySelectorAll('img').length === 1, 'prepared text');
    const applied = document.createElement('div'); document.body.append(applied);
    WijipediaEmoji.applyText(applied, template); await wait();
    assert(applied.textContent.includes('↗\ufe0e') && applied.querySelectorAll('img').length === 1, 'cloned templates');
    assert(!document.querySelector('img[src$="2197.svg"]'), 'no arrow SVG anywhere');
    const before = document.body.querySelectorAll('*').length; await wait();
    assert(document.body.querySelectorAll('*').length === before, 'observer stable');
    document.body.dataset.testResult = 'PASS';
  } catch (error) { document.body.dataset.testResult = 'FAIL: ' + error.stack; }
});
</script></body></html>''', encoding='utf-8')
command = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '--headless=new',
           '--disable-gpu', '--no-first-run', '--disable-extensions', '--dump-dom',
           '--virtual-time-budget=2000', '--user-data-dir=' + str(root / '.tmp/gallery-browser-check'), page.as_uri()]
result = subprocess.run(command, capture_output=True, timeout=40, creationflags=subprocess.CREATE_NO_WINDOW)
matches = re.findall(r'data-test-result="([^"]+)"', result.stdout.decode('utf-8', errors='replace'))
print(matches or result.stderr.decode('utf-8', errors='replace')[-1000:])
assert matches == ['PASS'], matches
