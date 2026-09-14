# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

datas = [('D:/yumin/web/MujicaTimeLineWeb/generate_all.py', '.'), ('C:/Users/yumin/AppData/Local/Programs/Python/Python313/tcl/tcl8.6', 'tcl/tcl8.6'), ('C:/Users/yumin/AppData/Local/Programs/Python/Python313/tcl/tk8.6', 'tcl/tk8.6')]
binaries = [('C:/Users/yumin/AppData/Local/Programs/Python/Python313/DLLs/_tkinter.pyd', '.'), ('C:/Users/yumin/AppData/Local/Programs/Python/Python313/DLLs/tcl86t.dll', '.'), ('C:/Users/yumin/AppData/Local/Programs/Python/Python313/DLLs/tk86t.dll', '.')]
hiddenimports = ['openpyxl', 'openpyxl.cell', 'openpyxl.worksheet', 'PIL', 'PIL.Image', 'tkinter', 'tkinter.ttk', '_tkinter']
tmp_ret = collect_all('sudachipy')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('sudachidict_small')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('jieba')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]


a = Analysis(
    ['D:/yumin/web/MujicaTimeLineWeb/build_gui.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=['D:/yumin/web/MujicaTimeLineWeb/tk_runtime_hook.py'],
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
    name='wijipedia_数据更新工具_修复版',
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
