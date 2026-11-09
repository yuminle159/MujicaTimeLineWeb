from pathlib import Path
import re,openpyxl
ROOT=Path(__file__).resolve().parents[2]
md=ROOT/'_data/mc/261109Billboard-Diggy-MO前篇.md'
s=md.read_text(encoding='utf-8')
# Preserve nested performance-title punctuation, modifying only Chinese portions.
parts=re.split(r'(\[original\].*?\[/original\])',s,flags=re.S)
for i in range(0,len(parts),2):
 parts[i]=parts[i].replace('「Ave Mujica 6th LIVE「Ulterius Procedere」」','【Ave Mujica 6th LIVE「Ulterius Procedere」】').replace('「Ave Mujica LIVE TOUR 2026「Exitus」」','【Ave Mujica LIVE TOUR 2026「Exitus」】')
s=''.join(parts);md.write_text(s,encoding='utf-8')
before=(ROOT/'.tmp/diggy/before-translation.md').read_text(encoding='utf-8')
assert re.findall(r'\[original\].*?\[/original\]',s,re.S)==re.findall(r'\[original\].*?\[/original\]',before,re.S)
assert re.findall(r'^\*[^*\n]+\*$',s,re.M)==re.findall(r'^\*[^*\n]+\*$',before,re.M)
assert re.findall(r'!\[[^\]]*\]\([^)]*\)',s)==re.findall(r'!\[[^\]]*\]\([^)]*\)',before)
outside=re.sub(r'\[original\].*?\[/original\]','',s,flags=re.S)
assert outside.count('**Diggy-MO’**')==46
assert '[c' not in ''.join(re.findall(r'^\*\*——.*$',outside,re.M))
for tag in ['c7']:assert outside.count('['+tag+']')==outside.count('[/'+tag+']')
p=ROOT/'_data/data.xlsx';original=p.read_bytes();wb=openpyxl.load_workbook(p);ws=wb['interview'];heads=[c.value for c in ws[1]]
old={n:list(wb[n].values) for n in wb.sheetnames}
rows=[r for r in ws.iter_rows(min_row=2) if r[heads.index('md_path')].value=='mc/261109Billboard-Diggy-MO前篇.md'];assert len(rows)==1
rows[0][heads.index('if_translated')].value='yes'
backup=ROOT/'.tmp/diggy/data-before-translation.xlsx';assert not backup.exists();backup.write_bytes(original)
tmp=ROOT/'.tmp/diggy/data-translated.xlsx';wb.save(tmp);wb.close();assert p.read_bytes()==original;tmp.replace(p)
wb=openpyxl.load_workbook(p)
diff=[]
for n,values in old.items():
 new=list(wb[n].values);assert len(new)==len(values)
 for r,(a,b) in enumerate(zip(values,new),1):
  for c,(x,y) in enumerate(zip(a,b),1):
   if x!=y:diff.append((n,r,c,x,y))
assert len(diff)==1 and diff[0][-2:]==('no','yes'),diff
print('Verified workbook: only target translation flag changed to yes.')
# Prepare the skill revisions only after the translation and workbook are complete.
for name,p in [('global',Path('C:/Users/yumin/.codex/skills/update-interviews/SKILL.md')),('repo',ROOT/'.agents/skills/update-interviews/SKILL.md')]:
 skill=p.read_text(encoding='utf-8')
 rule='- 影像／视频链接一概不保留：删除嵌入播放器、iframe、视频缩略图及对应的观看链接和独立视频说明，不将嵌入内容改写成 Markdown 视频链接。访谈正文中关于影像、MV 或演出的讨论仍须保留；文章出处链接和正文照片不受此规则影响。\n'
 skill=skill.replace('## Markdown 格式',rule+'\n## Markdown 格式')
 skill=skill.replace('- 未要求翻译时保留日文正文；不要把整理误当作全文翻译。','- 未要求翻译时保留日文正文；不要把整理误当作全文翻译。用户要求翻译时，先读取 `_data/_docs/md文件翻译规则.md`，按其要求填入中文、保留原文及受保护字段，全文完成并核对后才将 `if_translated` 改为 `yes`。')
 (ROOT/'.tmp/diggy'/f'skill-{name}.md').write_text(skill,encoding='utf-8')
print('Skill revisions prepared.')
