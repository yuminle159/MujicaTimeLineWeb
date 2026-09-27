"""Capture console window events and related process ancestry, without opening a window.

Run with pythonw.exe. Exits after 15 minutes or when a sibling .stop file exists.
No screenshots, environment variables, or process command lines are collected.
"""
import ctypes as c
from ctypes import wintypes as w
from datetime import datetime
import json
from pathlib import Path
import time
import traceback
import argparse

BASE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--label', default='console-events')
parser.add_argument('--duration', type=int, default=900)
args = parser.parse_args()
if not args.label.replace('-', '').isalnum():
    raise ValueError('Label must contain only letters, digits and hyphens')
OUT = BASE / (args.label + '.jsonl')
STOP = BASE / (args.label + '.stop')
u = c.WinDLL('user32', use_last_error=True)
k = c.WinDLL('kernel32', use_last_error=True)
CALLBACK = c.WINFUNCTYPE(None, w.HANDLE, w.DWORD, w.HWND, w.LONG, w.LONG, w.DWORD, w.DWORD)
ENUM = c.WINFUNCTYPE(w.BOOL, w.HWND, w.LPARAM)

class PROCESSENTRY32W(c.Structure):
    _fields_ = [('dwSize', w.DWORD), ('cntUsage', w.DWORD), ('th32ProcessID', w.DWORD),
                ('th32DefaultHeapID', c.c_size_t), ('th32ModuleID', w.DWORD),
                ('cntThreads', w.DWORD), ('th32ParentProcessID', w.DWORD),
                ('pcPriClassBase', w.LONG), ('dwFlags', w.DWORD), ('szExeFile', w.WCHAR * 260)]

k.CreateToolhelp32Snapshot.argtypes = [w.DWORD, w.DWORD]
k.CreateToolhelp32Snapshot.restype = w.HANDLE
k.Process32FirstW.argtypes = [w.HANDLE, c.POINTER(PROCESSENTRY32W)]
k.Process32NextW.argtypes = [w.HANDLE, c.POINTER(PROCESSENTRY32W)]
k.CloseHandle.argtypes = [w.HANDLE]
k.OpenProcess.argtypes = [w.DWORD, w.BOOL, w.DWORD]
k.OpenProcess.restype = w.HANDLE
k.QueryFullProcessImageNameW.argtypes = [w.HANDLE, w.DWORD, w.LPWSTR, c.POINTER(w.DWORD)]
u.SetWinEventHook.argtypes = [w.DWORD, w.DWORD, w.HMODULE, CALLBACK, w.DWORD, w.DWORD, w.DWORD]
u.SetWinEventHook.restype = w.HANDLE
u.UnhookWinEvent.argtypes = [w.HANDLE]
u.EnumWindows.argtypes = [ENUM, w.LPARAM]
u.GetWindowThreadProcessId.argtypes = [w.HWND, c.POINTER(w.DWORD)]
u.GetClassNameW.argtypes = [w.HWND, w.LPWSTR, c.c_int]
u.GetWindowTextW.argtypes = [w.HWND, w.LPWSTR, c.c_int]
u.IsWindowVisible.argtypes = [w.HWND]
u.PeekMessageW.argtypes = [c.POINTER(w.MSG), w.HWND, w.UINT, w.UINT, w.UINT]
u.TranslateMessage.argtypes = [c.POINTER(w.MSG)]
u.DispatchMessageW.argtypes = [c.POINTER(w.MSG)]
u.DispatchMessageW.restype = c.c_ssize_t

cache = {}
known_windows = {}
interesting = ('cmd.exe', 'conhost.exe', 'openconsole.exe', 'windowsterminal.exe',
               'powershell.exe', 'pwsh.exe', 'git.exe', 'node.exe', 'node_repl.exe',
               'python.exe', 'pythonw.exe', 'rg.exe', 'bash.exe', 'sh.exe')

def emit(kind, **data):
    with OUT.open('a', encoding='utf-8') as stream:
        stream.write(json.dumps(dict(time=datetime.now().isoformat(timespec='milliseconds'),
                                     kind=kind, **data), ensure_ascii=True) + '\n')

def snapshot():
    result = {}
    handle = k.CreateToolhelp32Snapshot(2, 0)
    if handle == c.c_void_p(-1).value:
        raise c.WinError(c.get_last_error())
    try:
        item = PROCESSENTRY32W()
        item.dwSize = c.sizeof(item)
        ok = k.Process32FirstW(handle, c.byref(item))
        while ok:
            result[item.th32ProcessID] = dict(pid=item.th32ProcessID,
                parent_pid=item.th32ParentProcessID, name=item.szExeFile)
            ok = k.Process32NextW(handle, c.byref(item))
    finally:
        k.CloseHandle(handle)
    return result

def image_path(pid):
    handle = k.OpenProcess(0x1000, False, pid)
    if not handle:
        return None
    try:
        buf = c.create_unicode_buffer(32768)
        length = w.DWORD(len(buf))
        if k.QueryFullProcessImageNameW(handle, 0, buf, c.byref(length)):
            return buf.value
    finally:
        k.CloseHandle(handle)

def ancestry(pid):
    result = []
    visited = set()
    while pid and pid not in visited and len(result) < 8:
        visited.add(pid)
        proc = dict(cache.get(pid, {'pid': pid}))
        proc['path'] = image_path(pid)
        result.append(proc)
        pid = proc.get('parent_pid')
    return result

def inspect_window(hwnd, event, event_time=None):
    if not hwnd:
        return
    name = c.create_unicode_buffer(256)
    u.GetClassNameW(hwnd, name, len(name))
    if name.value not in ('ConsoleWindowClass', 'CASCADIA_HOSTING_WINDOW_CLASS') and hwnd not in known_windows:
        return
    pid = w.DWORD()
    u.GetWindowThreadProcessId(hwnd, c.byref(pid))
    title = c.create_unicode_buffer(1024)
    u.GetWindowTextW(hwnd, title, len(title))
    # Snapshot at event time so even brief processes can be attributed.
    cache.update(snapshot())
    details = dict(hwnd=hwnd, pid=pid.value, window_class=name.value,
                   title=title.value, visible=bool(u.IsWindowVisible(hwnd)))
    if event == 'destroy':
        details['previous'] = known_windows.pop(hwnd, None)
    else:
        known_windows[hwnd] = details.copy()
    emit('window', event=event, event_tick=event_time,
         ancestry=ancestry(pid.value), **details)

@CALLBACK
def on_event(hook, event, hwnd, object_id, child_id, thread_id, event_time):
    try:
        if object_id == 0 and child_id == 0:
            inspect_window(hwnd, {0x8000: 'create', 0x8001: 'destroy',
                           0x8002: 'show', 0x8003: 'hide'}.get(event, hex(event)), event_time)
    except Exception:
        emit('error', detail=traceback.format_exc())

@ENUM
def initial_window(hwnd, _):
    try:
        inspect_window(hwnd, 'baseline')
    except Exception:
        emit('error', detail=traceback.format_exc())
    return True

def main():
    previous = snapshot()
    cache.update(previous)
    hook = u.SetWinEventHook(0x8000, 0x8003, None, on_event, 0, 0, 0)
    if not hook:
        raise c.WinError(c.get_last_error())
    try:
        u.EnumWindows(initial_window, 0)
        emit('ready', monitor_pid=k.GetCurrentProcessId(), duration_seconds=args.duration,
             process_baseline=[p for p in previous.values()
                               if p['name'].lower() in interesting or 'codex' in p['name'].lower()])
        deadline = time.monotonic() + args.duration
        next_scan = 0
        next_heartbeat = time.monotonic() + 30
        msg = w.MSG()
        while time.monotonic() < deadline and not STOP.exists():
            while u.PeekMessageW(c.byref(msg), None, 0, 0, 1):
                u.TranslateMessage(c.byref(msg))
                u.DispatchMessageW(c.byref(msg))
            now = time.monotonic()
            if now >= next_scan:
                current = snapshot()
                cache.update(current)
                for pid in current.keys() - previous.keys():
                    proc = current[pid]
                    if proc['name'].lower() in interesting or 'codex' in proc['name'].lower():
                        emit('process_observed', **proc, ancestry=ancestry(pid))
                previous = current
                next_scan = now + 0.05
            if now >= next_heartbeat:
                emit('heartbeat')
                next_heartbeat = now + 30
            time.sleep(0.005)
    finally:
        u.UnhookWinEvent(hook)
        emit('stopped')

if __name__ == '__main__':
    try:
        main()
    except Exception:
        emit('fatal', detail=traceback.format_exc())
