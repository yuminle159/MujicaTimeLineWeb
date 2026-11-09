from pathlib import Path
import sys,json,hashlib,shutil
from copy import copy
import openpyxl
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import generate_all
from timeline_checks import check_timeline

path=ROOT/'_data/data.xlsx'
before=hashlib.sha256(path.read_bytes()).hexdigest()
wb=openpyxl.load_workbook(path)
ws=wb['timeline']; headers=[c.value for c in ws[1]]
title='BanG Dream! Our Notes「月色之下流转之舞」'
for row in ws.iter_rows(min_row=2,values_only=True):
 if any('月色之下流转之舞' in str(v) or '月下流转之舞' in str(v) for v in row):
  raise ValueError('Event already exists: inspect before updating')
description=('挑战演出活动「月色之下流转之舞」。\n'
 '活动时间：2026/11/8 14:00 ～ 11/17 13:59（北京时间）。\n'
 '同期招募「光辉殿堂的不朽篇章」：2026/11/8 14:00 ～ 11/18 13:59（北京时间）。\n\n'
 'Ave Mujica 重新出道后，祥子为下一场假面舞会构思了森林古堡与公主的故事。同一位公主，在不同人眼中却呈现出不同的面貌。\n\n'
 '本期登场：招募 SSR 成员 2 张、SSR 留影 2 张；活动奖励 SR 成员 1 张、活动兑换 SR 留影 1 张。')
images=json.loads((ROOT/'.tmp/ournotes-source/images.json').read_text(encoding='utf-8'))
media=[dict(type='image',**x) for x in images[:2]]+[
 {'type':'video','src':'https://player.bilibili.com/player.html?bvid=BV1TC4q6XE2x','caption':'「光辉殿堂的不朽篇章」招募预告'},
 {'type':'video','src':'https://player.bilibili.com/player.html?bvid=BV1Bp4j61E2P','caption':'「月色之下流转之舞」剧情预告'},
]+[dict(type='image',**x) for x in images[2:]]
start=ws.max_row+1
template=ws.max_row
for m in media:
 d=dict(date='2026/11/8',title=title,category='organization',description=description,tag='game',media_type=m['type'],media_src=m['src'],media_caption=m['caption'])
 ws.append([d.get(k,'') for k in headers])
 for c in ws[ws.max_row]: c._style=copy(ws.cell(template,c.column)._style)
issues=check_timeline(ws,ROOT)
errors=[x for x in issues if x[0]=='ERROR']
if errors: raise ValueError(errors)
if hashlib.sha256(path.read_bytes()).hexdigest()!=before: raise RuntimeError('Workbook changed during processing')
backup=ROOT/'.tmp/data-before-ournotes.xlsx'
if not backup.exists(): shutil.copy2(path,backup)
staged=ROOT/'.tmp/data-with-ournotes.xlsx'
wb.save(staged);wb.close()
if hashlib.sha256(path.read_bytes()).hexdigest()!=before: raise RuntimeError('Workbook changed before save')
staged.replace(path)
data=openpyxl.load_workbook(path,data_only=True)
print('Timeline events:',generate_all.generate_timeline(data))
print('Search indexes:',generate_all.generate_search_indexes(data))
data.close()
report={'title':title,'date':'2026/11/8','description':description,'rows':[start,start+len(media)-1],
 'sources':['https://www.bilibili.com/opus/1267889809823629313','https://www.bilibili.com/video/BV1TC4q6XE2x','https://www.bilibili.com/video/BV1Bp4j61E2P','https://haneoka.org/intl/zh-CN/events/5/','https://haneoka.org/intl/zh-CN/gacha/23/'],
 'media':media,'checks':{'errors':len(errors),'warnings':len([x for x in issues if x[0]=='WARN'])}}
(ROOT/'_reports/ournotes-月色之下流转之舞.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('Saved rows:',report['rows'],report['checks'])
