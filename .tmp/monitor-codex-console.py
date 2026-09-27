"""Read-only monitoring of visible Windows console windows for 20 seconds."""
import ctypes
import time
from ctypes import wintypes

user32 = ctypes.windll.user32
callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
user32.EnumWindows.argtypes = [callback_type, wintypes.LPARAM]
user32.IsWindowVisible.argtypes = [wintypes.HWND]
user32.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
seen = set()

def visit(handle, _):
    window_class = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(handle, window_class, 256)
    if window_class.value in ('ConsoleWindowClass', 'CASCADIA_HOSTING_WINDOW_CLASS') and user32.IsWindowVisible(handle):
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(handle, ctypes.byref(pid))
        title = ctypes.create_unicode_buffer(512)
        user32.GetWindowTextW(handle, title, 512)
        key = (handle, pid.value)
        if key not in seen:
            seen.add(key)
            print(time.strftime('%H:%M:%S'), pid.value, window_class.value, ascii(title.value), flush=True)
    return True

callback = callback_type(visit)
end = time.monotonic() + 20
while time.monotonic() < end:
    user32.EnumWindows(callback, 0)
    time.sleep(0.05)
print('Visible console windows observed:', len(seen))
