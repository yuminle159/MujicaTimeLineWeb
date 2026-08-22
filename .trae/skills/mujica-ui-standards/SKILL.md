---
name: "mujica-ui-standards"
description: "唯鸡百科项目 UI 设计规范。当创建新子页面、修改筛选器、修改返回按钮或修改页面标题时，必须遵循此规范。Invoke when creating new sub-pages, adding filters, or modifying back-nav / page-header styles."
---

# 唯鸡百科 UI 设计规范

以下为项目所有子页面（songs、live、timeline、gallery、interview 等）必须遵循的统一 UI 标准。

---

## 1. 页面标题（.page-header）

每个子页面左上角标题，HTML 结构：

```html
<header class="page-header">
  <a href="../index.html" class="back-nav">&larr; 返回主页</a>
  <h1>PAGE TITLE</h1>
</header>
```

CSS 规范：

```css
.page-header {
  padding: 40px 60px 12px;
}
.page-header h1 {
  margin: 0;
  font-family: 'Cinzel', 'Noto Serif SC', serif;
  font-size: 32px;
  font-weight: 700;
  color: var(--md-primary, #cc2929);
  letter-spacing: 6px;
}
```

## 2. 返回按钮（.back-nav）

纯文本链接，无边框、无背景、无圆角：

```css
.back-nav {
  display: inline-block;
  margin-bottom: 12px;
  color: var(--md-on-surface-muted, #555);
  text-decoration: none;
  font-size: 13px;
  letter-spacing: 0.5px;
  transition: color 0.2s ease;
}
.back-nav:hover { color: var(--md-primary, #cc2929); }
```

## 3. 筛选器（.filter-bar）

**所有筛选器必须支持自动换行**（`flex-wrap: wrap`），屏幕变窄时自动折行，不出现横向滚动条。

### 3.1 无子层级的标签筛选（如 Timeline）

使用 `◆` 菱形 + 文字，ALL 按钮在最前：

```html
<div class="filter-bar">
  <div class="filter-tags">
    <button class="filter-chip active"><span class="diamond">◆</span> ALL</button>
    <button class="filter-chip"><span class="diamond">◆</span> TAG1</button>
    <button class="filter-chip"><span class="diamond">◆</span> TAG2</button>
  </div>
</div>
```

CSS：

```css
.filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 0 60px 16px;
}
.filter-tags {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}
.filter-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  user-select: none;
  transition: color 0.25s ease;
  background: transparent;
  border: none;
  padding: 0;
}
.filter-chip .diamond {
  font-size: 12px;
  color: #333;
  transition: color 0.25s ease;
}
.filter-chip:hover { color: #aaa; }
.filter-chip.active { color: #fff; font-weight: bold; }
.filter-chip.active .diamond { color: #ff4d4d; }
```

JS 交互逻辑：
- 点击 ALL → 清除所有筛选，ALL 激活，其他全部取消
- 点击其他标签 → 切换（可多选），同时取消 ALL 激活
- 手动取消所有标签 → 自动激活 ALL

### 3.2 有子层级的标签筛选（如 Gallery）

使用分组 + 竖线分隔符，父标签用 `◆` 菱形，子标签用药丸胶囊：

```html
<div class="filter-bar">
  <div class="filter-group">
    <button class="main-tag active"><span class="diamond">◆</span> ALL</button>
  </div>
  <div class="separator"></div>
  <div class="filter-group">
    <button class="main-tag"><span class="diamond">◆</span> CATEGORY</button>
    <button class="sub-tag pill">sub1</button>
    <button class="sub-tag pill">sub2</button>
  </div>
</div>
```

CSS：

```css
.filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  padding: 10px 60px;
  margin-bottom: 40px;
  row-gap: 12px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.separator {
  width: 1px;
  height: 18px;
  background-color: rgba(255, 255, 255, 0.12);
  margin: 0 24px;
  flex-shrink: 0;
}

.main-tag {
  font-size: 14px;
  letter-spacing: 1px;
  color: #666;
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color 0.3s;
}
.main-tag:hover { color: #aaa; }
.main-tag.active { color: #fff; font-weight: bold; }

.diamond { font-size: 12px; color: #333; transition: color 0.3s; }
.main-tag.active .diamond { color: #ff4d4d; }

.sub-tag.pill {
  font-size: 12px;
  color: #555;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 3px 12px;
  background: transparent;
  cursor: pointer;
  transition: all 0.3s;
}
.sub-tag.pill:hover {
  color: #999;
  border-color: rgba(255, 255, 255, 0.3);
}
.sub-tag.pill.active {
  color: #fff;
  border-color: #666;
  background-color: rgba(255, 255, 255, 0.05);
}
```

JS 交互逻辑：
- 点击 ALL → 显示全部
- 点击父标签（如 LIVE）→ 显示该分类下所有图片
- 点击子标签（如 0th）→ 精确筛选该子标签

## 4. 颜色变量

```css
:root {
  --md-primary: #cc2929;
  --md-primary-container: rgba(255, 77, 77, 0.12);
  --md-on-surface: #d1d1d1;
  --md-on-surface-muted: #555;
  --md-surface: #080808;
  --md-surface-container: #0a0a0e;
  --md-radius-full: 20px;
  --md-duration-short: 0.2s;
  --md-easing-standard: ease;
}
```

## 5. 背景色

- 全局背景：`#080808`
- 卡片背景：`#0a0a0e`
- 灯箱遮罩：`rgba(0, 0, 0, 0.85)`

## 6. 字体

- 英文标题：`'Cinzel', serif`
- 英文代码/标签：`'Space Grotesk', monospace`
- 中文：`'Noto Sans SC', 'Noto Serif SC', sans-serif`