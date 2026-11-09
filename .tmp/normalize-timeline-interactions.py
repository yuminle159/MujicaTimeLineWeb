import re, shutil, sys
from pathlib import Path
import openpyxl
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root))
import generate_all
book=root/'_data/data.xlsx'
wb=openpyxl.load_workbook(book)
ws=wb['timeline']; headers={c.value:c.column-1 for c in ws[1]}
seen=set(); changed=0
for row in ws.iter_rows(min_row=2):
    cell=row[headers['description']]; text=cell.value or ''
    new=re.sub(r'^引用([|｜])',r'回复\1',text,flags=re.M)
    if new!=text:
        cell.value=new; changed+=1
    if '点赞' in new:
        item=(str(row[headers['date']].value),row[headers['title']].value,new)
        if item not in seen: print(item); seen.add(item)
if changed:
    shutil.copy2(book,root/'.tmp/data-before-unifying-replies.xlsx')
    try:
        wb.save(book)
    except PermissionError:
        print('Workbook is locked: source normalization pending; generating the page from the normalized in-memory data.')
generate_all.generate_timeline(wb)
print('Normalized quote markers in',changed,'rows; like descriptions:',len(seen))
