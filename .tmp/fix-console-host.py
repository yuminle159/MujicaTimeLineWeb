r"""Set the current user's default console host, preserving the previous values.

Usage: python fix-console-host.py apply|restore
Only HKCU\Console\%%Startup's two terminal delegation values are changed.
"""
import getpass
import json
from datetime import datetime
from pathlib import Path
import sys
import winreg

KEY = r'Console\%%Startup'
NAMES = ('DelegationConsole', 'DelegationTerminal')
CONHOST = '{B23D10C0-E52E-411E-9D5B-C09FDF709C7D}'
BACKUP = Path(__file__).resolve().with_name('console-host-settings-backup.json')
if getpass.getuser().casefold() != 'yumin':
    raise SystemExit('Run as YUMIN, outside the Codex sandbox.')

def read_values():
    values = {}
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, KEY)
    except FileNotFoundError:
        return {name: None for name in NAMES}
    with key:
        for name in NAMES:
            try:
                value, kind = winreg.QueryValueEx(key, name)
                values[name] = {'value': value, 'type': kind}
            except FileNotFoundError:
                values[name] = None
    return values

def write_values(values):
    with winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, KEY, 0, winreg.KEY_SET_VALUE) as key:
        for name in NAMES:
            previous = values[name]
            if previous is None:
                try:
                    winreg.DeleteValue(key, name)
                except FileNotFoundError:
                    pass
            else:
                winreg.SetValueEx(key, name, 0, previous['type'], previous['value'])

mode = sys.argv[1] if len(sys.argv) == 2 else ''
if mode == 'apply':
    if BACKUP.exists():
        raise SystemExit('Backup already exists; refusing to overwrite the original settings.')
    old = read_values()
    BACKUP.write_text(json.dumps({'time': datetime.now().isoformat(), 'user': getpass.getuser(),
                                  'key': KEY, 'values': old}, indent=2), encoding='utf-8')
    try:
        expected = {name: {'value': CONHOST, 'type': winreg.REG_SZ} for name in NAMES}
        write_values(expected)
        if read_values() != expected:
            raise RuntimeError('Registry verification failed')
    except Exception:
        write_values(old)
        raise
elif mode == 'restore':
    backup = json.loads(BACKUP.read_text(encoding='utf-8'))
    if backup['user'].casefold() != getpass.getuser().casefold() or backup['key'] != KEY:
        raise SystemExit('Backup owner/key mismatch')
    write_values(backup['values'])
    if read_values() != backup['values']:
        raise RuntimeError('Restore verification failed')
else:
    raise SystemExit('Usage: python fix-console-host.py apply|restore')
print(json.dumps({'action': mode, 'time': datetime.now().isoformat(), 'settings': read_values(),
                  'backup': str(BACKUP)}, ensure_ascii=True))
