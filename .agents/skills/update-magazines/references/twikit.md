# twikit 本机配置与检索经验

## 环境

本次工作验证过的 Windows 配置（换电脑或失效时重新检查，不视为通用路径）：

- Python：`E:/twikit/.venv/Scripts/python.exe`
- Cookie 文件：`E:/twikit/x_cookies.json`
- HTTP 代理：`http://127.0.0.1:10808`
- 初始化：`Client('ja-JP', proxy=proxy)`，然后 `load_cookies(cookie_path)`。

用户要求 twikit 安装在项目外的 `E:\twikit`；不要在项目创建虚拟环境或重新安装。先验证已有安装与代理。Cookie 只从本机读取，不打印、不复制进项目、skill 或日志。不将读取凭据误当作发送帖文授权；本流程只读取 X、下载公开图片。

检索输出可写项目 `_reports/`。若此环境仍有之前的 `_reports/collect_magazines_2023.py`、`_reports/search_magazines.py`，可检查后复用其机制；不要直接执行其写死的年份／账号查询，也不要让新脚本依赖 `exec` 历史脚本源码。

## 查询与分页

- 例：`from:bang_dream_info (Mujica OR AveMujica OR ムジカ) since:2023-04-01 until:2024-01-01`。`until` 为不含端点；用户给截止日期时通常加一天。边界附近帖子按日本当地时间复核。
- 分别试带空格的 `"Ave Mujica"` 和其他拼写；补查 `(雑誌 OR 月号 OR 表紙 OR 掲載 OR interview OR magazine)`。相关账号与时间范围内的全量查询能弥补关键词遗漏。
- 使用 Latest，按返回的底部游标翻页，帖子 ID 去重，保存每条原文、作者、发帖时间、扩展链接、媒体 URL。保留转推／引用关系，核实原始作者，不把嵌套帖当成当前账号原帖。
- `count=100` 并不保证实际返回 100 条。过往存在中间空页之后又返回内容的情况；单页为空不能直接宣布完成。有新游标可继续核对，连续空页达到合理阈值（此前用 3 页）后记录停止原因，而不是宣称已完整枚举该账号。
- 每页保存断点；请求之间适当间隔（此前约 3 秒）。游标结束、重复游标、连续空页、接口异常等分别记录。

## 故障恢复

优先使用当前 twikit 的正常 API。此前 twikit 2.3.3 在本机遇到以下兼容问题，仅在相同问题重现并检查当前响应后修复，不无条件套用旧补丁：

1. transaction 初始化无法识别 X 页面中的 `ondemand.s` 脚本：曾需适配页面数字 chunk ID 与 hash 的映射，再从对应 JS 提取 transaction indices。
2. SearchTimeline 的 GET 请求失败：曾使用 `c.gql.search_timeline` 对应的 POST 调用，variables 为 `rawQuery/count/querySource='typed_query'/product='Latest'/cursor`。
3. twikit 的 Tweet 模型解析报 KeyError：可读取成功返回的原始 GraphQL JSON，遍历 `__typename='Tweet'` 且存在 `legacy` 的节点，按 `rest_id` 去重，取正文、用户和媒体；先检查 API errors，不能把错误响应当作空结果。

适配前保留最小错误类型与位置，避免输出可能含 Cookie、token 或请求头的完整异常／响应。认证失败需要用户恢复登录，不反复重试。

429 时保存进度及 `rate_limit_reset`，到重置后稍作缓冲再恢复；没有重置时间时采用有上限的退避，并报告状态。不更换账号或代理来绕过限流。短暂服务器错误可有限重试（例如 3 次、逐步延长间隔）；持续失败保留未完成状态并说明。等待期间完成已有候选核实、下载和数据写入，维持进度沟通；不要用长时间阻塞工具让用户看不到状态。
