from pathlib import Path
import subprocess,re
root=Path(__file__).resolve().parents[1]
source=(root/'js/live-drawer.js').read_text(encoding='utf-8')
check="""
try {
 const assert=(v,m)=>{if(!v)throw Error(m)};
 ensureMarkup();
 openLightbox('', ['missing-one.jpg','missing-two.jpg','missing-three.jpg'],0);
 moveLightbox(1);
 assert(lightboxIndex===1 && lightboxImage.getAttribute('src')==='missing-two.jpg','immediate advance before load');
 for(let i=0;i<10;i++)moveLightbox(1);
 assert(lightboxIndex===2,'rapid clicks all counted');
 assert(lightbox.querySelectorAll('img.shared-live-active').length===1,'one selected image');
 assert(getComputedStyle(lightboxImage).transitionDuration.includes('0.3s'),'timeline fade');
 assert(lightbox.querySelector('.shared-live-counter-num').textContent.includes('3 / 3'),'immediate counter');
 lightboxImage.click();
 assert(lightbox.classList.contains('shared-live-active'),'image stays open');
 closeLightbox();
 openLightbox('', ['missing-one.jpg','missing-two.jpg'],0);
 assert(lightbox.querySelectorAll('img').length===2,'reopen clears previous group');
 document.body.dataset.testResult='PASS';
} catch(e){document.body.dataset.testResult='FAIL: '+e.stack;}
"""
source=source.replace('})(window);',check+'})(window);')
page=root/'.tmp/live-transition-check.html'
page.write_text('<link rel="stylesheet" href="../css/live-drawer.css"><body><script>'+source+'</script>',encoding='utf-8')
try:
 result=subprocess.run(['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','--headless=new','--disable-gpu','--no-first-run','--dump-dom','--virtual-time-budget=2000','--user-data-dir='+str(root/'.tmp/live-transition-browser'),page.as_uri()],capture_output=True,timeout=40,creationflags=subprocess.CREATE_NO_WINDOW)
 matches=re.findall(r'data-test-result="([^\"]+)"',result.stdout.decode('utf-8',errors='replace'))
 print(matches)
 assert matches==['PASS']
finally: page.unlink(missing_ok=True)
