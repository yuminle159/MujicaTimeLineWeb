"""
 wijipedia 数据更新工具
 自动发现子目录中的 generate_data.py 并执行
"""
import os
import sys
import io
import runpy
import tkinter as tk
from tkinter import ttk, messagebox

BASE_DIR = os.path.dirname(os.path.abspath(sys.argv[0] if getattr(sys, 'frozen', False) else __file__))

# 页面名称映射
PAGE_NAMES = {
    "timeline": "Timeline（时间线）",
    "songs": "Songs（曲目）",
    "live": "Live（演唱会）",
}


def discover_pages():
    """扫描子目录，找到所有包含 generate_data.py 的页面"""
    pages = []
    for name in os.listdir(BASE_DIR):
        path = os.path.join(BASE_DIR, name)
        if os.path.isdir(path) and not name.startswith(".") and not name.startswith("_"):
            gen = os.path.join(path, "generate_data.py")
            xlsx = os.path.join(path, "data.xlsx")
            if os.path.isfile(gen):
                pages.append({
                    "id": name,
                    "label": PAGE_NAMES.get(name, f"{name}"),
                    "dir": path,
                    "has_xlsx": os.path.isfile(xlsx),
                })
    return sorted(pages, key=lambda p: p["label"])


def run_script(page, log_func):
    """运行单个页面的 generate_data.py（使用 runpy，共享当前进程的 Python 环境）"""
    gen = os.path.join(page["dir"], "generate_data.py")
    log_func(f"\n{'='*50}")
    log_func(f"  更新 {page['label']}")
    log_func(f"{'='*50}")
    try:
        # 捕获 stdout
        old_stdout = sys.stdout
        sys.stdout = io.StringIO()
        old_cwd = os.getcwd()
        os.chdir(page["dir"])
        try:
            runpy.run_path(gen, run_name="__main__")
        finally:
            os.chdir(old_cwd)
            output = sys.stdout.getvalue()
            sys.stdout = old_stdout
        if output.strip():
            log_func(output.strip())
        log_func(f"[OK] {page['label']} - 更新完成")
    except Exception as e:
        log_func(f"[FAIL] {page['label']} - 错误: {e}")


class App:
    def __init__(self, root):
        self.root = root
        root.title(" wijipedia 数据更新工具")
        root.geometry("560x520")
        root.resizable(True, True)
        root.configure(bg="#0d0d0d")

        # 标题
        header = tk.Label(
            root, text=" wijipedia 数据更新工具",
            font=("Microsoft YaHei", 14, "bold"),
            fg="#ff4d4d", bg="#0d0d0d",
        )
        header.pack(pady=(16, 4))

        sub = tk.Label(
            root, text="选择要更新的页面，点击下方按钮执行",
            font=("Microsoft YaHei", 9),
            fg="#666", bg="#0d0d0d",
        )
        sub.pack(pady=(0, 12))

        # 页面选择区域
        self.pages = discover_pages()
        self.vars = {}
        self.cbs = {}

        frame = tk.Frame(root, bg="#0d0d0d")
        frame.pack(fill="x", padx=24)

        if not self.pages:
            tk.Label(frame, text="未找到任何 generate_data.py", fg="#999", bg="#0d0d0d",
                     font=("Microsoft YaHei", 10)).pack()
        else:
            for i, p in enumerate(self.pages):
                var = tk.BooleanVar(value=True)
                self.vars[p["id"]] = var
                cb = tk.Checkbutton(
                    frame,
                    text=p["label"],
                    variable=var,
                    font=("Microsoft YaHei", 10),
                    fg="#ddd", bg="#0d0d0d",
                    selectcolor="#0d0d0d",
                    activebackground="#0d0d0d",
                    activeforeground="#ff4d4d",
                )
                cb.pack(anchor="w", pady=2)
                self.cbs[p["id"]] = cb

            # 全选 / 取消
            btn_frame = tk.Frame(root, bg="#0d0d0d")
            btn_frame.pack(pady=(8, 0))

            btn_all = tk.Button(
                btn_frame, text="全选", command=self.select_all,
                font=("Microsoft YaHei", 9), fg="#ddd", bg="#1a1a1a",
                relief="flat", padx=12, pady=4, cursor="hand2",
                activebackground="#2a2a2a", activeforeground="#fff",
            )
            btn_all.pack(side="left", padx=4)

            btn_none = tk.Button(
                btn_frame, text="取消全选", command=self.deselect_all,
                font=("Microsoft YaHei", 9), fg="#ddd", bg="#1a1a1a",
                relief="flat", padx=12, pady=4, cursor="hand2",
                activebackground="#2a2a2a", activeforeground="#fff",
            )
            btn_none.pack(side="left", padx=4)

        # 执行按钮
        btn_build = tk.Button(
            root, text="更新选中页面", command=self.build_selected,
            font=("Microsoft YaHei", 11, "bold"),
            fg="#fff", bg="#ff4d4d",
            relief="flat", padx=24, pady=8, cursor="hand2",
            activebackground="#ff8080", activeforeground="#fff",
        )
        btn_build.pack(pady=(12, 8))

        # 输出日志
        self.output = tk.Text(
            root, height=12, font=("Consolas", 9),
            bg="#141414", fg="#aaa",
            relief="flat", padx=10, pady=8,
            highlightthickness=1, highlightcolor="#2a2a2a", highlightbackground="#2a2a2a",
        )
        self.output.pack(fill="both", expand=True, padx=24, pady=(0, 16))
        self.output.insert("end", "就绪。\n")

    def select_all(self):
        for v in self.vars.values():
            v.set(True)

    def deselect_all(self):
        for v in self.vars.values():
            v.set(False)

    def log(self, msg):
        self.output.insert("end", msg + "\n")
        self.output.see("end")
        self.root.update()

    def build_selected(self):
        selected = [p for p in self.pages if self.vars[p["id"]].get()]
        if not selected:
            messagebox.showwarning("未选择", "请至少选择一个页面。")
            return

        self.output.delete("1.0", "end")
        self.log("开始更新...")
        for p in selected:
            run_script(p, self.log)
        self.log(f"\n{'='*50}")
        self.log(f"  更新完毕！请刷新浏览器查看变化。")
        self.log(f"{'='*50}")


def main():
    root = tk.Tk()
    App(root)
    root.mainloop()


if __name__ == "__main__":
    main()