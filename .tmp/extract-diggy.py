from pathlib import Path
from lxml import html
import re,base64,sys,json
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from to_webp import optimize_and_convert_to_webp
P=ROOT/'.tmp/diggy';imgs=P/'images';imgs.mkdir(exist_ok=True)
stem='261109Billboard-Diggy-MO前篇'
pages={}
for p in Path('C:/Users/yumin/Downloads').glob('*Diggy*.html'):
 root=html.fromstring(p.read_text(encoding='utf-8'))
 main=root.xpath('//div[@id="maintext"]')[0];n=int(main.getparent().get('id').rsplit('_',1)[1]);assert n not in pages
 pages[n]=(root,main,p.name)
assert sorted(pages)==[1,2,3,4]
banner=pages[1][0].xpath('//*[@id="html_contents_1"]//hgroup//img')[0]
portrait=pages[4][0].xpath('//*[@id="sublinks"]//img[@alt="A写"]')[0]
for i,e in enumerate([banner,portrait],1):
 src=e.get('src');assert src.startswith('data:image/jpeg;base64,')
 (imgs/f'{stem}-{i:02}.jpg').write_bytes(base64.b64decode(src.split(',',1)[1]))
optimize_and_convert_to_webp(str(imgs),max_width=1920,quality=75)
headings={'明確なビジョン':'明确的愿景','ドレッシーにした一番の理由は“シルエット”':'选择华丽礼服风格的首要原因，是“轮廓”','ものづくりに大事な“接続”':'创作中重要的“连接”','人生で肝心なのは自分の中のワクワクと信念':'人生的关键，是内心的兴奋与信念'}
out=['# Ave Mujica 音乐制作人 Diggy-MO’眼中的乐队制作精髓（前篇）', '**访谈时间**：2026/11/09', "**访谈人**：Diggy-MO'", '**出处**：[访谈原地址](https://www.billboard-japan.com/special/detail/5516)','[br]',f'![访谈头图](../images/{stem}-01.webp)','[br]']
buffer=[];counts={};allparas=[]
def flush():
 if buffer:
  out.extend(['（中文）','[original]','\n\n'.join(buffer),'[/original]']);buffer.clear()
for n,(root,main,name) in sorted(pages.items()):
 count=0
 for e in main:
  if e.get('id') in ('pager','sublinks'):break
  text=e.text_content().strip()
  if e.tag=='h5':
   flush();out.extend(['---','## '+headings[text],'[original]',text,'[/original]'])
  elif e.tag=='p' and text and not re.match(r'（[中後]編は',text):
   buffer.append(text);allparas.append(text);count+=1
  elif e.tag=='center' and 'Sophie' in text:
   flush();out.extend(['[br]','[【公式ライブ映像】Ave Mujica「Sophie」（Ave Mujica LIVE TOUR 2026「Exitus」-FINAL- DAY2）](https://www.youtube.com/watch?v=oukE4M554RU)','[br]'])
 counts[n]=count
flush();out.extend(['[br]',f'![Diggy-MO’](../images/{stem}-02.webp)','*Diggy-MO’*','[br]'])
md='\n\n'.join(out)+'\n';target=ROOT/'_data/mc'/f'{stem}.md';assert not target.exists();target.write_text(md,encoding='utf-8')
for p in imgs.glob('*.webp'):
 dest=ROOT/'images'/p.name;assert not dest.exists();dest.write_bytes(p.read_bytes())
assert md.count('[original]')==md.count('[/original]')
assert all(t in md for t in allparas)
assert len(allparas)==len(set(allparas))
audit={'pages':{n:name for n,(_,_,name) in pages.items()},'paragraph_counts':counts,'total_paragraphs':len(allparas),'questions':sum(t.startswith('――') for t in allparas),'images':2,'md':str(target)}
(P/'audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(audit,ensure_ascii=False,indent=2))
