from pathlib import Path
from datetime import datetime
from copy import copy
import openpyxl,re
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];stem='261109Billboard-Diggy-MO前篇'
md=(ROOT/'_data/mc'/f'{stem}.md').read_text(encoding='utf-8')
for block in re.findall(r'\[original\](.*?)\[/original\]',md,re.S):assert '![' not in block
for src in re.findall(r'!\[[^\]]*\]\(([^)]+)\)',md):
 p=ROOT/src.removeprefix('../');im=Image.open(p);assert im.format=='WEBP';im.verify()
p=ROOT/'_data/data.xlsx';original=p.read_bytes();wb=openpyxl.load_workbook(p);ws=wb['interview'];headers=[c.value for c in ws[1]]
data=dict(poster=f'../images/{stem}-01.webp',date=datetime(2026,11,9),interviewee="Diggy-MO'",title="2026/11/09-Billboard JAPAN-Diggy-MO'",md_path=f'mc/{stem}.md',if_translated='no')
assert all(row[headers.index('md_path')]!=data['md_path'] for row in ws.iter_rows(min_row=2,values_only=True))
old={s:list(wb[s].values) for s in wb.sheetnames};template=ws.max_row
ws.append([data.get(h,'') for h in headers])
for c in ws[ws.max_row]:c._style=copy(ws.cell(template,c.column)._style)
ws.cell(ws.max_row,headers.index('date')+1).number_format='yyyy/mm/dd'
backup=ROOT/'.tmp/diggy/data-before.xlsx';assert not backup.exists();backup.write_bytes(original)
stage=ROOT/'.tmp/diggy/data-updated.xlsx';wb.save(stage);wb.close();assert p.read_bytes()==original,'Workbook changed';stage.replace(p)
check=openpyxl.load_workbook(p)
for s,rows in old.items():
 after=list(check[s].values)
 assert after[:len(rows)]==rows,s
 assert len(after)==len(rows)+(1 if s=='interview' else 0),s
assert list(check['interview'].values)[-1][headers.index('if_translated')]=='no'
print('Workbook saved: one interview added; all previous rows preserved. Images and original blocks validated.')
