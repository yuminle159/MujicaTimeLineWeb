# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

datas = [('F:\\mujicatimelineweb\\generate_all.py', '.'), ('C:\\Users\\YUMIN\\AppData\\Local\\Python\\pythoncore-3.14-64\\Lib\\tkinter', 'tkinter'), ('C:\\Users\\YUMIN\\AppData\\Local\\Python\\pythoncore-3.14-64\\tcl\\tcl8.6', '_tcl_data'), ('C:\\Users\\YUMIN\\AppData\\Local\\Python\\pythoncore-3.14-64\\tcl\\tk8.6', '_tk_data')]
binaries = [('C:\\Users\\YUMIN\\AppData\\Local\\Python\\pythoncore-3.14-64\\DLLs\\_tkinter.pyd', '.'), ('C:\\Users\\YUMIN\\AppData\\Local\\Python\\pythoncore-3.14-64\\DLLs\\tcl86t.dll', '.'), ('C:\\Users\\YUMIN\\AppData\\Local\\Python\\pythoncore-3.14-64\\DLLs\\tk86t.dll', '.')]
hiddenimports = ['openpyxl', 'openpyxl.cell', 'openpyxl.worksheet', 'PIL', 'PIL.Image', 'tkinter', 'tkinter.ttk', '_tkinter']
tmp_ret = collect_all('sudachipy')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('sudachidict_small')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('jieba')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]


a = Analysis(
    ['F:\\mujicatimelineweb\\build_gui.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=['F:\\mujicatimelineweb\\tk_runtime_hook.py'],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='wijipedia_数据更新工具',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
