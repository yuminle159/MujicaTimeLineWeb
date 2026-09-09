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

Interview 独立页打开浮层时维护 `#<hash_id>`；从 SongModal 嵌套打开时必须使用 `manageHash: false`，保留底层的 `#song=`、`#live=` 或 `#discography=`。关闭嵌套 Interview 后，底层 SongModal 保持打开，Escape 一次只关闭最上层。

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
