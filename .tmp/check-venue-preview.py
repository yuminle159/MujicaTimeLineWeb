from pathlib import Path
import subprocess, re
root = Path(__file__).resolve().parents[1]
html = (root/'live/index.html').read_text(encoding='utf-8')
html = html.replace('<head>', '<head><base href="'+(root/'live').as_uri()+'/">')
html = html.replace('</body>', '''<script>
setTimeout(async()=>{try {
 await WijipediaData.load('songs');
 openStats();
 await new Promise(resolve=>setTimeout(resolve,500));
 document.querySelector('[data-view="venues"]').click();
 const counts={};
 for(const scope of ['all','one-man','fes','bandori']) {
 document.querySelector('[data-scope="'+scope+'"]').click();
 counts[scope]={metrics:document.querySelector('.va-metrics').textContent,hasFukuoka:!!document.querySelector('[data-list="jp"] [data-venue="fukuoka-dome"]')};
 }
 document.body.dataset.check=JSON.stringify(counts);
}catch(e){document.body.dataset.check=e.stack}},1500);
</script></body>''')
page=root/'.tmp/venue-preview-check.html'
page.write_text(html,encoding='utf-8')
result=subprocess.run(['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','--headless=new','--disable-gpu','--no-first-run','--dump-dom','--virtual-time-budget=6000','--user-data-dir='+str(root/'.tmp/venue-preview-browser'),page.as_uri()],capture_output=True,timeout=45,creationflags=subprocess.CREATE_NO_WINDOW)
(root/'.tmp/venue-preview-result.html').write_bytes(result.stdout)
print(re.findall(r'data-check="([^"]+)"',result.stdout.decode('utf-8',errors='replace')))
print('exit',result.returncode)
