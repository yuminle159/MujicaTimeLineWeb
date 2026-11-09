import sys, json, re, shutil, html
from pathlib import Path
import openpyxl

root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root))
import generate_all

plan=json.loads((root/'_reports/timeline-replies-migration.json').read_text(encoding='utf-8'))
book=root/'_data/data.xlsx'
shutil.copy2(book,root/'.tmp/data-before-replies-batch.xlsx')
shutil.copy2(root/'timeline/data.js',root/'.tmp/timeline-before-replies-batch.js')
wb=openpyxl.load_workbook(book)
ws=wb['timeline']
cols={c.value:c.column-1 for c in ws[1]}
for entry in plan:
    rows=[row for row in ws.iter_rows(min_row=2) if row[cols['title']].value==entry['title'] and (row[cols['description']].value or '').strip()==entry['before'].strip()]
    assert rows,entry['title']
    removed=0
    for row in rows:
        row[cols['description']].value=entry['after']
        src=str(row[cols['media_src']].value or '')
        if '-推特回复' in src and row[cols['media_type']].value=='image':
            assert any(Path(src).name==Path(p).name for p in entry['images'])
            for field in ['media_type','media_src','media_caption']:
                row[cols[field]].value=None
            removed+=1
    assert removed==len(entry['images']),(entry['title'],removed)
    entry['excel_rows']=len(rows)

numbered={}
for row in ws.iter_rows(min_row=2):
    cell=row[cols['description']]
    old=cell.value or ''
    new=re.sub(r'(佐佐木李子|高尾奏音)[①-⑳](?=[：:])',r'\1',old)
    if old!=new:
        title=row[cols['title']].value
        numbered[title]=(old,new)
        cell.value=new
assert len(numbered)==1,numbered.keys()
for title,(old,new) in numbered.items():
    plan.append(dict(number=len(plan)+1,id='kk1nlFGcVbb',date='2025/7/28',title=title,before=old,after=new,images=[],note='仅去掉作者名后的①②，保持两篇独立发帖；正文“祝花②”和资源链接编号保留。'))
wb.save(book)
generate_all.generate_timeline(wb)
wb.close()
(root/'_reports/timeline-replies-migration.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')

esc=html.escape
cards=[]
for e in plan:
    sources=''.join(f'<a href="{esc(src)}" target="_blank"><img loading="lazy" src="{esc(src)}" alt="原截图：{esc(e["title"])}"></a>' for src in e['images'])
    cards.append(f'''<article id="item-{e['number']}"><header><label><input type="checkbox" data-id="{e['id']}"> 已核对</label><span>#{e['number']:02d} · {esc(e['date'])}</span><h2>{esc(e['title'])}</h2><a href="../timeline/index.html#timeline={e['id']}" target="_blank">打开时间轴条目 ↗</a></header>
    {f'<p class="note">核对备注：{esc(e["note"])}</p>' if e['note'] else ''}
    <div class="columns"><section><h3>更新后的 description</h3><pre>{esc(e['after'])}</pre><details><summary>修改前文字</summary><pre>{esc(e['before'])}</pre></details></section>
    <section><h3>原截图</h3>{sources or '<p>此条仅清理作者编号。</p>'}</section></div></article>''')
toc=''.join(f'<a href="#item-{e["number"]}">#{e["number"]:02d} {esc(e["date"])} · {esc(e["title"])}</a>' for e in plan)
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Timeline 回复转换核对清单</title>
<style>body{margin:0;background:#101011;color:#d2cfca;font:14px/1.85 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1280px;margin:auto;padding:32px 22px}h1{font-size:24px}h2{font-size:19px;color:#e4d6bf}h3{font-size:12px;color:#baa98e}a{color:#ccad83}nav{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:5px 20px;margin:24px 0}nav a{font-size:12px}article{border-top:1px solid #ffffff20;padding:28px 0;scroll-margin-top:20px}header>span{color:#a5a5a5}label{float:right;cursor:pointer}input{accent-color:#b9a58b}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;margin:0}.columns{display:grid;grid-template-columns:1fr 1fr;gap:30px;align-items:start}img{width:100%;height:auto;border:1px solid #ffffff20}details{margin-top:20px;color:#aaa}.note{padding:10px 14px;border-left:2px solid #b9a58b;background:#b9a58b08}#progress{color:#cbbb9e}article.checked h2::after{content:" ✓";color:#aab993}@media(max-width:760px){.columns{grid-template-columns:1fr}main{padding:20px 16px}}</style>
<main><h1>Timeline 回复转换核对清单</h1><p>32 条截图转换 + 1 条作者编号清理。按图片中的中文整理，已有主帖译文保留。回复用实线、引用用虚线；没有关联标记的发言保持独立。原截图文件均保留。</p><p>勾选只记录在当前浏览器，不会更改 Excel 或自动提交确认。反馈时可直接引用条目编号。</p><p id="progress"></p><nav>'''+toc+'</nav>'+''.join(cards)+'''</main><script>
const key='timeline-replies-review-20261109';let checked={};try{checked=JSON.parse(localStorage.getItem(key)||'{}')}catch(e){}const boxes=[...document.querySelectorAll('input[data-id]')];function update(){for(const box of boxes)box.closest('article').classList.toggle('checked',box.checked);document.getElementById('progress').textContent=`已核对 ${boxes.filter(b=>b.checked).length} / ${boxes.length}`;}for(const box of boxes){box.checked=!!checked[box.dataset.id];box.addEventListener('change',()=>{checked[box.dataset.id]=box.checked;try{localStorage.setItem(key,JSON.stringify(checked))}catch(e){}update()})}update();</script></html>'''
(root/'_reports/timeline-replies-review.html').write_text(page,encoding='utf-8')
print(f'Applied {len(plan)} entries; wrote review HTML and JSON audit.')
