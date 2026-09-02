---
name: "mujica-cross-page-sync"
description: "唯鸡百科跨页面内容同步规则。当修改 live 的歌曲灯箱或 songs 的访谈浮层时，必须同步更新另一个页面。Invoke when modifying live setlist song lightbox or songs comment interview overlay."
---

# 唯鸡百科 · 跨页面内容同步规则

项目内有**两处**将其他子页面内容拉过来显示的地方：

---

## 1. Live Setlist → Songs 灯箱

**位置**：`live/index.html`，点击 setlist 曲目弹出歌曲详情灯箱

**来源**：`songs/index.html` 的歌曲灯箱（modal-overlay / modal-container）

**同步要求**：修改 `songs/index.html` 中歌曲灯箱的 HTML 结构、CSS 样式、JS 逻辑时，必须同步修改 `live/index.html` 中对应的灯箱代码。

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

- **除非用户明确说不需要同步**，否则修改一处必须同步到另一处
- 同步时保持 HTML 结构、CSS 规则、JS 逻辑完全一致
- 注意变量作用域：`songs/index.html` 的访谈浮层 JS 在独立 IIFE 中，变量名可复用但不能冲突