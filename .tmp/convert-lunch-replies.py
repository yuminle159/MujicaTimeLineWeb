import json, shutil
from pathlib import Path
import openpyxl

description = """高尾奏音：午饭吃的是饭团……！🍙
猜猜里面是什么馅的吧＼('ω')／ﾍｰｲ
回复|佐佐木李子：木鱼花！（おかか）
译注：双关语，小弄名字是たかおかのん，假如在其中再加一个か（即ka发长音）就会变成たかおかかのん，其中就会出现おかか，就是木鱼花。
回复|高尾奏音：为了让这个答案变成正确答案，我正在犹豫要不要再吃一个木鱼花饭团！"""
title = '佐佐木李子回复高尾奏音午饭相关推文'
book = Path('_data/data.xlsx')
wb = openpyxl.load_workbook(book)
ws = wb['timeline']
cols = {c.value: c.column for c in ws[1]}
count = 0
for row in ws.iter_rows(min_row=2):
    if row[cols['title']-1].value != title:
        continue
    row[cols['description']-1].value = description
    if str(row[cols['media_src']-1].value or '').endswith('20250716-推特回复.webp'):
        row[cols['media_src']-1].value = None
        row[cols['media_type']-1].value = None
    count += 1
assert count == 2, count
data = Path('timeline/data.js')
text = data.read_text(encoding='utf-8')
start = text.index('    hash_id: "8ApdB0SxHfr",')
end = text.index('\n  },', start)
old = text[start:end]
assert 'description: "推特回复"' in old
new = old.replace('description: "推特回复"', 'description: ' + json.dumps(description, ensure_ascii=False))
new = new.replace(',\n      { type: "image", src: "../images/galleryless/20250716-推特回复.webp" }', '')
shutil.copy2(book, '.tmp/data-before-lunch-replies.xlsx')
wb.save(book)
data.write_text(text[:start]+new+text[end:], encoding='utf-8')
print('Converted 2 Excel rows and 1 event; kept screenshot file as source.')
