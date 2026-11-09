from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import requests,json
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'.tmp/ournotes-source'
BASE='https://haneoka.org/assets/intl/Assets/AddressableResources/'
REL='?release=r-ad5704b423dc19cd33bd'
items=[
 ('活动主视觉','https://i0.hdslb.com/bfs/new_dyn/e49b5cb820a1615ec9cad40f432f9cee3706946530052970.jpg'),
 ('「光辉殿堂的不朽篇章」招募主视觉','https://i2.hdslb.com/bfs/archive/2ffbdbfdff4dde383a34cad7b8c7cb770f832c4c.jpg'),
 ('招募成员 SSR Mortis「辉煌的步伐」',BASE+'MemberCard/76/member_full(zh-Hans).png'+REL),
 ('招募成员 SSR Amoris「自王座俯瞰」',BASE+'MemberCard/77/member_full(zh-Hans).png'+REL),
 ('招募留影 SSR Mortis「空洞的眼眸」',BASE+'SupportCard/78/snap_full(zh-Hans).png'+REL),
 ('招募留影 SSR Oblivionis「月啊，请赐予怜悯之光」',BASE+'SupportCard/79/snap_full(zh-Hans).png'+REL),
 ('活动奖励成员 SR Doloris「单膝跪地，献上忠诚」',BASE+'MemberCard/78/member_full(zh-Hans).png'+REL),
 ('活动兑换留影 SR 海铃＆若麦「过近的距离」',BASE+'SupportCard/80/snap_full(zh-Hans).png'+REL),
]
def download(pair):
 i,(caption,url)=pair
 path=ROOT/'images'/f'月色之下流转之舞-{i:02}.webp'
 if path.exists(): raise FileExistsError(path)
 r=requests.get(url,headers={'User-Agent':'Mozilla/5.0'},timeout=60);r.raise_for_status()
 im=Image.open(BytesIO(r.content)); im.load()
 if min(im.size)<400: raise ValueError(f'Unexpected thumbnail: {im.size}')
 im.save(path,'WEBP',quality=94,method=6)
 return {'src':path.relative_to(ROOT).as_posix(),'caption':caption,'source':url,'size':im.size}
with ThreadPoolExecutor(max_workers=4) as pool:
 result=list(pool.map(download,enumerate(items,1)))
(P/'images.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
for x in result: print(x['src'],x['size'])
