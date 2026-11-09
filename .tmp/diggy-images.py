from pathlib import Path
from lxml import html
import re
for i,p in enumerate(sorted(Path('C:/Users/yumin/Downloads').glob('*Diggy*.html'))):
 root=html.fromstring(p.read_text(encoding='utf-8'));print('FILE',i)
 for e in root.xpath('//*[@id="specialContent"]//img'):
  print('IMG',e.get('alt'),e.get('width'),e.get('height'),e.get('src','')[:45], 'style',re.findall(r'var\((.*?)\)',e.get('style','')), 'parents',[(a.tag,a.get('id'),a.get('class')) for a in list(e.iterancestors())[:4]])
 print('HEADINGS',[(e.tag,e.text_content()) for e in root.xpath('//*[@id="maintext"]//h5')])
 print('OUTSIDE',[(e.tag,e.get('id'),e.get('class'),e.text_content()[:70]) for e in root.xpath('//*[@id="specialImport"]/*')])
