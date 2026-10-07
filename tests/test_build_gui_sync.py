import unittest
from unittest.mock import patch

import build_gui


class SyncRetryTests(unittest.TestCase):
    def test_merge_retry_updates_running_exe_through_helper(self):
        commands = []

        def fake_git(*args, **kwargs):
            commands.append(args)
            if args[:2] == ("diff", "--name-only"):
                return 0, "wijipedia_数据更新工具.exe\nindex.html"
            return 0, ""

        with (
            patch.object(build_gui, "require_git_repository"),
            patch.object(build_gui, "run_git_command", side_effect=fake_git),
            patch.object(build_gui.sys, "frozen", True, create=True),
            patch.object(build_gui.sys, "executable", "C:\\project\\wijipedia_数据更新工具.exe"),
        ):
            with self.assertRaises(build_gui.SelfUpdateRequired):
                build_gui.run_start_workflow(lambda message: None, start_step=2)

        self.assertNotIn(("merge", "--ff-only", "origin/main"), commands)

    def test_merge_retry_without_exe_change_can_continue(self):
        commands = []

        def fake_git(*args, **kwargs):
            commands.append(args)
            if args[:2] == ("diff", "--name-only"):
                return 0, "index.html"
            return 0, ""

        with (
            patch.object(build_gui, "require_git_repository"),
            patch.object(build_gui, "run_git_command", side_effect=fake_git),
            patch.object(build_gui.sys, "frozen", True, create=True),
            patch.object(build_gui.sys, "executable", "C:\\project\\wijipedia_数据更新工具.exe"),
        ):
            build_gui.run_start_workflow(lambda message: None, start_step=2)

        self.assertIn(("merge", "--ff-only", "origin/main"), commands)


if __name__ == "__main__":
    unittest.main()
