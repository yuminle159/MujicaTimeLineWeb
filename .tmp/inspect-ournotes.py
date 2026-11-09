from pathlib import Path
import json,re
from html.parser import HTMLParser
P=Path(__file__).parent/'ournotes-source'
class Links(HTMLParser):
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag in ('img','script'): 
   u=a.get('src','')
   if u: print(tag,u)
for f in P.glob('*video.txt'):
 s=json.JSONDecoder().raw_decode(f.read_text(encoding='utf-8').split('__INITIAL_STATE__=',1)[1])[0]
 d=s.get('videoData',{})
 print(f.name,json.dumps({k:d.get(k) for k in ['title','pic','desc','pubdate','owner','bvid']},ensure_ascii=False))
for name in ['gacha','events','event-detail','member76','member77','opus-mobile','dynamic-detail']:
 f=P/(name+'.txt')
 if not f.exists(): continue
 t=f.read_text(encoding='utf-8')
 print('\nFILE',name)
 print(t[:150] if len(t)<5000 else '')
 if name=='events':
  for term in ['月下','__NUXT__','__NEXT_DATA__','application/json']:
   i=t.find(term); print(term,t[max(0,i-200):i+900])
 else: Links().feed(t)
