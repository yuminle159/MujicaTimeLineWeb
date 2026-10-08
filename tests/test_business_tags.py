import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import openpyxl
import generate_all as generator


class BusinessTagTests(unittest.TestCase):
    def test_upcoming_includes_only_personal_mjc_with_range_and_detail_link(self):
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.title = "timeline"
        sheet.append(["date", "title", "category", "description", "tag", "group"])
        sheet.append(["2026/12/1", "Mujica work", "personal", "", "business_mjc", "work"])
        sheet.append(["2026/12/3", "Mujica work", "personal", "", "business_mjc", "work"])
        sheet.append(["2026/12/2", "Other work", "personal", "", "business_others", ""])
        sheet.append(["2026/12/2", "Wrong category", "organization", "", "business_mjc", ""])
        sheet.append(["2026/12/2", "Private", "personal", "", "private", ""])
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "events.js"
            with patch.dict(generator.OUTPUTS, upcoming_events=str(output)):
                self.assertEqual(generator.generate_upcoming_events(workbook), 1)
            events = json.loads(output.read_text(encoding="utf-8").split(" = ", 1)[1].rstrip(";\n"))
        event = events[0]
        self.assertEqual(event["type"], "activity")
        self.assertEqual(event["date"], "2026/12/1")
        self.assertEqual(event["endDate"], "2026/12/3")
        item_id = generator.hash_id("2026/12/1 ~ 2026/12/3", "Mujica work", "personal", "business_mjc")
        self.assertEqual(event["url"], "../timeline/index.html#timeline=" + item_id)
        workbook.close()

    def test_timeline_keeps_business_subtypes_and_dropdown(self):
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.title = "timeline"
        sheet.append(["date", "title", "category", "description", "tag"])
        for tag in ("business_mjc", "business_others"):
            sheet.append(["2026/12/1", tag, "personal", "", tag])
        generator.add_timeline_tag_validation(workbook)
        formula = sheet.data_validations.dataValidation[0].formula1
        self.assertIn("business_mjc", formula)
        self.assertIn("business_others", formula)
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "timeline.js"
            with patch.dict(generator.OUTPUTS, timeline=str(output)):
                self.assertEqual(generator.generate_timeline(workbook), 2)
            data = output.read_text(encoding="utf-8")
            self.assertIn('tag: "business_mjc"', data)
            self.assertIn('tag: "business_others"', data)
        workbook.close()


if __name__ == "__main__":
    unittest.main()
