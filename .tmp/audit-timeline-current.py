import sys,json,re,collections,datetime
from pathlib import Path
import openpyxl
root=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(root))
import generate_all
wb=openpyxl.load_workbook(root/'_data/data.xlsx',data_only=False)
ws=wb['timeline']; headers=[c.value for c in ws[1]]
rows=[dict(zip(headers,[c.value for c in row]),_row=row[0].row) for row in ws.iter_rows(min_row=2) if any(c.value is not None for c in row)]
groups=collections.defaultdict(list)
for r in rows:
    date=str(r.get('date') or '')
    groups[(date,str(r.get('title') or ''))].append(r)
issues=[]
for key,rs in groups.items():
    signatures={tuple(str(r.get(k) or '').strip() for k in ['description','category','tag','Group']) for r in rs}
    if len(signatures)>1:
        issues.append({'date':key[0],'title':key[1],'rows':[{k:r.get(k) for k in ['_row','description','category','tag','Group','media_type','media_src','media_url']} for r in rs]})
obsolete=[{k:r.get(k) for k in ['_row','date','title','media_type','media_src','media_caption']} for r in rows if r.get('media_type')=='image' and re.search(r'-(?:ins|推特回复)',str(r.get('media_src') or ''),re.I)]
quote=[{k:r.get(k) for k in ['_row','date','title','description']} for r in rows if re.search(r'引用[|｜]',str(r.get('description') or ''))]
report={'obsolete_images':obsolete,'quote_markers':quote,'split_candidates':issues}
(root/'.tmp/timeline-current-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2,default=str),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2,default=str))
