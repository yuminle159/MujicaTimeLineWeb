from pathlib import Path
import requests,json
from io import BytesIO
from PIL import Image
P=Path('.tmp/halloween')
for name,id in [('event-official','1263809404088614920'),('reward2','1263815687603748869')]:
 r=requests.get('https://api.bilibili.com/x/polymer/web-dynamic/v1/detail',params={'id':id},headers={'User-Agent':'Mozilla/5.0','Referer':'https://www.bilibili.com/'},timeout=40);r.raise_for_status();d=r.json();assert d['code']==0
 (P/(name+'.json')).write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
 m=d['data']['item']['modules'];assert str(m['module_author']['mid'])=='3706946530052970';print(name,m['module_author']['pub_time'],m['module_dynamic'].get('desc'))
 u=m['module_dynamic']['major']['draw']['items'][0]['src'].replace('http:','https:')
 r=requests.get(u,timeout=40);r.raise_for_status();im=Image.open(BytesIO(r.content));im.save(P/(name+'.webp'),'WEBP',quality=94,method=6);print(u,im.size)
d=json.loads((P/'video.json').read_text(encoding='utf-8'));u=d['pic'].replace('http:','https:');r=requests.get(u,timeout=40);r.raise_for_status();im=Image.open(BytesIO(r.content));im.save(P/'gacha-cover.webp','WEBP',quality=94,method=6);print('cover',im.size)
