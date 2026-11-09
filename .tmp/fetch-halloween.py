from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import requests,json,re
P=Path('.tmp/halloween');P.mkdir(exist_ok=True)
urls={
 'event-search':'https://api.bilibili.com/x/tribee/v1/search/all?tribee_id=76&key_word=HalloweenSnap&page_num=1&page_size=30&need_meta=true&type=1&order=0',
}
def fetch(kv):
 k,u=kv
 try:
  r=requests.get(u,headers={'User-Agent':'Mozilla/5.0','Referer':'https://www.bilibili.com/'},timeout=40);r.encoding='utf-8';(P/(k+'.txt')).write_text(r.text,encoding='utf-8');return k,r.status_code,len(r.content)
 except Exception as e:return k,str(e)
with ThreadPoolExecutor(max_workers=4) as pool:
 for x in pool.map(fetch,urls.items()):print(x)
