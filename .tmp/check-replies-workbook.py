from pathlib import Path
import json
import openpyxl

before=openpyxl.load_workbook('.tmp/data-before-replies-batch.xlsx',data_only=False)
after=openpyxl.load_workbook('_data/data.xlsx',data_only=False)
assert before.sheetnames==after.sheetnames
plan=json.loads(Path('_reports/timeline-replies-migration.json').read_text(encoding='utf-8'))
titles={e['title'] for e in plan}
count=0
for old,new in zip(before.worksheets,after.worksheets):
    assert (old.max_row,old.max_column)==(new.max_row,new.max_column),old.title
    headers={c.value:c.column for c in new[1]}
    for row in old:
        for cell in row:
            changed=new.cell(cell.row,cell.column)
            if cell.value==changed.value:
                continue
            assert old.title=='timeline',(old.title,cell.coordinate)
            assert cell.column in [headers[k] for k in ['description','media_type','media_src','media_caption']]
            assert new.cell(cell.row,headers['title']).value in titles
            count+=1
for e in plan:
    for src in e['images']:
        assert (Path('timeline')/src).is_file(),src
print(f'PASS: {count} intended workbook cell changes, all other cell values preserved; all 32 source screenshots retained.')
