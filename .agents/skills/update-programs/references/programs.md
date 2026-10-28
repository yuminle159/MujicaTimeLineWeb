# 数据、来源与补丁

## 单表约定

`_data/data.xlsx / programs`：

| 列 | 字段 | 更新规则 |
|---|---|---|
| A | program_id | 已有 ID 不变；新行可由工具生成，隐藏列 |
| B | program | 如 `バンドリ！TV LIVE`；不定期默认 `特别节目`，已有系列名优先 |
| C | episode | `#336` 等官方期数；特别节目可空 |
| D | date | 播出日 `YYYY/MM/DD`，可空；不是上传日 |
| E / F | time / timezone | `21:00` / `+09:00`；没有依据就留空，不统一猜 21:00 |
| G | title | 官方本期标题或主题；原普通期目可能为空 |
| H | performers | 标准名或已登记别名，用 `|` 分隔；完整官方名单含主持与嘉宾 |
| I | clips | 字幕组 Bilibili 切片；用 `标题=>链接`，保留已有内容、批注和样式 |
| J | video_url | 官方完整节目；支持 YouTube watch/live/短链接 |
| K | cover | `images/programs/节目ID-视频ID.webp`，有理由替换时先清空再同步 |
| L | notes | 核实后的延期/取消等说明；保留原备注 |
| N:Q | cast_name / band / band_color / aliases | 独立字典，节目追加行不能覆盖它；别名和多乐队用 `|` 分隔 |

名称规范：以工作簿现有标准名为主，不把日文姓名另当成一个新人。原始导入含 10 个未配置归属的写法，其中可能有别名，也有外部嘉宾；先核实身份。新乐队颜色优先复用同组已登记色值；无法核实的归属、色值可空，不能把未知嘉宾擅自归到某乐队。

统计应按标准名、节目 ID 去重，一期一个人只算一次；同人多个写法或一个节目多个回放不能产生重复记录。

## 切片来源与匹配

- 字幕组 Bilibili 合集：`https://space.bilibili.com/3690988597938228/lists/7952732?type=season`；通过 `https://api.bilibili.com/x/polymer/web-space/seasons_archives_list` 分页读取，参数为 `mid=3690988597938228`、`season_id=7952732`、`page_num`、`page_size`。确认返回数量与 `total` 一致。
- 从标题中的 `邦TV#期数` 提取所有期数；标题含两个期数时两期都追加。同一期可有多个切片。仅匹配 `バンドリ！TV LIVE` 唯一期目；没有期数或找不到唯一节目行时记录待核对。
- 新链接写成 `标题=>https://www.bilibili.com/video/BV...`。按 BV 号检查已有切片，保留原顺序；合集内已有的裸链接补上标题，已带标题的条目不改。其他用户手填切片原样保留。不得从视频上传时间推断节目播出时间。
- 用 `scripts/season_clips.py` 先预览再应用；脚本按哈希检查工作簿是否变化，备份后只修改需要追加或补标题的 I 列单元格，其他工作簿内容保持原样。普通 `programs_tool.py apply` 仍禁止写切片。

## 官方来源

- 完整节目播放列表：`https://www.youtube.com/playlist?list=PLvRmS87ezZfpnV-KtU1vz--KFUz5zIQYo`
- 官方频道：`https://www.youtube.com/@bang_dream_official/streams`，频道 ID `UCN-bFIdJM0gQlgX7h6LKcZA`。
- 官方新闻：`https://bang-dream.com/news/`；官方日程：`https://bang-dream.com/schedule/`。
- 特别节目可能出现在 Bushiroad 官方频道或合作方页面。用官网公告确认其视频链接和身份，不因标题相似就采用转载。

YouTube 标题通常给期数和年份，描述中可能给日期、开播时间和出演名单。`microformat.playerMicroformatRenderer.liveBroadcastDetails.startTimestamp` 可以提供直播时刻线索，但须判断待播/已播状态以及公告口径，不能把 `publishDate`、`uploadDate` 当播出日。预告视频不等于完整直播。

公开播放列表可能隐藏失效视频，也不包含所有特别节目。例如原表 2026/01/02 的 Poppin'Party 特番曾从官方视频 `https://www.youtube.com/watch?v=rGOTYY_Y9BE` 补齐。列表缺失不能作为删除现有记录的理由。

每轮核对近期非空记录是否有官方更正，并持续补全历史空白；长批次在 `_reports/` 保存已核对/未核对的节目 ID 与来源，避免中断后重查整表。没有实际访问到的新证据时，不能把旧缓存说成最新资料。

## 补丁格式

补丁由 Codex 核实来源后编写；不是把抓取文本直接当作更新指令。

```json
{
  "expected_sha256": "snapshot 输出的 workbook_sha256",
  "episodes": [
    {
      "program_id": "已有记录 ID；新增时可省略",
      "fields": {"title": "已核实的标题"},
      "sources": {"title": ["https://官方来源页面"]}
    }
  ],
  "cast": [
    {
      "cast_name": "工作簿标准名",
      "fields": {"band": "乐队名称", "aliases": "官方日文写法|其他已核实写法"},
      "sources": {"band": ["https://官方来源页面"], "aliases": ["https://官方来源页面"]}
    }
  ],
  "cast_merges": [
    {"from": "重复字典项", "into": "保留的标准名", "sources": ["https://身份核实来源"]}
  ]
}
```

- 所有操作数组可省略；`fields` 只放实际修改的字段。`clips` 或未知字段将被拒绝。
- 新期目需 `program`，以及 `episode` 或 `title`；其余能核实多少填多少。新增 `program_id` 可不提供，但已存在期目必须指向已有 ID。
- 每个修改字段都需有 `sources` URL 列表；色值复用可引用 `workbook:programs!P42`（仅 `band_color` 接受此形式）。URL 是审计线索，不等于工具自动验证了事实；技能执行者必须先查证。
- 将两个姓名确认为同人后可用 `cast_merges`。工具保留标准名，合并别名，清空重复项的 N:Q 单元格；不会移动左侧节目或切片。不同已知乐队归属会拒绝合并，应先核实并明确修正。
- 同一份已成功应用的补丁会因旧哈希而拒绝再次写入。这是防止覆盖用户随后新增切片；重新快照后，不变字段不会重写文件。
- `--dry-run` 做同样的校验而不保存；真实应用自动备份至 `_backups/`，审计报告记录字段前后值和来源。

## 工具依赖

随附脚本从 `--project` 加载项目自己的 `sync_programs.py`，复用单表 schema、图片匹配与备份保存；需要 `openpyxl`、`Pillow`、`requests`。默认项目不在当前目录时可传 `--project D:/yumin/web/MujicaTimeLineWeb`。没有该脚本或 programs 表时先报告缺少依赖，不在错误目录另建数据集。

工具读取用户本地工作簿、访问公开网页并写入该项目的报告/备份；下载缩略图仍由 `sync_programs.py` 执行。它不发布网页、不修改源 Excel 导入文件、不创建定时任务。
