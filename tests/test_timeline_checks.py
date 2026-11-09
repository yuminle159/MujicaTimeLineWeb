import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch
import openpyxl
import maintenance
from timeline_checks import check_timeline


class TimelineChecksTests(unittest.TestCase):
    def sheet(self, rows):
        wb = openpyxl.Workbook()
        sheet = wb.active; sheet.title = 'timeline'
        sheet.append(['date','title','description','category','tag','media_type','media_src','media_url','Group'])
        for row in rows: sheet.append(row)
        return wb, sheet

    def test_same_event_conflict_reports_rows_and_differing_field(self):
        wb, s = self.sheet([[datetime(2025,7,16),'午饭','高尾奏音：饭团','personal','private'],['2025/07/16','午饭','高尾奏音：面包','personal','private']])
        issues = check_timeline(s, '.')
        self.assertTrue(any(level=='ERROR' and loc=='timeline!3' and '第 2 行' in msg and 'description' in msg for level,loc,msg in issues))

    def test_group_can_inherit_empty_description(self):
        wb,s=self.sheet([['2025/7/12','BML','说明','organization','fes',None,None,None,'bml'],['2025/7/13','BML',None,'organization','fes',None,None,None,'bml']])
        self.assertEqual(check_timeline(s,'.'),[])

    def test_identical_event_rows_are_media_not_duplicates(self):
        wb,s=self.sheet([['2025/7/16','午饭','高尾奏音：饭团\n回复|佐佐木李子：木鱼花\n点赞|高尾奏音','personal','private']]*2)
        self.assertEqual(check_timeline(s,'.'),[])

    def test_invalid_markers_and_missing_image(self):
        wb,s=self.sheet([['2025/7/16','午饭','高尾奏音①：饭团\n引用|佐佐木李子：木鱼花\n回复|李子：谢谢','personal','private','image','images/missing.webp']])
        errors=[msg for level,_,msg in check_timeline(s,'.') if level=='ERROR']
        self.assertEqual(len(errors),4)

    def test_duplicate_media_and_blank_link_are_warnings(self):
        wb,s=self.sheet([['2025/7/16','午饭','','personal','private','link',None,'https://example.com']]*2+[['2025/7/17','生日','','personal','private','link']])
        self.assertEqual([level for level,_,_ in check_timeline(s,'.')],['WARN','WARN'])

    def test_project_check_includes_timeline_errors(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); (root/'_data').mkdir()
            wb,s=self.sheet([['2025/7/16','午饭','a','personal','private'],['2025/7/16','午饭','b','personal','private']])
            wb.save(root/'_data/data.xlsx')
            report=maintenance.check_project(root)
            self.assertTrue(any(i.location=='timeline!3' and 'description' in i.message for i in report.errors))

    def test_generator_stops_before_writing_conflicting_data(self):
        import generate_all
        wb,s=self.sheet([['2025/7/16','午饭','a','personal','private'],['2025/7/16','午饭','b','personal','private']])
        with patch('builtins.open') as output:
            with self.assertRaisesRegex(ValueError,'Timeline 体检未通过'):
                generate_all.generate_timeline(wb)
            output.assert_not_called()


if __name__=='__main__': unittest.main()
