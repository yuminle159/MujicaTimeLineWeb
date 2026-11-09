from pathlib import Path
from lxml import html,etree
for p in sorted(Path('.tmp/diggy').glob('page*.html')):
 root=html.fromstring(p.read_text(encoding='utf-8'));print('\nFILE',p.name)
 for main in root.xpath('//div[@id="maintext"]'):
  print('PAGE',main.getparent().get('id'))
  for e in main:
   print(e.tag,e.get('id'),e.get('class'),e.text_content().strip()[:150])
  (p.parent/(p.stem+'.body.html')).write_text(etree.tostring(main,pretty_print=True,encoding='unicode'),encoding='utf-8')
 print('PAGING',[(e.text_content(),e.get('href'),e.get('onclick')) for e in root.xpath('//a') if 'html_contents' in str(e.attrib)])
