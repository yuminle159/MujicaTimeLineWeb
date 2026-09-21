"""
 wijipedia 数据更新工具
 统一数据生成 + 图片转 WebP
"""
import os
import sys
import io
import logging
import subprocess
import threading
import tempfile
from pathlib import Path
# Reapply the extended Tcl paths after PyInstaller's standard runtime hook.
import tk_runtime_hook
import tkinter as tk
from tkinter import ttk, messagebox, simpledialog

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

# 发布模块在源码模式下默认使用自身目录；打包后则必须显式指向 EXE 所在的项目目录。
import build_site
import publish_deploy

build_site.ROOT = Path(PROJECT_DIR)
build_site.DIST = build_site.ROOT / "dist"
publish_deploy.ROOT = Path(PROJECT_DIR)

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


class WorkflowError(Exception):
    """可直接展示给用户的 Git 工作流错误。"""


class WorkflowStepError(WorkflowError):
    """记录失败步骤，并携带从该步骤继续执行所需的信息。"""

    def __init__(self, workflow_name, step_index, step_label, cause):
        self.workflow_name = workflow_name
        self.step_index = step_index
        self.step_label = step_label
        self.cause = cause
        self.retry_operation = None
        super().__init__(f"步骤「{step_label}」失败：\n{cause}")


class SelfUpdateRequired(Exception):
    """远端包含当前正在运行的 EXE，需要退出后由辅助进程完成更新。"""


def run_git_command(*arguments, check=True):
    """在项目目录执行 Git，并返回合并后的输出。"""
    creationflags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    try:
        completed = subprocess.run(
            ("git", *arguments),
            cwd=PROJECT_DIR,
            check=False,
            text=True,
            encoding="utf-8",
            errors="replace",
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            creationflags=creationflags,
        )
    except FileNotFoundError as exc:
        raise WorkflowError("找不到 Git。请先安装 Git，并确保 git 命令已加入 PATH。") from exc
    output = completed.stdout.strip()
    if check and completed.returncode != 0:
        command = "git " + " ".join(arguments)
        raise WorkflowError(f"{command} 执行失败：\n{output or '未知 Git 错误'}")
    return completed.returncode, output


def require_git_repository():
    code, output = run_git_command("rev-parse", "--show-toplevel", check=False)
    if code != 0:
        raise WorkflowError("EXE 所在目录不是 Git 仓库，请把工具放在项目根目录后重试。")
    if os.path.normcase(os.path.abspath(output)) != os.path.normcase(os.path.abspath(PROJECT_DIR)):
        raise WorkflowError(f"Git 仓库根目录与工具目录不一致：{output}")


def git_status():
    return run_git_command("status", "--porcelain", "--untracked-files=normal")[1]


def run_workflow_steps(workflow_name, steps, start_step, log_func):
    """从指定步骤执行工作流，并将失败位置包装为可重试错误。"""
    total = len(steps)
    for index in range(start_step, total):
        label, operation = steps[index]
        log_func(f"[步骤 {index + 1}/{total}] {label}…")
        try:
            operation()
        except SelfUpdateRequired:
            raise
        except Exception as exc:
            raise WorkflowStepError(workflow_name, index, label, exc) from exc
        log_func(f"[完成] {label}")


def run_start_workflow(log_func, start_step=0):
    """同步 main 与 deploy；工作区不干净时拒绝拉取。"""
    require_git_repository()

    def prepare_main():
        if git_status():
            raise WorkflowError("检测到未提交修改。请先处理上次留下的修改，再开始同步。")
        branch = run_git_command("branch", "--show-current")[1]
        if branch == "main":
            return
        log_func(f"当前分支为 {branch or 'detached HEAD'}，正在切换到 main…")
        _, output = run_git_command("switch", "main")
        if output:
            log_func(output)

    def fetch_main():
        _, output = run_git_command("fetch", "origin", "main")
        if output:
            log_func(output)
        changed_files = run_git_command("diff", "--name-only", "HEAD..origin/main")[1].splitlines()
        executable_name = os.path.basename(sys.executable)
        if getattr(sys, "frozen", False) and any(
            os.path.normcase(path.strip()) == os.path.normcase(executable_name)
            for path in changed_files
        ):
            raise SelfUpdateRequired()

    def merge_main():
        _, output = run_git_command("merge", "--ff-only", "origin/main")
        if output:
            log_func(output)

    def fetch_deploy():
        _, output = run_git_command("fetch", "origin", "deploy:deploy")
        if output:
            log_func(output)

    steps = (
        ("检查工作区并切换到 main", prepare_main),
        ("获取 origin/main", fetch_main),
        ("快进同步 main", merge_main),
        ("同步 deploy 发布基线", fetch_deploy),
    )
    try:
        run_workflow_steps("开始工作", steps, start_step, log_func)
    except WorkflowStepError as exc:
        exc.retry_operation = lambda retry_log, index=exc.step_index: run_start_workflow(retry_log, index)
        raise
    return "main 与 deploy 已同步，可以开始工作。"


def powershell_quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def create_self_update_helper():
    """创建一次性 PowerShell 助手，在当前 EXE 退出后更新并重新启动。"""
    if not getattr(sys, "frozen", False):
        raise WorkflowError("源码模式不需要 EXE 自更新。")
    descriptor, script_path = tempfile.mkstemp(prefix="wijipedia-self-update-", suffix=".ps1")
    os.close(descriptor)
    project = powershell_quote(PROJECT_DIR)
    executable = powershell_quote(sys.executable)
    script = f"""$ErrorActionPreference = 'Continue'
Wait-Process -Id {os.getpid()} -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Set-Location -LiteralPath {project}
$messages = New-Object System.Collections.Generic.List[string]
& git merge --ff-only origin/main 2>&1 | ForEach-Object {{ $messages.Add($_.ToString()) }}
$exitCode = $LASTEXITCODE
if ($exitCode -eq 0) {{
    & git fetch origin deploy:deploy 2>&1 | ForEach-Object {{ $messages.Add($_.ToString()) }}
    $exitCode = $LASTEXITCODE
}}
if ($exitCode -ne 0) {{
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(($messages -join "`n"), 'Git 同步失败', 'OK', 'Error') | Out-Null
}}
Start-Process -FilePath {executable}
Remove-Item -LiteralPath $PSCommandPath -Force
"""
    Path(script_path).write_text(script, encoding="utf-8-sig")
    return script_path


def run_finish_workflow(commit_message, log_func, start_step=0):
    """提交并推送 main，然后构建和推送 deploy。"""
    require_git_repository()
    branch = run_git_command("branch", "--show-current")[1]
    if branch != "main":
        raise WorkflowError(f"当前分支是 {branch or 'detached HEAD'}，请先回到 main。")

    def commit_main():
        status_before = git_status()
        if not status_before:
            log_func("工作区没有需要提交的源码修改。")
            return
        log_func("正在暂存全部工作区修改…")
        run_git_command("add", "-A")
        staged_code, _ = run_git_command("diff", "--cached", "--quiet", check=False)
        if staged_code not in (0, 1):
            raise WorkflowError("无法检查暂存区状态。")
        if staged_code == 1:
            log_func(f"正在提交：{commit_message}")
            _, output = run_git_command("commit", "-m", commit_message)
            if output:
                log_func(output)

    def pull_main():
        _, output = run_git_command("pull", "--rebase", "origin", "main")
        if output:
            log_func(output)

    def push_main():
        _, output = run_git_command("push", "origin", "main")
        if output:
            log_func(output)

    def fetch_deploy():
        _, output = run_git_command("fetch", "origin", "deploy:deploy")
        if output:
            log_func(output)

    def build_deploy():
        commit, changed = publish_deploy.create_deploy_commit(False)
        if changed:
            log_func(f"已生成 deploy 提交：{commit[:12]}")
        else:
            log_func("公开网站内容没有变化，无需创建新的 deploy 提交。")

    def push_deploy():
        _, output = run_git_command(
            "push", "origin", "refs/heads/deploy:refs/heads/deploy"
        )
        if output:
            log_func(output)

    steps = (
        ("提交本地修改", commit_main),
        ("变基同步 origin/main", pull_main),
        ("推送 main", push_main),
        ("同步 deploy 发布基线", fetch_deploy),
        ("生成并校验 deploy", build_deploy),
        ("推送 deploy", push_deploy),
    )
    try:
        run_workflow_steps("结束工作", steps, start_step, log_func)
    except WorkflowStepError as exc:
        exc.retry_operation = lambda retry_log, index=exc.step_index: run_finish_workflow(
            commit_message, retry_log, index
        )
        raise
    return "main 与 deploy 均已推送；服务器执行 git pull 即可上线。"


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
        root.title(" wijipedia 工作流工具")
        root.geometry("800x840")
        root.minsize(720, 640)
        root.resizable(True, True)
        root.configure(bg="#0d0d0d")
        self.action_buttons = []
        self.operation_running = False
        self.retry_operation = None
        self.retry_step_label = ""

        # 标题
        header = tk.Label(
            root, text=" wijipedia 工作流工具",
            font=("Microsoft YaHei", 14, "bold"),
            fg="#ff4d4d", bg="#0d0d0d",
        )
        header.pack(pady=(16, 4))

        sub = tk.Label(
            root, text="同步 Git、更新数据、提交源码并发布 deploy",
            font=("Microsoft YaHei", 9),
            fg="#666", bg="#0d0d0d",
        )
        sub.pack(pady=(0, 12))

        # 数据源状态
        self.modules = discover_sheets()
        data_status = "已读取 data.xlsx" if self.modules else "未找到 _data/data.xlsx"
        tk.Label(root, text=data_status, font=("Microsoft YaHei", 9),
                 fg="#777" if self.modules else "#ff8080", bg="#0d0d0d").pack(pady=(0, 8))

        # 完整工作流：同步 → 编辑/更新 → 提交并发布
        workflow_frame = tk.LabelFrame(
            root, text=" Git 工作流 ", font=("Microsoft YaHei", 9, "bold"),
            fg="#aaa", bg="#0d0d0d", bd=1, relief="solid",
            highlightbackground="#2a2a2a",
        )
        workflow_frame.pack(fill="x", padx=24, pady=(4, 14))
        workflow_buttons = tk.Frame(workflow_frame, bg="#0d0d0d")
        workflow_buttons.pack(fill="x", padx=10, pady=(10, 5))

        self.btn_start_work = tk.Button(
            workflow_buttons, text="① 开始工作 · 同步 Git", command=self.start_work,
            font=("Microsoft YaHei", 10, "bold"), fg="#ddd", bg="#202830",
            relief="flat", padx=18, pady=9, cursor="hand2",
            activebackground="#2d3a46", activeforeground="#fff",
        )
        self.btn_start_work.pack(side="left", expand=True, fill="x", padx=(0, 5))

        self.btn_finish_work = tk.Button(
            workflow_buttons, text="③ 结束工作 · 提交并发布", command=self.finish_work,
            font=("Microsoft YaHei", 10, "bold"), fg="#fff", bg="#9f2828",
            relief="flat", padx=18, pady=9, cursor="hand2",
            activebackground="#c43a3a", activeforeground="#fff",
        )
        self.btn_finish_work.pack(side="left", expand=True, fill="x", padx=(5, 0))

        self.btn_retry_work = tk.Button(
            workflow_frame, text="重试失败步骤及后续", command=self.retry_workflow,
            font=("Microsoft YaHei", 9, "bold"), fg="#777", bg="#171717",
            relief="flat", padx=18, pady=7, cursor="hand2", state="disabled",
            activebackground="#3a3020", activeforeground="#fff",
            disabledforeground="#555",
        )
        self.btn_retry_work.pack(fill="x", padx=10, pady=(5, 5))
        self.action_buttons.extend((self.btn_start_work, self.btn_finish_work, self.btn_retry_work))

        tk.Label(
            workflow_frame,
            text="开始：pull main + 同步 deploy　｜　结束：commit/push main + 构建/push deploy",
            font=("Microsoft YaHei", 8), fg="#666", bg="#0d0d0d",
        ).pack(pady=(0, 9))

        # 三个固定主操作
        btn_frame_actions = tk.Frame(root, bg="#0d0d0d")
        btn_frame_actions.pack(fill="x", padx=24, pady=(4, 16))

        btn_build = tk.Button(
            btn_frame_actions, text="② 更新所有 data", command=self.update_all_data,
            font=("Microsoft YaHei", 11, "bold"),
            fg="#fff", bg="#ff4d4d",
            relief="flat", padx=24, pady=8, cursor="hand2",
            activebackground="#ff8080", activeforeground="#fff",
        )
        btn_build.pack(side="left", expand=True, fill="x", padx=(0, 5))
        self.action_buttons.append(btn_build)

        btn_webp = tk.Button(
            btn_frame_actions, text="把图片转为 WebP", command=self.convert_webp,
            font=("Microsoft YaHei", 10), fg="#ddd", bg="#1a1a1a",
            relief="flat", padx=16, pady=8, cursor="hand2",
            activebackground="#2a2a2a", activeforeground="#fff",
        )
        btn_webp.pack(side="left", expand=True, fill="x", padx=5)
        self.action_buttons.append(btn_webp)

        btn_scan = tk.Button(
            btn_frame_actions, text="一键把所有图片写入画廊", command=self.scan_gallery,
            font=("Microsoft YaHei", 10),
            fg="#ddd", bg="#1a1a1a",
            relief="flat", padx=16, pady=8, cursor="hand2",
            activebackground="#2a2a2a", activeforeground="#fff",
        )
        btn_scan.pack(side="left", expand=True, fill="x", padx=(5, 0))
        self.action_buttons.append(btn_scan)

        # 运行状态与折叠的详细日志
        status_frame = tk.Frame(root, bg="#141414", highlightthickness=1, highlightbackground="#2a2a2a")
        status_frame.pack(fill="x", padx=24, pady=(0, 12))
        self.status_var = tk.StringVar(value="就绪 · 等待操作")
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

    def set_busy(self, busy):
        self.operation_running = busy
        for button in self.action_buttons:
            retry_unavailable = button is self.btn_retry_work and self.retry_operation is None
            state = "disabled" if busy or retry_unavailable else "normal"
            button.config(state=state)

    def clear_retry(self):
        self.retry_operation = None
        self.retry_step_label = ""
        self.btn_retry_work.config(
            text="重试失败步骤及后续", state="disabled", fg="#777", bg="#171717"
        )

    def run_background(self, title, operation, clear_retry=True):
        if self.operation_running:
            return
        if clear_retry:
            self.clear_retry()
        self._start_log(title + "\n")
        self.set_busy(True)

        def thread_log(message, tag=None):
            self.root.after(0, lambda m=message, t=tag: self.log(m, t))

        def worker():
            try:
                message = operation(thread_log)
            except SelfUpdateRequired:
                self.root.after(0, self.launch_self_update)
            except Exception as exc:
                self.root.after(0, lambda error=exc: self.workflow_failed(error))
            else:
                self.root.after(0, lambda result=message: self.workflow_succeeded(result))

        threading.Thread(target=worker, daemon=True).start()

    def launch_self_update(self):
        try:
            script_path = create_self_update_helper()
            creationflags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
            subprocess.Popen(
                (
                    "powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass",
                    "-WindowStyle", "Hidden", "-File", script_path,
                ),
                cwd=PROJECT_DIR,
                creationflags=creationflags,
            )
        except Exception as exc:
            self.workflow_failed(f"无法启动自更新助手：{exc}")
            return
        self.status_var.set("检测到工具更新 · 正在重启")
        self.status_label.config(fg="#e8c778")
        self.log("[INFO] 远端包含新版工作流工具，当前窗口将退出并自动重新打开。", "warning")
        self.root.after(500, self.root.destroy)

    def workflow_succeeded(self, message):
        self.clear_retry()
        self.set_busy(False)
        self.status_var.set("工作流执行成功")
        self.status_label.config(fg="#8fcf8f")
        self.log("=" * 50, "detail")
        self.log(f"[OK] {message}", "success")
        self.log("=" * 50, "detail")
        messagebox.showinfo("执行成功", message, parent=self.root)

    def workflow_failed(self, error):
        if isinstance(error, WorkflowStepError) and error.retry_operation:
            self.retry_operation = error.retry_operation
            self.retry_step_label = error.step_label
            self.btn_retry_work.config(
                text=f"重试：{error.step_label}及后续",
                fg="#f0c879", bg="#3a3020",
            )
        self.set_busy(False)
        self.status_var.set("工作流执行失败")
        self.status_label.config(fg="#ff8080")
        self.log("=" * 50, "detail")
        self.log(f"[FAIL] {error}", "error")
        if self.retry_operation:
            self.log(f"[INFO] 可点击「重试：{self.retry_step_label}及后续」继续，无需重复已完成步骤。", "warning")
        self.log("=" * 50, "detail")
        messagebox.showerror("执行失败", str(error), parent=self.root)

    def retry_workflow(self):
        if self.operation_running or self.retry_operation is None:
            return
        operation = self.retry_operation
        label = self.retry_step_label
        self.run_background(
            f"从失败步骤继续：{label}…",
            operation,
            clear_retry=False,
        )

    def start_work(self):
        self.run_background("开始工作：同步 Git…", run_start_workflow)

    def finish_work(self):
        if self.operation_running:
            return
        try:
            has_changes = bool(git_status())
        except Exception as exc:
            messagebox.showerror("无法读取 Git 状态", str(exc), parent=self.root)
            return
        if has_changes:
            commit_message = simpledialog.askstring(
                "提交说明",
                "请输入本次 git commit 的说明：",
                parent=self.root,
            )
            if commit_message is None:
                return
            commit_message = commit_message.strip()
            if not commit_message:
                messagebox.showwarning("缺少提交说明", "提交说明不能为空。", parent=self.root)
                return
        else:
            commit_message = "同步发布"
        self.run_background(
            "结束工作：提交 main 并生成 deploy…",
            lambda log_func: run_finish_workflow(commit_message, log_func),
        )

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
