from pathlib import Path
from html.parser import HTMLParser
import re,json
class H(HTMLParser):
 def handle_starttag(self,t,a):
  a=dict(a)
  for k in ['src','href']:
   u=a.get(k,'')
   if '/assets/' in u and any(s in u for s in ['full','Event/04','Gacha']): print(u)
for n in ['event','gacha','member73','support76','support77']:
 t=(Path('.tmp/halloween')/(n+'.txt')).read_text(encoding='utf-8'); print('\n',n);H().feed(t)
 for needle in ['"name":"无餍','"name":"幽灵','"name":"搬运']:
  i=t.find(needle)
  if i>=0: print(t[i:i+500])
