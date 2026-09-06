---
name: "wijipedia-exe-repack"
description: "Tracks when wijipedia_数据更新工具.exe needs repackaging. Invoke when modifying generate_all.py or build_gui.py, or when user asks about exe repack."
---

# wijipedia_数据更新工具.exe 重新打包规则

## 架构

```
build_exe.py  →  PyInstaller  →  wijipedia_数据更新工具.exe
                  ↑
            build_gui.py  (tkinter GUI)
                  ↓ 内部调用
            generate_all.py  (从 Excel 生成 JS 数据文件)
```

- `build_exe.py` 用 `--add-data` 将 `generate_all.py` 打包进 exe
- `wijipedia_数据更新工具.exe` 是自包含单文件，用户无需安装 Python
- 运行时从 `_data/data.xlsx` 读取数据，生成 `*.js` 数据文件到 exe 同级目录

## 需要重新打包的情况

**只有以下文件被修改时，才需要重新打包：**

| 文件 | 原因 |
|------|------|
| `generate_all.py` | 打包进 exe 作为数据文件，修改后 exe 内是旧版 |
| `build_gui.py` | exe 的入口脚本，修改后 exe 行为不变 |

## 不需要重新打包的情况

**以下文件修改后不需要重新打包，直接覆盖部署即可：**

| 文件类型 | 原因 |
|----------|------|
| `*.html` | 前端页面，不打包进 exe |
| `*.css` | 前端样式，不打包进 exe |
| `*.js`（数据文件） | 由 exe 运行时从 Excel 生成，不打包进 exe |
| `*.js`（工具脚本如 renderMarkdown.js） | 不打包进 exe |
| `_data/data.xlsx` | 运行时由 exe 读取，不打包进 exe |
| 图片、字体等静态资源 | 不打包进 exe |

## 提醒规则

每次完成涉及 `generate_all.py` 或 `build_gui.py` 的修改后，**必须主动提醒用户**：

> ⚠️ 本次修改了 `generate_all.py` / `build_gui.py`，需要重新打包 `wijipedia_数据更新工具.exe`：
> ```
> python build_exe.py
> ```

## 重新打包命令

```powershell
python build_exe.py
```

生成的 exe 位于项目根目录：`wijipedia_数据更新工具.exe`