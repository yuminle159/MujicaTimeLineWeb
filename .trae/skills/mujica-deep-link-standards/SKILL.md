---
name: "mujica-deep-link-standards"
description: "唯鸡百科子页面的可分享深链接与跨页面详情组件规范。创建或修改可打开详情的页面、分享 URL，或复用 Songs、Live、Discography 等详情组件时使用。"
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

## 共享交互窗口栈（强制）

Songs、Live、Discography、Interview 的共享交互窗口必须加载并接入 `js/overlay-manager.js`，不得再由组件通过 `beforeOpen`、`afterClose` 或手动隐藏/恢复 class 来管理彼此的生命周期。

- 栈节点身份统一为 `<type>:<hash_id>`，其中 `type` 只能是 `song`、`live`、`discography`、`interview`；数组下标只用于查找数据，不能作为节点身份。
- URL 哈希只由从当前 index 页面直接打开的第一层交互窗口决定。第一层关闭前，后续嵌套窗口不得修改或清除该哈希。
- OverlayManager 以栈是否为空作为第一层的最终判断；组件传入的 `updateHash` / `manageHash` 只保留调用语义，不能覆盖这一规则。
- 第一层仍沿用既有格式：Songs 为 `#song=<hash_id>`、Live 为 `#live=<hash_id>`、Discography 为 `#discography=<hash_id>`、Interview 为 `#<hash_id>`。
- 最大栈深度固定为 4。第 5 层打开请求替换当前第 4 层，第一层深链接和下面三层保持不变。
- 请求打开已存在的同一节点时，不创建新节点；移除该节点上方的窗口并直接切换到已有节点。
- 同类型不同节点允许进入栈；共享组件恢复时必须按保存的数据重新渲染，并恢复关键滚动位置或选项状态。
- 只有栈顶窗口可交互并处理 Escape；底层窗口保持显示状态但必须设置 `inert` 和 `aria-hidden="true"`。
- `body` 滚动锁定、动态 `z-index`、第一层哈希写入与清除统一由 OverlayManager 负责。
- Live 的 MC、KV/Backstage 图片灯箱以及 Interview 的图片灯箱属于组件内部辅助层，不计入四层共享窗口栈，并且必须先于所属主窗口响应 Escape。

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

## Interview 浮层跨页面复用

Interview 浮层同样是共享组件，Interview 独立页以及 SongModal 内的“采访出处”统一调用同一份实现：

- `js/interview-overlay.js`：创建浮层 DOM，负责 Markdown 渲染缓存、原文切换、图片灯箱、Page Top、打开/关闭和 Escape；
- `css/interview-overlay.css`：浮层及其图片灯箱的全部样式；
- `interview/page.js`：只负责 Interview 页面卡片、搜索、排序和深链接初始化，不得包含浮层实现；
- 使用 SongModal 的 Songs、Live、Discography 页面必须加载 `interview/data.js`、`renderMarkdown.js` 和 InterviewOverlay 共享 JS/CSS，使“采访出处”行为在所有入口一致。

Interview 独立页打开浮层时使用 `manageHash: true` 注册为第一层；从 SongModal 嵌套打开时使用 `manageHash: false`。实际哈希写入、保留与清除由 OverlayManager 根据第一层节点统一处理。

## Live 抽屉跨页面复用

Live 详情抽屉由 Live 与 Discography 页面统一调用同一份共享实现：

- `js/live-drawer.js`：唯一创建抽屉、MC 浮层和 KV/Backstage 灯箱 DOM，负责 Setlist、歌曲跳转、图片轮播、打开/关闭与 Escape；
- `css/live-drawer.css`：抽屉及其附属浮层的全部样式，统一使用 `.shared-live-*` 命名空间；
- `live/index.html`：只负责 Live 卡片、筛选、统计与 `#live=<hash_id>` 初始化，通过 `LiveDrawer.open()` 打开详情；
- Discography 的 `content_title` 若可匹配 Live 名称，则渲染为 Live 入口，通过 `LiveDrawer.findByTitle()` / `LiveDrawer.open()` 打开同一抽屉。

Live 独立页调用时使用 `updateHash: true` 注册为第一层；从其他共享窗口嵌套打开时使用 `updateHash: false`。组件不得自行隐藏或恢复 Discography/Song 等父窗口。

## Discography 灯箱跨页面复用

Discography 详情灯箱由 Discography 页面以及 SongModal 的“收录CD”入口统一调用：

- `js/discography-modal.js`：唯一创建唱片详情 DOM，负责版本切换、版本矩阵、收录内容、榜单、歌曲/Live 跳转、打开/关闭与 Escape；
- `css/discography-modal.css`：详情灯箱全部样式，统一使用 `.shared-discography-*` 命名空间；
- `discography/index.html`：只负责唱片档案列表、筛选、搜索和 `#discography=<hash_id>` 初始化，通过 `DiscographyModal.open()` 打开详情；
- SongModal 的 `appearances` 条目通过 `DiscographyModal.findByTitle()` 匹配 `discographyData[].title`；匹配成功才显示为按钮，未入库条目保持静态文本。

Discography 独立页调用时使用 `updateHash: true` 注册为第一层；从 SongModal 等共享窗口嵌套打开时使用 `updateHash: false`。父窗口恢复和层级关系统一交给 OverlayManager。

## 共享组件的样式隔离（强制）

“共享组件”必须保证从不同页面打开时得到相同的 DOM、行为和最终视觉，不能只是让多个页面各自维护一套看起来相近的实现。

- 组件的 DOM 只能由共享 JS 创建或由唯一共享模板提供；调用页面不得复制组件 HTML。
- 组件的全部视觉规则只能放在共享 CSS；调用页面不得保留或新增该组件的旧版、页面专用或补丁式 CSS。
- 所有组件选择器必须使用独立命名空间，例如 `.shared-song-*`，避免 `.modal`、`.overlay`、`.live-node` 等通用类名受到宿主页面影响。
- 共享 CSS 必须自带组件所需的颜色变量、字体、尺寸和其他设计 token，并把它们定义在组件根节点上。不要依赖调用页面的 `:root` 变量或 fallback 来凑出相同外观。
- 共享 CSS 必须在组件边界内统一盒模型，包括伪元素：

```css
.shared-song-modal-overlay,
.shared-song-modal-overlay *,
.shared-song-modal-overlay *::before,
.shared-song-modal-overlay *::after {
  box-sizing: border-box;
}
```

调用页面只负责加载共享 JS/CSS、提供数据，并调用公开 API。除明确设计的配置项外，宿主页面不应改变组件样式。

### 已踩坑：伪元素继承了不同的页面环境

Performance History 的圆点由 `.shared-song-live-node::before` 生成。Songs 页面原本对 `*::before` 设置了 `border-box`，Discography 只对 `*` 设置了 `border-box`，导致同一条 `width: 8px; border: 2px` 在两个页面计算出不同尺寸。

修复必须放在共享 CSS 的组件边界内，不能通过给 Discography、Live 等调用页分别补变量或覆盖样式来解决。否则以后新增调用页面时还会再次出现差异。

### 修改与验证

- 修改共享 CSS 后，同步更新所有调用页的缓存版本参数。
- 至少检查 Songs、Live、Discography 三个 SongModal 入口，以及 Interview 独立页的桌面端和移动端表现。
- 重点比较伪元素、滚动区域、字体、断点、`z-index` 和 `body` 滚动锁定。
- 若不同入口表现不一致，先检查宿主页面的全局 reset、继承属性和 CSS 变量；最终修复仍应收敛到共享组件内部。
