from pathlib import Path
import re,json,openpyxl
out=Path('.tmp/diggy');out.mkdir(exist_ok=True)
for i,p in enumerate(sorted(Path('C:/Users/yumin/Downloads').glob('*Diggy*.html'))):
 t=p.read_text(encoding='utf-8');print(i,p.name,len(t))
 print(t[:700]);print('TITLE',re.findall(r'<title>(.*?)</title>',t))
 print('HEADINGS',re.findall(r'<h[1-4][^>]*>(.*?)</h[1-4]>',t,re.S)[:20])
 print('CANONICAL',re.findall(r'<link[^>]+canonical[^>]+>',t));print('DATE',re.findall(r'.{0,100}(?:datePublished|202[456][-/.][01][0-9][-/.][0-3][0-9]).{0,100}',t)[:12])
 # Remove embedded data before inspecting markup.
 clean=re.sub(r'data:[^\s\"\']+', '[DATA]',t)
 (out/f'page{i}.html').write_text(clean,encoding='utf-8')
wb=openpyxl.load_workbook('_data/data.xlsx',data_only=True);ws=wb['interview'];print('HEADERS',list(ws.values)[0]);print('EXAMPLES',[r for r in ws.values if any('Diggy' in str(v) or '261022' in str(v) for v in r)])
