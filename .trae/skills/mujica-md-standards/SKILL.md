---
name: "mujica-md-standards"
description: "唯鸡百科项目统一 MD 自定义标签规则。当创建/编辑 MD 文件（MC 或 Interview）或修改 MD 渲染逻辑时，必须遵循此规范。Invoke when creating/editing .md files in _data/mc/ or live/mc/, or when modifying renderMarkdown."
---

# 唯鸡百科 MD 统一标签规范

本项目所有 MD 文件（Live 页面的 MC 文本 和 Interview 页面的访谈内容）使用**完全统一**的自定义标签规则。

## 架构

```
MD 源文件
  → Python: render_md_to_html() 预渲染基础 Markdown → HTML
  → 浏览器: renderMarkdown() 处理自定义标签
```

- **Python 端**：`generate_all.py` 中的 `render_md_to_html()` 负责基础 Markdown → HTML（标题、粗体、斜体、列表、段落等），**保留**所有自定义标签不处理
- **浏览器端**：`js/renderMarkdown.js` 中的 `renderMarkdown(html, options)` 负责处理所有自定义标签

## 自定义标签（全项目统一）

| 标签 | 效果 | 适用场景 |
|------|------|----------|
| `[c1]...[/c1]` ~ `[c12]...[/c12]` | 12 种自定义颜色 | 全部 MD 文件 |
| `[br]` | 一个一行高度的空行 | 全部 MD 文件 |
| `[original]...[/original]` | 原文标记（浅灰小字，Interview 可被"隐藏原文"按钮控制） | 全部 MD 文件 |
| `[translation]` | 中日双栏分列标记（MC 专用） | 仅 MC 文件 |

## 颜色对照表

| 编号 | 色值 | 说明 |
|------|------|------|
| c1 | #BB9955 | 金色 |
| c2 | #779977 | 绿色 |
| c3 | #335566 | 深蓝 |
| c4 | #AA4477 | 紫红 |
| c5 | #7799CC | 浅蓝 |
| c6 | #3388BB | 蓝 |
| c7 | #881144 | 深红 |
| c8 | #FF7788 | 粉红 |
| c9 | #FFEE55 | 黄 |
| c10 | #9977CC | 紫 |
| c11 | #77BBDD | 高松灯 |
| c12 | #cc2929 | 鲜红色 |

## MC 文件专用：[translation] 双栏分列

`[translation]` 标签之前的文本为日文（左栏），之后的文本为中文（右栏）。

示例：
```markdown
Doloris:
「私は…私を見つけるために、ここに来た。」

[translation]

Doloris：
「我……是为了找到真正的自己，才来到这里的。」
```

## 代码位置

| 文件 | 作用 |
|------|------|
| `generate_all.py` → `render_md_to_html()` | Python 端预渲染，保留自定义标签 |
| `js/renderMarkdown.js` | 浏览器端统一处理自定义标签 |
| `live/index.html` | 加载共享 JS，调用 `renderMarkdown(mcContent, { mode: "mc" })` |
| `interview/index.html` | 加载共享 JS，调用 `renderMarkdown(item.md_html)` |

## 已知陷阱 / Known Pitfalls

### ⚠️ `<span>` 不能包裹 `<p>` 标签（最严重 Bug）

**根因**：当 `[original]` 和 `[/original]` 各自独占一行（前后有空行）时，Python 预渲染会产生：

```html
<p>[original]</p>        <!-- 归一化后变成裸 [original] -->
<p>原文内容</p>
<p>[/original]</p>       <!-- 归一化后变成裸 [/original] -->
```

JS 归一化步骤移除 `<p>` 包裹后，正则 `\[original\]([\s\S]*?)\[\/original\]` 匹配到的内容**包含 `<p>` 标签**。如果此时用 `<span>` 包裹：

```html
<span class="md-original"><p>原文内容</p></span>
```

**`<span>` 是内联元素，HTML 规范不允许它包含 `<p>` 块级元素。** 浏览器解析这种无效 HTML 时会进行不可预测的 DOM 重构，导致 `.md-original` 意外包裹后续的图片、段落等所有内容。

**修复原则（必须遵守）**：当 `[original]` 或任何标签的匹配内容可能包含 `<p>` / `</p>` 时，**必须使用 `<div>` 而非 `<span>`**：

```javascript
html = html.replace(/\[original\]([\s\S]*?)\[\/original\]/g, function(match, content) {
  if (/<p>|<\/p>/.test(content)) {
    return '<div class="md-original">' + content + '</div>';  // ← 用 div！
  }
  return '<span class="md-original">' + content + '</span>';  // 纯内联内容才用 span
});
```

**教训**：在 HTML 字符串上做正则替换时，永远要考虑替换后的 HTML 是否合法。`<span>` 不能包含任何块级元素（`<p>`, `<div>`, `<h1>`~`<h6>`, `<ul>`, `<ol>`, `<li>`, `<blockquote>` 等）。

---

## 禁止事项

- ❌ 不要在 MC 文件中使用 `---` 做中日分列，请使用 `[translation]`
- ❌ 不要在渲染函数中各自定义颜色替换逻辑，全部通过 `js/renderMarkdown.js` 统一处理
- ❌ 不要使用 `[c1]~[c12]` 以外的写法（必须用 `[/cN]` 闭合）
- ❌ 绝对不要在正则替换中用 `<span>` 包裹可能包含 `<p>` 标签的内容，必须用 `<div>`