from pathlib import Path
import sys,hashlib,shutil
import openpyxl
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import generate_all
from timeline_checks import check_timeline
replacements={'Mortis／若叶睦':'Mortis','Amoris／祐天寺若麦':'Amoris','Oblivionis／丰川祥子':'Oblivionis','Doloris／三角初华':'Doloris'}
def fix(s):
 for a,b in replacements.items(): s=s.replace(a,b)
 return s
p=ROOT/'_data/data.xlsx'; original=p.read_bytes()
wb=openpyxl.load_workbook(p); ws=wb['timeline']; cols={c.value:c.column for c in ws[1]}
changed=[]
for row in ws.iter_rows(min_row=2):
 if '月色之下流转之舞' not in str(row[cols['title']-1].value): continue
 cell=row[cols['media_caption']-1]
 old=cell.value or ''; new=fix(old)
 if old!=new: cell.value=new; changed.append(new)
assert len(changed)==5,changed
assert not [x for x in check_timeline(ws,ROOT) if x[0]=='ERROR']
backup=ROOT/'.tmp/data-before-ournotes-name-fix-closed.xlsx'
if not backup.exists(): backup.write_bytes(original)
tmp=ROOT/'.tmp/data-ournotes-name-fix.xlsx';wb.save(tmp);wb.close()
assert p.read_bytes()==original,'Workbook changed during edit'
tmp.replace(p)
for rel in ['_reports/ournotes-月色之下流转之舞.json','.tmp/ournotes-source/images.json','.tmp/download-ournotes.py']:
 f=ROOT/rel
 if f.exists(): f.write_text(fix(f.read_text(encoding='utf-8')),encoding='utf-8')
wb=openpyxl.load_workbook(p,data_only=True)
print('Events:',generate_all.generate_timeline(wb)); print('Indexes:',generate_all.generate_search_indexes(wb));wb.close()
print('\n'.join(changed))
