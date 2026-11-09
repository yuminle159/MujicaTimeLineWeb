from pathlib import Path
from copy import copy
import sys,json,shutil
from PIL import Image,ImageOps,ImageDraw
import openpyxl
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import generate_all
from timeline_checks import check_timeline
P=ROOT/'.tmp/halloween'
cards=[('member72','招募成员 SSR 椎名立希「今晚，为魔法所困」'),('member73','招募成员 SSR Doloris「无餍之渴」'),('support75','招募留影 SSR 爽世＆爱音「突然袭击的入镜」'),('support76','招募留影 SSR 海铃＆睦＆若麦「幽灵之眼」'),('member74','活动奖励成员 SR 要乐奈「猫咪们的万圣节」'),('support77','活动兑换留影 SR 睦＆初华「搬运、装饰」')]
items=[('event-official','活动主视觉'),('gacha-cover','「晦冥的夜行者们」招募主视觉')]+cards
sources={n:u for n,size,u in json.loads((P/'downloaded.json').read_text(encoding='utf-8'))}
sources['event-official']=json.loads((P/'event-official.json').read_text(encoding='utf-8'))['data']['item']['modules']['module_dynamic']['major']['draw']['items'][0]['src'].replace('http:','https:')
sources['gacha-cover']=json.loads((P/'video.json').read_text(encoding='utf-8'))['pic'].replace('http:','https:')
media=[]
for i,(n,caption) in enumerate(items,1):
 src=f'images/A day-HalloweenSnap-{i:02}.webp'; target=ROOT/src
 assert not target.exists(),target
 im=Image.open(P/(n+'.webp'));im.load();assert min(im.size)>=1000
 shutil.copy2(P/(n+'.webp'),target)
 media.append(dict(type='image',src=src,caption=caption,source=sources[n],size=im.size))
media.insert(2,dict(type='video',src='https://player.bilibili.com/player.html?bvid=BV1SoxT6qEu4',caption='「晦冥的夜行者们」招募预告'))
title='BanG Dream! Our Notes「A day～#HalloweenSnap～」'
desc=('MyGO!!!!! 与 Ave Mujica 共同登场的万圣节挑战演出活动「A day～#HalloweenSnap～」。\n'
 '活动时间：2026/10/28 11:00 ～ 11/7 13:59（北京时间）。\n'
 '同期招募「晦冥的夜行者们」：2026/10/27 23:00 ～ 11/8 13:59（北京时间）。\n\n'
 '本期登场：招募 SSR 成员 2 张、SSR 留影 2 张；活动奖励 SR 成员 1 张、活动兑换 SR 留影 1 张。')
p=ROOT/'_data/data.xlsx';original=p.read_bytes();wb=openpyxl.load_workbook(p);ws=wb['timeline'];headers=[c.value for c in ws[1]]
for row in ws.iter_rows(min_row=2,values_only=True):
 d=dict(zip(headers,row))
 assert not ('HalloweenSnap' in str(d.get('title')) and d.get('tag')=='game'),'Event already exists'
start=ws.max_row+1;template=ws.max_row
for m in media:
 d=dict(date='2026/10/28',title=title,category='organization',description=desc,tag='game',media_type=m['type'],media_src=m['src'],media_caption=m['caption'])
 ws.append([d.get(h,'') for h in headers])
 for c in ws[ws.max_row]:c._style=copy(ws.cell(template,c.column)._style)
assert not [x for x in check_timeline(ws,ROOT) if x[0]=='ERROR']
backup=P/'data-before.xlsx';assert not backup.exists();backup.write_bytes(original)
stage=P/'data-updated.xlsx';wb.save(stage);wb.close();assert p.read_bytes()==original,'Workbook changed';stage.replace(p)
wb=openpyxl.load_workbook(p,data_only=True);print('Events:',generate_all.generate_timeline(wb));print('Indexes:',generate_all.generate_search_indexes(wb));wb.close()
report=dict(title=title,date='2026/10/28',description=desc,rows=[start,start+len(media)-1],media=media,sources=['https://www.bilibili.com/opus/1263809404088614920','https://www.bilibili.com/video/BV1SoxT6qEu4','https://www.bilibili.com/opus/1263815687603748869','https://haneoka.org/intl/zh-CN/events/4/','https://haneoka.org/intl/zh-CN/gacha/16/'],story_preview='本期没有活动剧情，不添加剧情预告')
(ROOT/'_reports/ournotes-HalloweenSnap.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
sheet=Image.new('RGB',(1200,720),'#ddd');draw=ImageDraw.Draw(sheet)
for i,(n,caption) in enumerate(items):
 sheet.paste(ImageOps.contain(Image.open(P/(n+'.webp')),(292,330)),((i%4)*300,(i//4)*360));draw.text(((i%4)*300+5,(i//4)*360+337),str(i+1),fill='black')
sheet.save(P/'contact.jpg');print('Added',len(media),'media rows')
