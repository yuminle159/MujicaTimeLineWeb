---
name: update-program-photos
description: 为唯鸡百科 timeline 的 organization/program 补录 Mujica 节目出演与 X 返图，按 programs 档案匹配期数、检索出演者前后三天帖子、下载 WebP 并填写来源。用于节目返图与时间轴补全，不替代 programs 节目档案更新。
---

# 节目返图

工作簿为项目 `_data/data.xlsx`。先读 `_data/_docs/数据更新规则详解.md` 的 timeline 部分，并参考最近已填写的同类行。用户指定期数时只处理指定范围。

## 判断范围

- 以 `programs` 表和已生成的 programs 页面确认日期、期数、出演者，只收录含 Ave Mujica 成员的节目。
- 检查 timeline 两个 category 的标题、期数和日期，不能只查 organization。佐佐木李子与高尾奏音同时出演、但不是 Mujica 全员的期目，通常已放 personal；已有就跳过，不复制到 organization。若 personal 尚无记录，不擅自猜其长篇描述，明确报告。
- 全员标题使用 `全员 出演 「バンドリ！TVLIVE YYYY」＃NNN`；不猜“第几次全员”。其他标题按 programs 中的 Mujica 出演者顺序，以 ` & ` 连接，后接相同节目名。非 Mujica 出演者填 description：`与 A & B 共同出演`；没有则留空。

## 找图

| 标准名 | X账号 |
|---|---|
| 佐佐木李子 | sasakirico |
| 高尾奏音 | Kanon_Takao |
| 冈田梦以 | okada_mei0519 |
| 米泽茜 | AkaneY_banu |
| 渡濑结月 | Watase_Yuzuki |

只搜本期实际出演的 Mujica 成员，以节目日 -3 天至 +3 天（含首尾，日本时间）为范围。搜索不足可使用用户本机 `D:/yumin/xdata/.venv/Scripts/python.exe` 的 twikit，参考 `D:/yumin/xdata/scrape_ssr_twikit.py` 的 Client 初始化。凭据仅从本机已有 cookie 文件读取，不打印、不复制进项目、不写入 skill。代理按本机实际配置使用。

附带 `scripts/search_posts.py` 接受 `--episodes 251 252`、`--project`、`--proxy`、`--output`，仅导出候选，不写工作簿。X 的日期过滤可能失效，必须按返回帖子的真实时间再过滤。只保留本人原帖，排除转推；翻页完整性和失败须记入报告，不绕过限流或登录限制。

本机 twikit 虚拟环境若没有 openpyxl，可用项目 Python 将 programs 每行按表头转为字典、导出 JSON 数组，再给搜索脚本传 `--catalog _reports/文件.json`。同一输出文件支持断点续查，已完成的账号/期目会跳过；遇限流先保存，等报告内 `retry_after_epoch` 到达后再恢复。

逐帖根据正文判断与本期关系，不能因为日期近就收图。排除其他活动、生日、MV、写真等。下载原尺寸，逐张查看内容、去重，宣传图与返图区别必要时写 media_caption；无法确定则留待核对。来源记录帖子链接和原图 URL。

同时检查 `bang_dream_info` 在节目当天（日本时间）发布的本期现场合照，只收真人同场照片，不收出演者预告海报、拼接头像公告、节目截图式宣传海报。核实正文中的期数/节目与图片一致，排除当天发布的下期预告及其他节目。添加图片可标注“官推现场合照”，无需在 timeline 增加官推链接；来源 URL 只保留在审计报告。对已有节目也可增补缺失合照，避免图片重复。personal 已收录期目仍按用户的跳过规则处理。

## 落盘

- 图片保存 `images/邦tvNNN-01.webp`，序号两位递增，禁止覆盖已有图；使用原图尺寸，WebP quality 95。先按出演者顺序、再按帖子时间及帖内图序排列。
- timeline 每图一行，`media_type=image`、`media_src=images/...`；全部图片后追加来源行，`media_type=link`、`media_url=X帖子链接`、`media_title=姓名 X链接`。同人多帖可加①②等。其他媒体列留空。
- 同事件的 date/title/category/description/tag 保持一致，category 为 organization、tag 为 program；不需要 Group。日期用节目日，不用发帖日。无特别说明时 caption 留空，不自动复制推文全文。
- 参考 #251：5 张图片和2条来源，共7行。不要自动往 gallery_images 加行；现有近期期目也仅写 timeline。
- 先备份工作簿，追加时复制相邻同类行样式，不排序、不改现有单元格、其他表及 clips；保存前检查文件是否被外部修改。核对追加数量、旧值保留、路径存在和事件合并结果。
- 使用项目 generate_all 中的 generate_timeline 生成时间轴数据；需要全站同步时才运行完整生成。不要部署、提交 Git 或扩展其他期数。
- 在 `_reports/` 保存搜索结果、选图清单和更新报告；最终说明每期图片数、来源数、跳过及未找到项。
