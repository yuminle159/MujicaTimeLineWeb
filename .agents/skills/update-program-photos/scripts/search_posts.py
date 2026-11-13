import argparse,asyncio,json,os
from pathlib import Path
from datetime import datetime,timedelta,timezone
from twikit import Client
ACCOUNTS={'佐佐木李子':'sasakirico','渡濑结月':'Watase_Yuzuki','冈田梦以':'okada_mei0519','米泽茜':'AkaneY_banu','高尾奏音':'Kanon_Takao'}
async def main(a):
    root=Path(a.project)
    if a.catalog:
        catalog=json.loads((root/a.catalog).read_text(encoding='utf-8'))
    else:
        import openpyxl
        w=openpyxl.load_workbook(root/'_data/data.xlsx',read_only=True)
        values=list(w['programs'].values);catalog=[dict(zip(values[0],r)) for r in values[1:]];w.close()
    eps=[e for e in catalog if str(e['episode']).lstrip('#') in a.episodes]
    c=Client('ja-JP',proxy=a.proxy,impersonate='chrome124');c.load_cookies(str(Path(os.environ['LOCALAPPDATA'])/'xdata_twikit/x_cookies.json'))
    dest=root/a.output
    out=json.loads(dest.read_text(encoding='utf-8')) if dest.exists() else {'episodes':eps,'posts':[],'searches':[]}
    resets=[s.get('retry_after_epoch') or 0 for s in out['searches']]
    if resets and max(resets)>datetime.now(timezone.utc).timestamp():
        print('Rate limited until epoch',max(resets));return
    for e in eps:
        day=datetime.strptime(e['date'],'%Y/%m/%d').replace(tzinfo=timezone(timedelta(hours=9)))
        lo=day-timedelta(days=3);hi=day+timedelta(days=4)
        for name in e['performers'].split('|'):
            if name not in ACCOUNTS:continue
            account=ACCOUNTS[name];query=f'from:{account} since:{(lo-timedelta(days=1)):%Y-%m-%d} until:{hi:%Y-%m-%d}'
            if any(s['episode']==e['episode'] and s['account']==account and s.get('complete') for s in out['searches']):continue
            record=dict(episode=e['episode'],account=account,query=query,complete=False)
            try:
                result=await c.search_tweet(query,'Latest',count=100);seen=set()
                for page in range(10):
                    if not result:record['complete']=True;break
                    for t in result:
                        if t.id in seen:continue
                        seen.add(t.id)
                        if t.user.screen_name.lower()!=account.lower() or not lo<=t.created_at_datetime<hi or t.text.startswith('RT @'):continue
                        out['posts'].append(dict(episode=e['episode'],name=name,author=account,id=t.id,date=t.created_at_datetime.isoformat(),text=t.text,media=[dict(type=m.type,url=m.media_url) for m in (t.media or [])]))
                    await asyncio.sleep(1);result=await result.next()
            except Exception as ex:
                record['error']=type(ex).__name__
                record['retry_after_epoch']=getattr(ex,'rate_limit_reset',None)
            unique={(p['episode'],p['id']):p for p in out['posts']};out['posts']=list(unique.values())
            out['searches'].append(record);dest.parent.mkdir(exist_ok=True,parents=True);dest.write_text(json.dumps(out,ensure_ascii=False,indent=2,default=str),encoding='utf-8');print(e['episode'],account,record,flush=True)
            if 'error' in record:return
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--project',default='.');p.add_argument('--catalog',help='Optional JSON array exported from programs when openpyxl is unavailable');p.add_argument('--episodes',nargs='+',required=True);p.add_argument('--proxy',default=None);p.add_argument('--output',default='_reports/program-photos-posts.json');asyncio.run(main(p.parse_args()))
