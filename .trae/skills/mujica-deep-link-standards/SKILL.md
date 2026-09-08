---
name: "mujica-deep-link-standards"
description: "唯鸡百科子页面的可分享深链接与跨页面详情灯箱规范。创建或修改可打开详情的页面、分享 URL 或复用 Songs 灯箱时使用。"
---

# 唯鸡百科：深链接与可复用详情灯箱

## 深链接

详情页使用 `history.replaceState` 写入 URL，关闭详情时恢复为 `pathname + search`，不要使用 `pushState`。

每一类页面使用自己的前缀和数据中的 `hash_id`：

| 页面 | URL 格式 | 查找字段 |
| --- | --- | --- |
| Songs | `#song=<hash_id>` | `songsData[].hash_id` |
| Live | `#live=<hash_id>` | `livesData[].hash_id` |
| Discography | `#discography=<hash_id>` | `discographyData[].hash_id` |
| Interview | `#<hash_id>` | `interviewData[].hash_id` |

- `hash_id` 由 `generate_all.py` 的 `hash_id()` 从展示标题和日期等稳定内容生成；不要把 Excel 的关联键、数组下标或可读标题直接放入 URL。
- 写入时使用 `encodeURIComponent`，读取时使用 `decodeURIComponent`。
- 页面加载时，先检查所属前缀，再按 `hash_id` 找到数据并打开详情。
- 一次只让最上层详情处理 Escape；嵌套灯箱关闭后，底层灯箱保持打开状态。

## Excel 关联键与分享键

Excel 的 `release_id`、`song_name`、演出名称等字段用于关联工作表和维护数据。它们不是公开 URL 标识。新增实体需要：

1. 选择稳定的 Excel 关联字段；
2. 在生成器中基于展示内容生成 `hash_id`；
3. 仅将 `hash_id` 输出到前端数据和深链接。

## Songs 灯箱跨页面复用

浏览器无法让一个独立 HTML 页面直接调用另一个页面运行中的 JavaScript 函数。本项目已将 Songs 灯箱抽成共享组件，Songs、Live 和 Discography 调用同一份实现。

共享模块为：

- `js/song-modal.js`：接收 `songsData` 和歌曲索引，负责渲染、打开、关闭及 Escape；
- `css/song-modal.css`：灯箱所有样式；
- 每个使用页只提供灯箱挂载节点，并调用同一个公开函数。

修改灯箱时只改共享 JS/CSS，并检查三个页面的调用适配；不要再把灯箱复制回页面文件。
