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
output_name = os.environ.get("MUJICA_OUTPUT_NAME", "wijipedia_数据更新工具")
PYTHON_ROOT = sys.prefix
TK_RUNTIME_HOOK = os.path.join(ROOT, "tk_runtime_hook.py")
TK_FILES = {
    "_tkinter.pyd": os.path.join(PYTHON_ROOT, "DLLs", "_tkinter.pyd"),
    "tcl86t.dll": os.path.join(PYTHON_ROOT, "DLLs", "tcl86t.dll"),
    "tk86t.dll": os.path.join(PYTHON_ROOT, "DLLs", "tk86t.dll"),
    "tkinter": os.path.join(PYTHON_ROOT, "Lib", "tkinter"),
    "tcl8.6": os.path.join(PYTHON_ROOT, "tcl", "tcl8.6"),
    "tk8.6": os.path.join(PYTHON_ROOT, "tcl", "tk8.6"),
}

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

missing_tk_files = [name for name, path in TK_FILES.items() if not os.path.exists(path)]
if missing_tk_files:
    print("无法打包：当前 Python 缺少 Tk 运行文件：" + ", ".join(missing_tk_files))
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
    "--runtime-hook", TK_RUNTIME_HOOK,
    "--hidden-import", "openpyxl",
    "--hidden-import", "openpyxl.cell",
    "--hidden-import", "openpyxl.worksheet",
    "--hidden-import", "PIL",
    "--hidden-import", "PIL.Image",
    "--hidden-import", "tkinter",
    "--hidden-import", "tkinter.ttk",
    "--hidden-import", "_tkinter",
    "--add-binary", f"{TK_FILES['_tkinter.pyd']}{os.pathsep}.",
    "--add-binary", f"{TK_FILES['tcl86t.dll']}{os.pathsep}.",
    "--add-binary", f"{TK_FILES['tk86t.dll']}{os.pathsep}.",
    # Tcl 初始化失败时，PyInstaller 会错误地排除 tkinter；作为源码数据显式打入包中。
    "--add-data", f"{TK_FILES['tkinter']}{os.pathsep}tkinter",
    "--add-data", f"{TK_FILES['tcl8.6']}{os.pathsep}_tcl_data",
    "--add-data", f"{TK_FILES['tk8.6']}{os.pathsep}_tk_data",
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
