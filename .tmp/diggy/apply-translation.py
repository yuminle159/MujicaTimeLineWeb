from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[2]
p=ROOT/'_data/mc/261109Billboard-Diggy-MO前篇.md';s=p.read_text(encoding='utf-8');original=s
backup=Path(__file__).parent/'before-translation.md'
assert not backup.exists();backup.write_text(original,encoding='utf-8')
originals=re.findall(r'\[original\](.*?)\[/original\]',s,re.S)
blocks=[originals[i] for i in [0,2,4,6,8]]
translations=[]
for i,source in enumerate(blocks):
 raw=(Path(__file__).parent/f'zh{i}.txt').read_text(encoding='utf-8').strip()
 paras=raw.split('\n\n');sp=[x.strip() for x in source.strip().split('\n\n')]
 assert len(paras)==len(sp),(i,len(paras),len(sp))
 result=[]
 for jp,cn in zip(sp,paras):
  assert jp.startswith('――')==cn.startswith('——'),(i,jp[:20],cn[:20])
  if cn.startswith('——'):
   if result:result.append('[br]')
   result.append('**'+cn+'**')
  else:
   cn=re.sub(r'^(Diggy-MO[’\'])(：)',r'**\1**\2',cn)
   cn=re.sub(r'BanG Dream! Ave Mujica|Ave Mujica|Mujica',lambda m:'[c7]'+m.group()+'[/c7]',cn)
   result.append(cn)
 translations.append('\n\n'.join(result))
assert s.count('（中文）')==len(translations)
for tr in translations:s=s.replace('（中文）',tr,1)
s=re.sub(r'\[br\]\n\n\[【公式ライブ映像】[^\n]+\n\n\[br\]\n\n','',s)
assert re.findall(r'\[original\](.*?)\[/original\]',s,re.S)==originals
assert re.findall(r'^#{1,2} .*$',s,re.M)==re.findall(r'^#{1,2} .*$',original,re.M)
assert re.findall(r'^\*\*(?:访谈时间|访谈人|出处)\*\*.*$',s,re.M)==re.findall(r'^\*\*(?:访谈时间|访谈人|出处)\*\*.*$',original,re.M)
assert '（中文）' not in s and 'youtube.com' not in s
assert len(re.findall(r'^\*\*——',s,re.M))==46
p.write_text(s,encoding='utf-8')
print('Translated 95 paragraphs / 46 Q&A; all 9 original blocks, headings, metadata unchanged; video link removed.')
