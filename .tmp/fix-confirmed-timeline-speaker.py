import json, re, shutil
from pathlib import Path
import openpyxl

old = '“初华一定能成为偶像的”\n\n小祥，还有小真奈\n谢谢你们。'
new = '佐佐木李子：' + old
book = Path('_data/data.xlsx')
shutil.copy2(book, '.tmp/data-before-confirmed-speaker.xlsx')
wb = openpyxl.load_workbook(book)
sheet = wb['timeline']
headers = [c.value for c in sheet[1]]
column = headers.index('description') + 1
changed = 0
for row in sheet.iter_rows(min_row=2):
    cell = row[column - 1]
    if cell.value == old:
        cell.value = new
        changed += 1
assert changed == 2, changed
data = Path('timeline/data.js')
text = data.read_text(encoding='utf-8')
literal = json.dumps(old, ensure_ascii=False)
assert text.count(literal) == 1
wb.save(book)
data.write_text(text.replace(literal, json.dumps(new, ensure_ascii=False)), encoding='utf-8')
print(f'Updated {changed} Excel rows and 1 generated event.')
descriptions = {json.loads(m) for m in re.findall(r'description: ("(?:[^"\\]|\\.)*")', data.read_text(encoding='utf-8'))}
source = {row[column-1].value.strip() for row in sheet.iter_rows(min_row=2) if isinstance(row[column-1].value, str) and row[column-1].value.strip()}
print('Workbook descriptions absent from generated:', len(source - descriptions))
