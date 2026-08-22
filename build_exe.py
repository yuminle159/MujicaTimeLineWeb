#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将 build_gui.py 打包为单个自包含的 wijipedia_数据更新工具.exe
需要安装: pip install pyinstaller openpyxl Pillow
"""

import subprocess
import sys
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
script = os.path.join(ROOT, "build_gui.py")
output_name = "wijipedia_数据更新工具"

cmd = [
    sys.executable, "-m", "PyInstaller",
    "--onefile",
    "--windowed",
    "--name", output_name,
    "--distpath", ROOT,
    "--workpath", os.path.join(ROOT, "_build"),
    "--specpath", os.path.join(ROOT, "_build"),
    "--add-data", f"{os.path.join(ROOT, 'generate_all.py')}{os.pathsep}.",
    "--hidden-import", "openpyxl",
    "--hidden-import", "openpyxl.cell",
    "--hidden-import", "openpyxl.worksheet",
    "--hidden-import", "PIL",
    "--hidden-import", "PIL.Image",
    "--clean",
    script
]

print("正在打包（onefile 单文件模式）...")
subprocess.run(cmd, check=True)
print(f"\n完成！自包含 exe 已生成: {os.path.join(ROOT, output_name + '.exe')}")
print("\n这个 exe 可以单独发给任何人，无需安装 Python。")