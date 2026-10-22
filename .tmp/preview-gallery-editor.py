import sys
import ctypes
ctypes.windll.shcore.SetProcessDpiAwareness(2)
from pathlib import Path
root_path = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root_path))
import tk_runtime_hook
import tkinter as tk
from PIL import ImageGrab
from gallery_editor import GalleryEditor

root = tk.Tk()
root.withdraw()
editor = GalleryEditor(root, root_path)
editor.geometry('1200x820+30+30')
editor.attributes('-topmost', True)
def capture():
    editor.update_idletasks()
    x, y = editor.winfo_rootx(), editor.winfo_rooty()
    ImageGrab.grab((x, y, x + editor.winfo_width(), y + editor.winfo_height())).save(root_path / '.tmp/gallery-editor-preview.png')
    editor.close()
    root.destroy()
root.after(2000, capture)
root.mainloop()
