# MD 语法说明 & 更新流程

本项目使用 Markdown 文件管理两部分内容：**Live 页面的 MC 文本** 和 **Interview 页面的访谈内容**。

---

## 一、通用语法速查

| 语法                         | 效果       | 说明                           |
| -------------------------- | -------- | ---------------------------- |
| `# 标题`                     | 一级标题     | Interview 每篇只用一个             |
| `## 二级标题`                  | 二级标题（红色） | 章节分隔                         |
| `### 三级标题`                 | 三级标题（浅灰） | 子章节                          |
| `**粗体**`                   | **粗体**   | 用于人名、强调                      |
| `*斜体*`                     | *斜体*     | 次要强调                         |
| `- 列表项`                    | 无序列表     | 条目                           |
| `1. 列表项`                   | 有序列表     | 编号条目                         |
| `> 引用`                     | 引用块      | 红色左边框                        |
| `---`                      | 分隔线      | 横线                           |
| `[链接](url)`                | 超链接      | 新标签页打开                       |
| `![描述](图片路径)`              | 图片       | 懒加载，圆角阴影                     |
| `[c1]~[c12]`               | 自定义颜色    | 见下方"自定义颜色"                   |
| `[br]`                     | 空行       | 一行高度的空行                      |
| `[original]...[/original]` | 原文标记     | 浅灰小字，Interview 中可被"隐藏原文"按钮控制 |
| `[translation]`            | 中日双栏分割   | MC 中分隔日文/中文，渲染为左右双栏          |

---

## 二、自定义颜色

所有 MD 文件（MC 和 Interview）均支持 12 种自定义颜色：

| 编号  | 色值      | 效果         | 写法                   |
| --- | ------- | ---------- | -------------------- |
| c1  | #BB9955 | Doloris    | `[c1]金色文字[/c1]`      |
| c2  | #779977 | Mortis     | `[c2]绿色文字[/c2]`      |
| c3  | #335566 | Timorsi    | `[c3]深蓝文字[/c3]`      |
| c4  | #AA4477 | Amoris     | `[c4]紫红文字[/c4]`      |
| c5  | #7799CC | Oblivionis | `[c5]浅蓝文字[/c5]`      |
| c6  | #3388BB | MyGO蓝      | `[c6]MyGO蓝文字[/c6]`   |
| c7  | #881144 | Mujica红    | `[c7]Mujica红文字[/c7]` |
| c8  | #FF7788 | 梦限大粉       | `[c8]梦限大粉文字[/c8]`    |
| c9  | #FFEE55 | 阿拉蕾        | `[c9]阿拉蕾文字[/c9]`     |
| c10 | #9977CC | 藤都子        | `[c10]藤都子文字[/c10]`   |
| c11 | #77BBDD | 高松灯        | `[c11]浅天蓝文字[/c11]`   |
| c12 | #cc2929 | 鲜红         | `[c12]深红文字[/c12]`    |

用法示例：

```markdown
Doloris: [c1]「私は…私を見つけるために」[/c1]
Mortis: [c4]「仮面の下に隠した、本当の自分を」[/c4]
```

### 新增/修改颜色

如需新增颜色（如 `[c13]`），需要修改以下 3 个文件：

**1. CSS**（`live/style.css` 和 `interview/style.css`）

在两处各添加一行：

```css
.mc-c13 { color: #FF8800; }
```

**2. JS 渲染器**（`js/renderMarkdown.js`）

无需修改。渲染器使用动态正则 `\[c(\d+)\](.+?)\[\/c\1\]`，自动匹配任意 `[cN]...[/cN]` 标签，只需 CSS 有对应的 `.mc-cN` 类即可生效。

---

## 三、统一渲染器架构

所有自定义标签（`[c1]~[c12]`、`[original]`、`[br]`、`[translation]`）由 **单一 JS 文件** 统一处理：

**`js/renderMarkdown.js`**

```js
function renderMarkdown(html, options)
```

- `html`：Python `render_md_to_html` 预渲染后的 HTML 字符串
- `options.mode`：`'mc'`（MC 双栏模式）或 `'default'`（默认，省略即可）
- 返回值：应用了所有自定义标签后的 HTML

**各页面引用方式：**

| 页面           | 引入位置                          | 调用方式                                        |
| ------------ | ----------------------------- | ------------------------------------------- |
| Live MC 弹窗   | `live/index.html` 第 75 行      | `renderMarkdown(mcContent, { mode: 'mc' })` |
| Interview 浮层 | `interview/index.html` 第 54 行 | `renderMarkdown(item.md_html)`              |

**颜色标签处理**使用动态正则 `\[c(\d+)\](.+?)\[\/c\1\]`，自动匹配任意 `[cN]...[/cN]`，新增颜色只需添加 CSS 类，无需修改 JS。

---

## 四、Live 页面 MC 专用语法

### 4.1 文件位置

MC 文件放在 `live/mc/` 目录下。

### 4.2 关联方式

在 `data.xlsx` 的 **setlist** sheet 中，为需要弹窗的曲目行填写 `mc_file` 列：

| mc_file         |
| --------------- |
| mc/0_0.md       |
| mc/interview.md |

- 路径相对于 `live/` 目录
- 任意曲目（无论 `track_title` 是什么）都可以关联 MC 弹窗
- 留空 = 不弹窗

### 4.3 中日双栏对照

用 `[translation]` 分隔日文和中文部分，渲染时自动左右分栏显示：

```markdown
**ホントウノワタシ -再生-**
*"真正的我"*

舞台暗転。5人のシルエットが浮かび上がる。

Doloris:
「私は…私を見つけるために、ここに来た。」

[translation]

**灯光渐暗，五人的剪影浮现。**

Doloris：
「我……是为了找到真正的自己，才来到这里的。」
```

---

## 五、Interview 页面专用语法

### 5.1 文件位置

Interview MD 文件放在 `_data/mc/` 目录下。

### 5.2 关联方式

在 `data.xlsx` 的 **interview** sheet 中填写：

| 列名          | 说明                   | 示例                          |
| ----------- | -------------------- | --------------------------- |
| poster      | 海报图路径                | `../images/20231031-5.webp` |
| date        | 访谈日期                 | `2025/06/15`                |
| interviewee | 对谈人                  | `佐佐木李子 × 渡濑结月`              |
| title       | 访谈标题                 | `Ave Mujica 声优访谈`           |
| md_path     | MD 文件路径（相对于 `_data`） | `mc/sample_interview.md`    |

### 5.3 原文标记

用 `[original]...[/original]` 包裹日文原文，放在翻译内容下方。浮层右上角有「原文显示/隐藏原文」切换按钮。

```markdown
**佐佐木李子**：三角初华是一个表面开朗但内心非常复杂的角色。
[original]
**佐々木李子**：三角初華は、表向きは明るいが内面は非常に複雑なキャラクターです。
[/original]
```

**显示效果**：

- 翻译文本：正常大小（15px），颜色 `#ccc`
- 原文文本：较小（13px），颜色 `#777`，上方虚线分隔
- 点击「隐藏原文」→ 所有原文消失；再次点击恢复

### 5.4 Interview 完整示例

```markdown
# 示例访谈标题

**访谈时间**: 2025/06/15
**对谈人**: 佐佐木李子 × 渡濑结月

---

## 关于角色

**——首先请谈谈对自己饰演的角色的理解。**

**佐佐木李子**：三角初华是一个表面开朗但内心非常复杂的角色。
[original]
**佐々木李子**：三角初華は、表向きは明るいが内面は非常に複雑なキャラクターです。
[/original]

---

## 图片示例

![现场照片](../images/20231031-5.webp)

---

## 给粉丝的话

> Ave Mujica 的故事才刚刚开始，请继续关注。
```

---

## 六、更新流程

### 6.1 编写 MD 文件

- **MC**：在 `live/mc/` 下创建 `.md` 文件
- **Interview**：在 `_data/mc/` 下创建 `.md` 文件

### 6.2 更新 Excel

- **MC**：在 `data.xlsx` → `setlist` sheet 的 `mc_file` 列填写路径
- **Interview**：在 `data.xlsx` → `interview` sheet 填写完整信息

### 6.3 运行一键更新

打开 exe → 勾选对应模块（演唱会 / 访谈）→ 点击「开始更新」

exe 会：

1. 读取 Excel 表
2. 解析 `md_path` / `mc_file`，读取对应的 MD 文件内容
3. 将内容嵌入 `data.js`
4. 刷新所有 HTML 的版本号

完成后，打开网站即可看到新内容。

### 6.4 数据流向

```
Excel (各 sheet)
  │  md_path / mc_file
  ▼
generate_all.py
  │  读取 MD 文件 → Python render_md_to_html 预渲染 → 嵌入 data.js
  ▼
data.js
  │  const xxxData = [{ ..., md_html: "预渲染 HTML" }]
  ▼
浏览器 (index.html)
  │  <script src="js/renderMarkdown.js"> 加载统一渲染器
  │  renderMarkdown(html, { mode }) → 应用 [cN]/[original]/[br]/[translation]
  ▼
用户看到的页面
```