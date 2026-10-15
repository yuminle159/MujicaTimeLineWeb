import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import image_renamer as r


class RenameTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.folder=Path(self.tmp.name)

    def file(self,name,content=b'image'):
        path=self.folder/name;path.write_bytes(content);return path

    def test_unicode_extensions_and_undo(self):
        paths=[self.file('照片 1.JPG',b'a'),self.file('照片 2.webp',b'b')]
        plan=r.make_plan(paths,'20240411邦tv212')
        undo=r.execute(plan)
        self.assertEqual([p.name for _,p in plan],['20240411邦tv212-01.JPG','20240411邦tv212-02.webp'])
        self.assertEqual([p.read_bytes() for _,p in plan],[b'a',b'b'])
        r.execute(undo)
        self.assertEqual([p.read_bytes() for p in paths],[b'a',b'b'])

    def test_conflict_does_not_touch_files(self):
        source=self.file('a.jpg',b'a');target=self.file('照片-01.jpg',b'keep')
        with self.assertRaises(ValueError):r.make_plan([source],'照片')
        self.assertEqual(source.read_bytes(),b'a');self.assertEqual(target.read_bytes(),b'keep')

    def test_swapping_existing_numbered_files(self):
        a=self.file('照片-01.jpg',b'a');b=self.file('照片-02.jpg',b'b')
        r.execute(r.make_plan([b,a],'照片'))
        self.assertEqual(a.read_bytes(),b'b');self.assertEqual(b.read_bytes(),b'a')

    def test_failure_after_one_final_rename_rolls_back(self):
        paths=[self.file('a.jpg',b'a'),self.file('b.jpg',b'b')]
        original=r.move;calls=0
        def fail_once(a,b):
            nonlocal calls
            calls+=1
            if calls==4:raise PermissionError('locked')
            original(a,b)
        with patch.object(r,'move',side_effect=fail_once):
            with self.assertRaises(PermissionError):r.execute(r.make_plan(paths,'照片'))
        self.assertEqual([p.read_bytes() for p in paths],[b'a',b'b'])
        self.assertEqual(len(list(self.folder.iterdir())),2)

    def test_invalid_names_and_natural_order(self):
        path=self.file('x.jpg')
        for name in ['', '../outside','a:b','a/b','a\\b','a.',' a']:
            with self.subTest(name=name), self.assertRaises(ValueError):r.make_plan([path],name)
        self.assertEqual(sorted(['img10.jpg','img2.jpg','img1.jpg'],key=r.natural_key),['img1.jpg','img2.jpg','img10.jpg'])

if __name__=='__main__':unittest.main()
