from pathlib import Path
from lxml import html,etree
for i,p in enumerate(sorted(Path('C:/Users/yumin/Downloads').glob('*Diggy*.html'))):
 root=html.fromstring(p.read_text(encoding='utf-8'))
 print('\nFILE',i)
 for e in root.xpath('//h3 | //h4 | //p | //div[contains(@class,"page")]'):
  text=e.text_content().strip()
  if len(text)>65 and 'Diggy' in text and e.tag=='p':
   print('PAR',e.get('class'),text[:130]);print('ANCESTORS',[(a.tag,a.get('id'),a.get('class')) for a in list(e.iterancestors())[:4]])
 for e in root.xpath('//a[contains(@href,"5516")]'):print('LINK',e.text_content()[:100],e.get('href'))
 for e in root.xpath('//div[@id]'):
  if 'special' in str(e.attrib).lower(): print('DIV',e.attrib)
 clean=html.fromstring(Path(f'.tmp/diggy/page{i}.html').read_text(encoding='utf-8'))
 Path(f'.tmp/diggy/tree{i}.html').write_text(etree.tostring(clean,pretty_print=True,encoding='unicode'),encoding='utf-8')
