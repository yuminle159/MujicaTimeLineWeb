import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import openpyxl
import maintenance


class FullUpdateProgramTests(unittest.TestCase):
    def test_full_update_generates_program_data(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / '_data').mkdir()
            wb = openpyxl.Workbook()
            wb.active.title = 'programs'
            wb.active.append(['program_id', 'program'])
            wb.active.append(['test-episode', 'test-series'])
            wb.save(root / '_data/data.xlsx')
            wb.close()
            generator = Mock()
            generator.generate_programs.return_value = 1
            generator.generate_search_indexes.return_value = (0, 0)
            generator.inject_version.return_value = 'test-version'
            with patch.object(maintenance, '_configure_generator', return_value=generator):
                result = maintenance.generate_all_content(root, lambda _: None)
            generator.generate_programs.assert_called_once()
            self.assertEqual(result['节目档案'], '1 期')


if __name__ == '__main__':
    unittest.main()
