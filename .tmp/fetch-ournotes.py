from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import requests

OUT = Path(__file__).parent / 'ournotes-source'
OUT.mkdir(exist_ok=True)
URLS = {
 'event-detail': 'https://haneoka.org/intl/zh-CN/events/5/',
 'member76': 'https://haneoka.org/intl/zh-CN/member-cards/76/',
 'opus-mobile': 'https://m.bilibili.com/opus/1267889809823629313',
 'dynamic-detail': 'https://api.bilibili.com/x/polymer/web-dynamic/v1/detail?id=1267889809823629313',
}
def fetch(item):
 name,url=item
 try:
  r=requests.get(url,headers={'User-Agent':'Mozilla/5.0','Referer':'https://www.bilibili.com/'},timeout=40)
  r.encoding='utf-8'
  (OUT/(name+'.txt')).write_text(r.text,encoding='utf-8')
  return name,r.status_code,len(r.content)
 except requests.RequestException as e:
  return name,str(e)
with ThreadPoolExecutor(max_workers=4) as pool:
 for result in pool.map(fetch,URLS.items()): print(result)
