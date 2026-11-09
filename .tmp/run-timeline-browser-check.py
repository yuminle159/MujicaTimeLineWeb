import subprocess,re,time
from pathlib import Path
base=[r'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','--headless=new','--disable-gpu','--no-first-run','--disable-background-networking','--virtual-time-budget=12000','--dump-dom']
for name,size in [('desktop','1280,900'),('mobile','500,932')]:
    result=subprocess.run(base+['--user-data-dir=D:/yumin/web/MujicaTimeLineWeb/.tmp/edge-qa-final-'+name+'-'+str(time.time_ns()),'--window-size='+size,'--screenshot=D:/yumin/web/MujicaTimeLineWeb/.tmp/timeline-'+name+'.png','file:///D:/yumin/web/MujicaTimeLineWeb/timeline/.qa-browser-check.html'],capture_output=True,timeout=55)
    Path('.tmp/timeline-browser-'+name+'.html').write_bytes(result.stdout)
    print(name,re.findall(r'<pre id="qa-result">(.*?)</pre>',result.stdout.decode('utf-8'),re.S))
