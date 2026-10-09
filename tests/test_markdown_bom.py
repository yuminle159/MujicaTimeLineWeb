import unittest

import generate_all


class MarkdownBomTests(unittest.TestCase):
    def test_bom_heading_renders_like_plain_utf8(self):
        for heading in ('# 标题', '## 章节', '### 小节'):
            with self.subTest(heading=heading):
                markdown = heading + '\n\n正文 [original]日文[/original]'
                self.assertEqual(
                    generate_all.render_md_to_html('\ufeff' + markdown),
                    generate_all.render_md_to_html(markdown),
                )

    def test_bom_does_not_hide_first_table_of_contents_entry(self):
        markdown = '## 第一节\n\n正文\n\n## 第二节'
        self.assertEqual(
            generate_all.extract_interview_sections('\ufeff' + markdown),
            generate_all.extract_interview_sections(markdown),
        )
        self.assertEqual(len(generate_all.extract_interview_sections('\ufeff' + markdown)), 2)


if __name__ == '__main__':
    unittest.main()
