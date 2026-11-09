import sys,re,shutil,json
from pathlib import Path
import openpyxl
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root))
import generate_all
book=root/'_data/data.xlsx';wb=openpyxl.load_workbook(book)
ws=wb['timeline'];cols={c.value:c.column-1 for c in ws[1]}
changes=[]
for row in ws.iter_rows(min_row=2):
    cell=row[cols['description']];desc=cell.value or ''
    new=re.sub(r'^引用([|｜])',r'回复\1',desc,flags=re.M)
    if new!=desc:
        cell.value=new;changes.append({'row':cell.row,'title':row[cols['title']].value,'action':'引用| → 回复|'})
    src=str(row[cols['media_src']].value or '')
    if row[cols['media_type']].value=='image' and re.search(r'-(?:ins|推特回复)',src,re.I):
        for key in ['media_type','media_src','media_caption']:row[cols[key]].value=None
        changes.append({'row':row[0].row,'title':row[cols['title']].value,'action':'移除图片引用','src':src})
if changes:
    shutil.copy2(book,root/'.tmp/data-before-final-timeline-cleanup.xlsx')
    wb.save(book)
count=generate_all.generate_timeline(wb)
(root/'.tmp/timeline-final-cleanup.json').write_text(json.dumps(changes,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'events':count,'changes':changes},ensure_ascii=False,indent=2))
