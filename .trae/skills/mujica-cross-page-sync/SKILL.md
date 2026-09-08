---
name: "mujica-cross-page-sync"
description: "唯鸡百科跨页面内容同步规则。当修改 live 的歌曲灯箱或 songs 的访谈浮层时，必须同步更新另一个页面。Invoke when modifying live setlist song lightbox or songs comment interview overlay."
---

# 唯鸡百科 · 跨页面内容同步规则

项目内有**两处**将其他子页面内容拉过来显示的地方：

---

## 1. Songs 详情灯箱（共享组件）

**使用位置**：`songs/index.html`、`live/index.html`、`discography/index.html`

**唯一来源**：
- `js/song-modal.js` — HTML 结构、数据渲染、打开/关闭和 Escape 逻辑
- `css/song-modal.css` — 全部灯箱样式与响应式规则

三个页面只保留调用适配：Songs 允许组件维护 `#song=`；Live 和 Discography 打开组件时不得覆盖各自的 `#live=`、`#discography=`。

**同步要求**：修改歌曲灯箱时只修改共享组件，并检查三个调用入口。不要重新复制灯箱 HTML、CSS 或 JS 到页面文件。

---

## 2. Songs Comment → Interview 浮层

**位置**：`songs/index.html`，点击 comment 的「采访出处」链接弹出访谈浮层

**来源**：`interview/index.html` 的全屏沉浸式浮层（cinematic-overlay）

**涉及文件**：
- `songs/index.html` — 访谈浮层 HTML + JS
- `songs/style.css` — 访谈浮层 CSS（`.cinematic-*`, `.md-content`, `.md-original`, `.mc-cN` 等）
- `interview/index.html` — 原始访谈浮层
- `interview/style.css` — 原始访谈浮层 CSS

**同步要求**：修改 `interview/index.html` 或 `interview/style.css` 中的以下内容时，必须同步修改 `songs/index.html` 和 `songs/style.css`：
- 浮层 HTML 结构（cinematic-overlay, cinematic-header, cinematic-body）
- 浮层 CSS 样式（`.cinematic-*`, `.md-content` 及其子元素）
- 浮层 JS 逻辑（原文切换、Page Top 按钮、Markdown 渲染缓存等）
- `.md-content img` 的 `max-width` 限制

---

## 同步原则

- **除非用户明确说不需要同步**，否则修改共享组件后必须检查全部调用页面
- Songs 灯箱的 HTML、CSS 和 JS 必须保留单一来源，不得在调用页创建副本
- 注意变量作用域：`songs/index.html` 的访谈浮层 JS 在独立 IIFE 中，变量名可复用但不能冲突
