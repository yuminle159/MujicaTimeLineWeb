from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import requests,json
from PIL import Image
P=Path('.tmp/halloween');B='https://haneoka.org/assets/intl/Assets/AddressableResources/';R='?release=r-ad5704b423dc19cd33bd'
items=[
 ('event-banner',B+'Image/Event/04/Banner/event_banner_00004(zh-Hans).png'+R),
 ('gacha-banner',B+'Gacha/Banner/gacha_banner_00016(zh-Hans).png'+R),
 ('member72',B+'MemberCard/72/member_full(zh-Hans).png'+R),
 ('member73',B+'MemberCard/73/member_full(zh-Hans).png'+R),
 ('support75',B+'SupportCard/75/snap_full(zh-Hans).png'+R),
 ('support76',B+'SupportCard/76/snap_full(zh-Hans).png'+R),
 ('member74',B+'MemberCard/74/member_full(zh-Hans).png'+R),
 ('support77',B+'SupportCard/77/snap_full(zh-Hans).png'+R),
 ('reward-poster','https://i0.hdslb.com/bfs/new_dyn/969dd82431ecd0a57efe228f5bc0d6cf3706946530052970.jpg'),
]
def get(kv):
 n,u=kv;r=requests.get(u,timeout=45);r.raise_for_status();im=Image.open(BytesIO(r.content));im.load();im.save(P/(n+'.webp'),'WEBP',quality=94,method=6);return n,im.size,u
with ThreadPoolExecutor(max_workers=4) as pool: result=list(pool.map(get,items))
(P/'downloaded.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
for n,size,u in result: print(n,size)
