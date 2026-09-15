"""
 wijipedia 数据更新工具
 统一数据生成 + 图片转 WebP
"""
import os
import sys
import io
import logging
# Reapply the extended Tcl paths after PyInstaller's standard runtime hook.
import tk_runtime_hook
import tkinter as tk
from tkinter import ttk, messagebox

try:
    from PIL import Image
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False

# PyInstaller --onefile 会将数据文件解压到临时目录
if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
    PROJECT_DIR = os.path.dirname(sys.executable)  # exe 所在目录（用于输出 JS 文件）
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    PROJECT_DIR = BASE_DIR

# 模块名称映射
MODULE_NAMES = {
    "announcements":     "公告",
    "something_new":     "首页精选（Something New）",
    "songs":             "歌曲（Songs）",
    "lives":             "演唱会（Live）",
    "timeline":          "时间线（Timeline）",
    "gallery_images":    "画廊（Gallery）",
    "interview":         "访谈（Interview）",
    "discography_releases": "唱片目录（Discography）",
}


def convert_images_to_webp(folder_path, log_func=None):
    """将文件夹中的图片转为 WebP 格式并压缩（max_width=1920, quality=75, method=6）
    已存在同名 .webp 的文件始终跳过，避免重复转换和覆盖已有图片。
    """
    def log(msg):
        (log_func or print)(msg)

    if not os.path.isdir(folder_path):
        log(f"  [跳过] 目录不存在: {folder_path}")
        return 0

    supported_formats = ('.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.tif')
    converted = 0
    for filename in os.listdir(folder_path):
        if not filename.lower().endswith(supported_formats):
            continue
        if filename.lower().endswith('.webp'):
            continue

        file_path = os.path.join(folder_path, filename)
        name_without_ext = os.path.splitext(filename)[0]
        webp_path = os.path.join(folder_path, f"{name_without_ext}.webp")

        # 跳过已存在 webp 的文件
        if os.path.abspath(file_path) != os.path.abspath(webp_path) and os.path.exists(webp_path):
            continue

        temp_path = webp_path + ".tmp"
        orig_size_kb = os.path.getsize(file_path) / 1024 if os.path.exists(file_path) else 0

        try:
            with Image.open(file_path) as img:
                if img.mode not in ('RGB', 'RGBA'):
                    img = img.convert('RGBA')

                # 缩放
                max_width = 1920
                if img.width > max_width:
                    new_h = int(img.height * (max_width / img.width))
                    img = img.resize((max_width, new_h), Image.Resampling.LANCZOS)
                    log(f"    [缩放] {filename}: {img.width}x{img.height} -> {max_width}x{new_h}")

                img.save(temp_path, 'webp', quality=75, method=6)

            new_size_kb = os.path.getsize(temp_path) / 1024
            os.replace(temp_path, webp_path)
            log(f"    {filename} ({orig_size_kb:.1f}KB -> {new_size_kb:.1f}KB)")
            converted += 1
        except Exception as e:
            log(f"    [失败] {filename}: {e}")
            if os.path.exists(temp_path):
                os.remove(temp_path)
    return converted


def discover_sheets():
    """扫描 _data/data.xlsx，返回可用模块列表"""
    xlsx_path = os.path.join(PROJECT_DIR, "_data", "data.xlsx")
    if not os.path.exists(xlsx_path):
        return []
    try:
        import openpyxl
        wb = openpyxl.load_workbook(xlsx_path)
        sheets = wb.sheetnames
        wb.close()
        modules = []
        for sn in sheets:
            if sn in MODULE_NAMES:
                modules.append({"id": sn, "label": MODULE_NAMES[sn]})
        return modules
    except Exception:
        return []


class CapturedOperationError(Exception):
    def __init__(self, cause, output):
        super().__init__(str(cause))
        self.cause = cause
        self.output = output


def capture_output(operation):
    """捕获生成器的附加输出，避免默认日志被依赖库的内部信息淹没。"""
    old_stdout, old_stderr = sys.stdout, sys.stderr
    stream = io.StringIO()
    # 库可能在导入时已将日志绑定到 windowed exe 的空 stderr。
    # 重定向 sys.stderr 不会更新这些现有处理器，需临时同步其输出流。
    redirected_handlers = []
    loggers = [logging.getLogger()] + [
        logger for logger in list(logging.Logger.manager.loggerDict.values())
        if isinstance(logger, logging.Logger)
    ]
    seen_handlers = set()
    for logger in loggers:
        for handler in logger.handlers:
            if (id(handler) not in seen_handlers
                    and isinstance(handler, logging.StreamHandler)
                    and not isinstance(handler, logging.FileHandler)
                    and (handler.stream is None or handler.stream is old_stdout
                         or handler.stream is old_stderr)):
                seen_handlers.add(id(handler))
                redirected_handlers.append((handler, handler.stream))
                handler.setStream(stream)
    sys.stdout = stream
    sys.stderr = stream
    try:
        return operation(), stream.getvalue().strip()
    except Exception as exc:
        raise CapturedOperationError(exc, stream.getvalue().strip()) from exc
    finally:
        for handler, previous_stream in redirected_handlers:
            handler.setStream(previous_stream)
        sys.stdout, sys.stderr = old_stdout, old_stderr


def run_update(selected_modules, do_webp, log_func):
    """执行更新并返回可供界面汇总的结构化结果。"""
    result = {"success": [], "skipped": [], "failed": [], "details": []}

    def add_detail(title, output):
        if output.strip():
            result["details"].append((title, output.strip()))

    if do_webp:
        if not HAS_PILLOW:
            result["failed"].append(("图片转 WebP", "缺少 Pillow 依赖"))
            log_func("[FAIL] 图片转 WebP：缺少 Pillow 依赖")
        else:
            for folder_name in ["images", "icons"]:
                details = []
                try:
                    count = convert_images_to_webp(
                        os.path.join(PROJECT_DIR, folder_name), log_func=details.append
                    )
                    add_detail(f"图片转 WebP / {folder_name}", "\n".join(details))
                    result["success"].append((f"图片转 WebP / {folder_name}", f"转换 {count} 张"))
                    log_func(f"[OK] 图片转 WebP / {folder_name}：转换 {count} 张")
                except Exception as exc:
                    result["failed"].append((f"图片转 WebP / {folder_name}", str(exc)))
                    log_func(f"[FAIL] 图片转 WebP / {folder_name}：{exc}")

    if not selected_modules:
        return result

    gen_path = os.path.join(BASE_DIR, "generate_all.py")
    if not os.path.exists(gen_path):
        result["failed"].append(("数据生成器", "找不到 generate_all.py"))
        log_func("[FAIL] 数据生成器：找不到 generate_all.py")
        return result

    sys.path.insert(0, BASE_DIR)
    try:
        import generate_all
        import openpyxl
        xlsx_path = os.path.join(PROJECT_DIR, "_data", "data.xlsx")
        try:
            wb = openpyxl.load_workbook(xlsx_path, data_only=True)
        except Exception as exc:
            result["failed"].append(("读取 data.xlsx", str(exc)))
            log_func(f"[FAIL] 读取 data.xlsx：{exc}")
            return result

        try:
            sheets = wb.sheetnames
            for mod_id in selected_modules:
                label = MODULE_NAMES.get(mod_id, mod_id)

                def generate_module():
                    if mod_id == "announcements" and "announcements" in sheets:
                        return f"announcements.js · {generate_all.generate_announcements(wb)} 条公告"
                    if mod_id == "something_new" and "something_new" in sheets:
                        return f"something-new.js · {generate_all.generate_something_new(wb)} 条精选内容"
                    if mod_id == "songs" and "songs" in sheets:
                        return f"songs/data.js · {generate_all.generate_songs(wb)} 首歌曲"
                    if mod_id == "lives" and "lives" in sheets:
                        count, mc = generate_all.generate_live(wb)
                        return f"live/data.js · {count} 场演唱会" + (f" · {mc} 个 MC" if mc else "")
                    if mod_id == "timeline" and "timeline" in sheets:
                        return f"timeline/data.js · {generate_all.generate_timeline(wb)} 条事件"
                    if mod_id == "gallery_images" and "gallery_images" in sheets:
                        return f"gallery/data.js · {generate_all.generate_gallery(wb)} 张图片"
                    if mod_id == "interview" and "interview" in sheets:
                        return f"interview/data.js · {generate_all.generate_interview(wb)} 篇访谈"
                    if mod_id == "discography_releases" and "discography_releases" in sheets:
                        return f"discography/data.js · {generate_all.generate_discography(wb)} 张发行作品"
                    return None

                try:
                    summary, output = capture_output(generate_module)
                    add_detail(label, output)
                    if summary is None:
                        result["skipped"].append((label, "缺少对应 sheet"))
                        log_func(f"[SKIP] {label}：缺少对应 sheet")
                    else:
                        result["success"].append((label, summary))
                        log_func(f"[OK] {label}：{summary}")
                except CapturedOperationError as exc:
                    add_detail(label, exc.output)
                    result["failed"].append((label, str(exc.cause)))
                    log_func(f"[FAIL] {label}：{exc.cause}")

            try:
                version, output = capture_output(lambda: generate_all.inject_version())
                add_detail("版本号注入", output)
                result["success"].append(("版本号注入", f"v={version}"))
                log_func(f"[OK] 版本号注入：v={version}")
            except Exception as exc:
                result["failed"].append(("版本号注入", str(exc)))
                log_func(f"[FAIL] 版本号注入：{exc}")
        finally:
            wb.close()
    finally:
        sys.path.remove(BASE_DIR)

    return result


class App:
    def __init__(self, root):
        self.root = root
        root.title(" wijipedia 数据更新工具")
        root.geometry("760x760")
        root.minsize(680, 560)
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
            root, text="选择一个操作开始，更新过程和结果会显示在下方日志中",
            font=("Microsoft YaHei", 9),
            fg="#666", bg="#0d0d0d",
        )
        sub.pack(pady=(0, 12))

        # 数据源状态
        self.modules = discover_sheets()
        data_status = "已读取 data.xlsx" if self.modules else "未找到 _data/data.xlsx"
        tk.Label(root, text=data_status, font=("Microsoft YaHei", 9),
                 fg="#777" if self.modules else "#ff8080", bg="#0d0d0d").pack(pady=(0, 8))

        # 三个固定主操作
        btn_frame_actions = tk.Frame(root, bg="#0d0d0d")
        btn_frame_actions.pack(fill="x", padx=24, pady=(4, 16))

        btn_build = tk.Button(
            btn_frame_actions, text="更新所有 data", command=self.update_all_data,
            font=("Microsoft YaHei", 11, "bold"),
            fg="#fff", bg="#ff4d4d",
            relief="flat", padx=24, pady=8, cursor="hand2",
            activebackground="#ff8080", activeforeground="#fff",
        )
        btn_build.pack(side="left", expand=True, fill="x", padx=(0, 5))

        btn_webp = tk.Button(
            btn_frame_actions, text="把图片转为 WebP", command=self.convert_webp,
            font=("Microsoft YaHei", 10), fg="#ddd", bg="#1a1a1a",
            relief="flat", padx=16, pady=8, cursor="hand2",
            activebackground="#2a2a2a", activeforeground="#fff",
        )
        btn_webp.pack(side="left", expand=True, fill="x", padx=5)

        btn_scan = tk.Button(
            btn_frame_actions, text="一键把所有图片写入画廊", command=self.scan_gallery,
            font=("Microsoft YaHei", 10),
            fg="#ddd", bg="#1a1a1a",
            relief="flat", padx=16, pady=8, cursor="hand2",
            activebackground="#2a2a2a", activeforeground="#fff",
        )
        btn_scan.pack(side="left", expand=True, fill="x", padx=(5, 0))

        # 运行状态与折叠的详细日志
        status_frame = tk.Frame(root, bg="#141414", highlightthickness=1, highlightbackground="#2a2a2a")
        status_frame.pack(fill="x", padx=24, pady=(0, 12))
        self.status_var = tk.StringVar(value="就绪 · 等待开始更新")
        self.status_label = tk.Label(
            status_frame, textvariable=self.status_var, anchor="w",
            font=("Microsoft YaHei", 9, "bold"), fg="#aaa", bg="#141414", padx=12, pady=8,
        )
        self.status_label.pack(side="left", fill="x", expand=True)
        self.detail_button = tk.Button(
            status_frame, text="查看详细日志", command=self.show_details,
            font=("Microsoft YaHei", 8), fg="#aaa", bg="#202020", relief="flat",
            padx=10, pady=4, state="disabled", cursor="hand2",
            activebackground="#2a2a2a", activeforeground="#fff",
        )
        self.detail_button.pack(side="right", padx=6, pady=4)
        self.last_result = None

        # 输出日志
        log_frame = tk.Frame(root, bg="#0d0d0d")
        log_frame.pack(fill="both", expand=True, padx=24, pady=(0, 16))
        tk.Label(log_frame, text="运行日志", anchor="w", font=("Microsoft YaHei", 9),
                 fg="#999", bg="#0d0d0d").pack(fill="x", pady=(0, 5))
        output_frame = tk.Frame(log_frame, bg="#141414")
        output_frame.pack(fill="both", expand=True)
        scrollbar = tk.Scrollbar(output_frame, relief="flat")
        scrollbar.pack(side="right", fill="y")
        self.output = tk.Text(
            output_frame, height=20, font=("Consolas", 9),
            bg="#141414", fg="#aaa",
            relief="flat", padx=10, pady=8,
            highlightthickness=1, highlightcolor="#2a2a2a", highlightbackground="#2a2a2a",
            yscrollcommand=scrollbar.set,
        )
        self.output.pack(side="left", fill="both", expand=True)
        scrollbar.config(command=self.output.yview)
        self.output.tag_configure("success", foreground="#8fcf8f")
        self.output.tag_configure("warning", foreground="#e8c778")
        self.output.tag_configure("error", foreground="#ff8080")
        self.output.tag_configure("detail", foreground="#777")
        self.output.insert("end", "就绪。\n")

    def log(self, msg, tag=None):
        if tag is None:
            tag = "success" if msg.startswith("[OK]") else "error" if msg.startswith("[FAIL]") else "warning" if msg.startswith("[SKIP]") else None
        self.output.insert("end", msg + "\n", tag)
        self.output.see("end")
        self.root.update()

    def _start_log(self, title):
        self.output.delete("1.0", "end")
        self.last_result = None
        self.detail_button.config(text="查看详细日志", state="disabled")
        self.status_var.set("正在运行…")
        self.status_label.config(fg="#e8c778")
        self.log(title + "\n")

    def finish_run(self, result, success_message):
        self.last_result = result
        success_count = len(result["success"])
        skipped_count = len(result["skipped"])
        failed_count = len(result["failed"])
        self.log("=" * 50, "detail")
        if result["details"]:
            self.detail_button.config(state="normal")
            self.log(f"[INFO] 已折叠 {len(result['details'])} 组附加日志，可点击右上角「查看详细日志」。", "detail")
        if failed_count:
            self.status_var.set(f"更新未完成 · 成功 {success_count} · 失败 {failed_count}")
            self.status_label.config(fg="#ff8080")
            self.log(f"[FAIL] 更新未完成：成功 {success_count} 项，失败 {failed_count} 项。", "error")
            for label, reason in result["failed"]:
                self.log(f"  - {label}：{reason}", "error")
        else:
            self.status_var.set(f"更新成功 · 已完成 {success_count} 项" + (f" · 跳过 {skipped_count} 项" if skipped_count else ""))
            self.status_label.config(fg="#8fcf8f")
            self.log(f"[OK] {success_message}（共 {success_count} 项）", "success")
        if skipped_count:
            for label, reason in result["skipped"]:
                self.log(f"  - {label}：{reason}", "warning")
        self.log("=" * 50, "detail")

    def show_details(self):
        if not self.last_result or not self.last_result["details"]:
            return
        self.log("\n----- 详细日志 -----", "detail")
        for title, output in self.last_result["details"]:
            self.log(f"[{title}]", "detail")
            for line in output.splitlines():
                self.log("  " + line, "detail")
        self.detail_button.config(text="已显示详细日志", state="disabled")

    def update_all_data(self):
        if not self.modules:
            messagebox.showwarning("无法更新", "未找到 _data/data.xlsx 或可用数据分页。")
            return
        self._start_log("开始更新所有 data...\n")

        try:
            result = run_update([m["id"] for m in self.modules], False, self.log)
        except Exception as e:
            result = {"success": [], "skipped": [], "failed": [("更新程序", str(e))], "details": []}
        self.finish_run(result, "所有 data 已更新，请刷新浏览器查看变化。")

    def convert_webp(self):
        if not HAS_PILLOW:
            messagebox.showwarning("无法转换", "缺少 Pillow，请先安装 Pillow。")
            return
        self._start_log("开始把图片转为 WebP...\n")
        try:
            result = run_update([], True, self.log)
        except Exception as e:
            result = {"success": [], "skipped": [], "failed": [("图片转 WebP", str(e))], "details": []}
        self.finish_run(result, "WebP 转换已完成。")

    def scan_gallery(self):
        self._start_log("开始把所有图片写入画廊...\n")
        try:
            sys.path.insert(0, BASE_DIR)
            import generate_all
            try:
                n = generate_all.scan_gallery_images(log_func=self.log)
                self.log("=" * 50)
                if n > 0:
                    self.log(f"  新增 {n} 张图片，已写入 gallery_images sheet。")
                    self.log("  接下来请点击「更新所有 data」来生成新的 gallery/data.js。")
                else:
                    self.log("  无新增图片。")
                self.log("=" * 50)
            finally:
                sys.path.remove(BASE_DIR)
        except Exception as e:
            self.log(f"[FAIL] 执行出错: {e}")


def main():
    if "--smoke-test-update" in sys.argv:
        import json
        import tempfile
        import generate_all
        # 验证实际更新流程，但把生成文件和版本注入放到临时目录。
        with tempfile.TemporaryDirectory() as test_dir:
            generate_all.ROOT = test_dir
            generate_all.OUTPUTS = {
                key: os.path.join(test_dir, os.path.relpath(path, PROJECT_DIR))
                for key, path in generate_all.OUTPUTS.items()
            }
            for path in generate_all.OUTPUTS.values():
                os.makedirs(os.path.dirname(path), exist_ok=True)
            result = run_update([m["id"] for m in discover_sheets()], False, lambda msg: None)
            if result["failed"] or len(result["success"]) != 9:
                raise RuntimeError(json.dumps(result, ensure_ascii=False))
            if any("--- Logging error ---" in output or "Traceback (most recent call last)" in output
                   for _, output in result["details"]):
                raise RuntimeError(json.dumps(result, ensure_ascii=False))
            with open(os.path.join(PROJECT_DIR, "exe-update-test.log"), "w", encoding="utf-8") as log:
                log.write(json.dumps(result, ensure_ascii=False, indent=2))
        return
    if "--smoke-test-nlp" in sys.argv:
        test_root = tk.Tk()
        test_root.withdraw()
        test_root.update_idletasks()
        test_root.destroy()
        sys.path.insert(0, BASE_DIR)
        try:
            import generate_all
            generate_all.require_lexicon_nlp()
            tokenizer = generate_all.Dictionary(dict="small").create()
            if not generate_all.japanese_lexicon_tokens("月明かりの世界を歩く", tokenizer):
                raise RuntimeError("日文分词未返回结果")
            if not generate_all.chinese_lexicon_tokens("月光照亮世界"):
                raise RuntimeError("中文分词未返回结果")
        finally:
            sys.path.remove(BASE_DIR)
        return

    root = tk.Tk()
    App(root)
    root.mainloop()


if __name__ == "__main__":
    if "--smoke-test-nlp" in sys.argv or "--smoke-test-update" in sys.argv:
        import traceback
        log_path = os.path.join(PROJECT_DIR, "exe-update-test.log" if "--smoke-test-update" in sys.argv else "exe-smoke-test.log")
        try:
            main()
        except Exception:
            with open(log_path, "w", encoding="utf-8") as log:
                log.write(traceback.format_exc())
            sys.exit(1)
        if "--smoke-test-nlp" in sys.argv:
            with open(log_path, "w", encoding="utf-8") as log:
                log.write("OK: Tk and NLP smoke test passed.\n")
    else:
        main()
