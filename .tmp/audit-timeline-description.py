import re,json
from pathlib import Path
s=Path('timeline/data.js').read_text(encoding='utf-8')
for b in s.split('hash_id: ')[1:]:
 def get(k):
  m=re.search(r'\b'+k+r': ("(?:[^"\\]|\\.)*")',b)
  return json.loads(m[1]) if m else ''
 d=get('description')
 if d and not re.search(r'^(佐佐木李子|高尾奏音)[：:]',d,re.M) and get('category')=='personal':
  print(get('date'),get('title'),repr(d))
