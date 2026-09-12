#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将 build_gui.py 打包为单个自包含的 wijipedia_数据更新工具.exe
需要安装: pip install pyinstaller openpyxl Pillow sudachipy sudachidict_small jieba
"""

import subprocess
import sys
import os
import importlib.util

ROOT = os.path.dirname(os.path.abspath(__file__))
script = os.path.join(ROOT, "build_gui.py")
output_name = "wijipedia_数据更新工具"

# PyInstaller 的 --collect-all 在目标包未安装时只发出警告，仍会产出一个
# 运行时才报错的 exe。打包前显式检查，避免生成不完整产物。
required_modules = {
    "PyInstaller": "pyinstaller",
    "openpyxl": "openpyxl",
    "PIL": "Pillow",
    "sudachipy": "sudachipy",
    "sudachidict_small": "sudachidict_small",
    "jieba": "jieba",
}
missing_packages = [
    package_name
    for module_name, package_name in required_modules.items()
    if importlib.util.find_spec(module_name) is None
]
if missing_packages:
    print("无法打包：当前 Python 缺少依赖：" + ", ".join(missing_packages))
    print("请先运行：")
    print(f'  "{sys.executable}" -m pip install ' + " ".join(missing_packages))
    sys.exit(1)

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
    "--collect-all", "sudachipy",
    "--collect-all", "sudachidict_small",
    "--collect-all", "jieba",
    "--clean",
    script
]

print("正在打包（onefile 单文件模式）...")
subprocess.run(cmd, check=True)
print(f"\n完成！自包含 exe 已生成: {os.path.join(ROOT, output_name + '.exe')}")
print("\n这个 exe 可以单独发给任何人，无需安装 Python。")
