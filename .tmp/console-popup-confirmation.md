# Codex 控制台闪窗确认记录

检查日期：2026-09-26，时间为本机北京时间。

## 已确认

反复闪窗真实存在。Windows 的窗口显示事件已经捕获，不能用“没有持续存在的 cmd.exe 进程”排除该现象。

两个直接捕获的例子：

| 时间 | 事件 | 证据 |
| --- | --- | --- |
| 15:14:34.939 | 新窗口显示 | WindowsTerminal.exe，窗口类 CASCADIA_HOSTING_WINDOW_CLASS，visible=true |
| 15:14:35.496 | 同一窗口隐藏 | Windows 事件时间戳相差 532 ms |
| 15:14:44.711 | 另一新窗口显示 | WindowsTerminal.exe，visible=true |
| 15:14:45.254 | 同一窗口隐藏 | 事件时间戳相差 547 ms；窗口标题为 codex-windows-sandbox-setup.exe 的完整路径 |

对应进程记录显示：Codex app-server 进程 PID 29704 先后启动沙盒 setup 进程 PID 11828、29588、10468、21500；这些 setup 进程又各自启动同名子进程。

Codex 沙盒日志在对应时刻记录：

```text
15:14:34.328 setup refresh: spawning ...\codex-windows-sandbox-setup.exe
15:14:44.145 setup refresh: spawning ...\codex-windows-sandbox-setup.exe
15:15:06.280 setup refresh: spawning ...\codex-windows-sandbox-setup.exe
15:15:07.746 setup refresh: spawning ...\codex-windows-sandbox-setup.exe
```

这些记录发生在工具命令执行前。当前后台版本路径为 0.157.1-x86_64-pc-windows-msvc。

## 结论与边界

本次已定位到 Codex 的 Windows 沙盒 setup refresh 启动链路会伴随可见终端窗口闪现。连续工具调用能够连续触发，符合用户描述的使用 Codex 时连续闪窗现象。

本次没有单独验证完全不调用工具、仅发送消息时的闪窗，也没有确定需要修复的具体源码行。日志中的 setup refresh 结果为 errors=[]，不能据此推断初始化失败或安装损坏。已确认问题存在，尚未修复。

此前 20 秒轮询按窗口句柄和进程编号去重，没有记录窗口完整生命周期，并且可能复用窗口句柄。它不足以排除短暂闪窗。

## 原始证据

- 本目录 console-events.jsonl：窗口事件、进程和父进程路径。
- C:\Users\YUMIN\.codex\.sandbox\sandbox.2026-09-26.log：setup refresh 和命令执行日志。
- 本目录 capture-console-events.py：只读窗口事件监听器。

未修改 Codex 配置或 Windows 系统设置。
