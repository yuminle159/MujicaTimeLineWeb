from pathlib import Path
from html.parser import HTMLParser
import re,json
P=Path('.tmp/halloween')
class H(HTMLParser):
 def handle_starttag(self,t,a):
  a=dict(a); u=a.get('src',a.get('href',''))
  if any(s in u for s in ['event_top','member_full','snap_full']):print(u)
for n in ['search2','space','reward','event']:
 p=P/(n+'.txt')
 if not p.exists():continue
 t=p.read_text(encoding='utf-8');print('\n',n)
 if n=='event': H().feed(t);continue
 if n=='reward':
  d=json.loads(t); print(json.dumps(d.get('data',{}).get('item',{}).get('modules',{}).get('module_dynamic'),ensure_ascii=False));continue
 for m in re.finditer('晦冥',t): print(t[max(0,m.start()-350):m.start()+700])
 print('BVs',sorted(set(re.findall(r'BV[0-9A-Za-z]{10}',t))))
