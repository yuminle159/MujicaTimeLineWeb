# Ave Mujica TimeLine - 维护指南

双轨时间轴网页，左侧展示 Band（组织）事件，右侧展示 Nonrico（个人）事件。黑色背景 + 红色时间轴，支持图片轮播、视频轮播、外部链接、标签图标。

---

## 目录

- [文件结构](#文件结构)
- [快速上手：添加事件](#快速上手添加事件)
- [XLSX 列说明](#xlsx-列说明)
- [标签图标（Tag Icon）](#标签图标tag-icon)
- [修改样式](#修改样式)
- [修改页面标题](#修改页面标题)
- [调整时间轴间距](#调整时间轴间距)
- [部署](#部署)
- [常见问题](#常见问题)

---

## 文件结构

```
web/
├── index.html           # 主页面（HTML 结构 + 内联 JS 逻辑）
├── style.css            # 样式表（所有颜色、字体、大小、响应式）
├── data.js              # 时间轴数据（由 generate_data.py 自动生成，勿手动改）
├── data.xlsx            # 数据源（Excel 编辑，带下拉验证）
├── generate_data.py     # 转换脚本：data.xlsx → data.js
├── 一键更新数据.bat       # 一键运行脚本（双击即可）
├── images/              # 图片文件夹（放这里，用相对路径引用）
├── icons/               # 标签图标文件夹（放 tag 对应的 icon 图片）
└── README.md            # 本文件
```

**工作流程：**

```
编辑 data.xlsx（Excel） → 双击「一键更新数据.bat」 → 刷新网页
```

---

## 快速上手：添加事件

### 第一步：用 Excel 打开 `data.xlsx`

双击 `data.xlsx`，Excel 会打开。看到以下列（**tag、category、media_type 列有下拉选择，tag 列根据 category 联动筛选**）：

| date     | title               | category     | description | tag  | media_type | media_src      | media_caption | media_url           | media_title |
| -------- | ------------------- | ------------ | ----------- | ---- | ---------- | -------------- | ------------- | ------------------- | ----------- |
| 2023/6/4 | Ave Mujica 0th LIVE | organization | 「初次登台」      | live | image      | images/0th.png | 0th Live 主视图  |                     |             |
| 2023/6/4 | Ave Mujica 0th LIVE | organization | 「初次登台」      | live | link       |                |               | https://example.com | 在线观看        |

### 第二步：填写你的事件

每一行 = 一个事件的一条媒体。**同一个事件有多个媒体时，重复填写前 5 列，只在媒体列填不同内容。**

#### 示例：添加一个带 3 张图片的事件（自动轮播）

在 Excel 中填 3 行：

| date      | title | category     | description | tag   | media_type | media_src     | media_caption |
| --------- | ----- | ------------ | ----------- | ----- | ---------- | ------------- | ------------- |
| 2024/1/15 | 新专辑发布 | organization | 首张专辑        | album | image      | images/p1.jpg | 封面            |
| 2024/1/15 | 新专辑发布 | organization | 首张专辑        | album | image      | images/p2.jpg | 内页            |
| 2024/1/15 | 新专辑发布 | organization | 首张专辑        | album | image      | images/p3.jpg | 封底            |

> 多图/多视频自动切换为轮播模式，详见[媒体类型详解](#媒体类型详解)。

#### 示例：只有描述、没有媒体的事件

`media_type` 列留空即可，tag 留空则不显示图标。

### 第三步：运行脚本

**方式一（推荐）：** 双击 `一键更新数据.bat`，自动完成转换。

**方式二：** 在 `web` 文件夹下打开终端（PowerShell），运行：

```powershell
python generate_data.py
```

看到 `Done! X events written to data.js` 即成功。

### 第四步：刷新网页

打开 `index.html`（或已部署的网址），Ctrl+F5 强制刷新即可看到新事件。

---

## XLSX 列说明

| 列名              | 必填    | 说明                                                   | 示例                    |
| --------------- | ----- | ---------------------------------------------------- | --------------------- |
| `date`          | 是     | 日期，格式 `YYYY/M/D`（如 `2023/6/4`）                       | `2023/6/4`            |
| `title`         | 是     | 事件标题（显示在气泡上）                                         | `Ave Mujica 0th LIVE` |
| `category`      | 是     | `organization`（左侧/Band）或 `personal`（右侧/Nonrico），下拉选择 | `organization`        |
| `description`   | 是     | 事件描述（展开后显示，支持多行换行）                                   | `「初次登台」`              |
| `tag`           | 否     | 事件标签，决定气泡右上角图标（留空 = 无图标），下拉选择，根据 category 联动         | `live`                |
| `media_type`    | 否     | 媒体类型：`image` / `video` / `link`（留空 = 无媒体），下拉选择       | `image`               |
| `media_src`     | 媒体时   | 图片路径（相对路径）或视频 Bilibili 嵌入 URL                        | `images/photo.jpg`    |
| `media_caption` | 否     | 图片/视频的说明文字（显示在下方）                                    | `现场照片`                |
| `media_url`     | link时 | 外部链接地址                                               | `https://example.com` |
| `media_title`   | link时 | 链接显示文字                                               | `详细报道`                |

### 支持的 tag 值

| tag 值      | 含义      | 分类   | 图标文件                 |
| ---------- | ------- | ---- | -------------------- |
| `live`     | Live 演出 | 组织相关 | `icons/live.png`     |
| `single`   | 单曲发售    | 组织相关 | `icons/single.png`   |
| `album`    | 专辑发售    | 组织相关 | `icons/album.png`    |
| `anime`    | 动画      | 组织相关 | `icons/anime.png`    |
| `offline`  | 线下活动    | 组织相关 | `icons/offline.png`  |
| `private`  | 私人事件    | 个人相关 | `icons/private.png`  |
| `business` | 工作事务    | 个人相关 | `icons/business.png` |
| （留空）       | 无标签/无图标 | —    | —                    |

如需新增 tag 类型，请同时：

1. 在 `icons/` 文件夹放入对应图标（如 `icons/newtag.png`）
2. 在 `index.html` 中的 `TAG_ICONS` 映射表（约第 166 行）添加 `newtag: "icons/newtag.png"`
3. 在 `data.xlsx` 的隐藏工作表 `Lists` 中添加对应值

### 媒体类型详解

**image（图片）**：放在 `images/` 文件夹，用相对路径引用

> **多图轮播**：同一事件 ≥ 2 张图片时，详情框内自动显示为轮播模式（左右箭头切换 + 计数器 "1 / N"），单图仍为普通显示。

**video（视频）**：支持 Bilibili 嵌入。从 Bilibili 分享按钮获取嵌入代码，提取 `src` 中的 URL：

```
https://player.bilibili.com/player.html?bvid=BVxxxxxx
```

> **多视频轮播**：同一事件 ≥ 2 个视频时，同样自动切换为轮播模式。切换到某个视频时自动从头播放，非活跃视频不加载（节省带宽）。

**link（外部链接）**：填写 `media_url` 和 `media_title`，展开详情后显示为可点击链接。

### 重要规则

1. **同一事件的多个媒体**：重复 `date/title/category/description/tag`，在不同行填不同媒体，脚本会自动合并
2. **多图/多视频自动轮播**：≥ 2 张同类型媒体时自动切换轮播模式，无需手动配置
3. **日期格式**：统一使用 `YYYY/M/D`（如 `2023/6/4`），脚本会自动规范化 Excel 日期格式
4. **事件顺序**：按 `date` 从早到晚排列，页面从顶部到底部显示
5. **换行支持**：description 和 media_caption 支持多行文字（Excel 中 Alt+Enter 换行）

---

## 标签图标（Tag Icon）

每个事件的气泡右上角会根据 `tag` 字段自动显示一个小图标。

### tag 到 icon 的映射

在 `index.html`（约第 166 行）的 `TAG_ICONS` 对象中定义：

```javascript
const TAG_ICONS = {
  // 组织相关
  live: "icons/live.png",
  single: "icons/single.png",
  album: "icons/album.png",
  anime: "icons/anime.png",
  offline: "icons/offline.png",
  // 个人相关
  private: "icons/private.png",
  business: "icons/business.png"
};
```

### 图标样式

在 `style.css` 第 260-271 行，可自行调整位置和大小。

### 图标制作建议

- 建议尺寸：52×52px 或 64×64px（会缩放至 26×26px 显示）
- 格式：PNG（支持透明背景）
- 风格：白色或浅色图标（气泡背景是红色/蓝黄渐变）

---

## 修改样式

所有样式在 `style.css` 中，分为以下区块：

### CSS 变量（最常用，第 4-9 行）

```css
:root {
  --detail-width: 340px;                              /* 未展开时详情框宽度 */
  --detail-expanded-width: clamp(400px, 50vw, 750px); /* 展开时详情框宽度（响应式） */
  --edge-gap: clamp(16px, 3vw, 28px);                 /* 刻度/连接线离边缘距离 */
  --bubble-max-width: clamp(360px, 36vw, 520px);      /* 气泡最大宽度 */
}
```

> 详情框高度由媒体内容自动决定，无需手动设置。

### 页面标题（style.css 第 28-40 行）

```css
.page-header h1 { font-size: 26px; color: #ff4d4d; }  /* 大标题 */
.page-header p  { font-size: 13px; color: #666; }      /* 副标题 */
```

### 刻度轴（style.css 第 84-100 行）

```css
.tick-line  { width: 12px; background: #ff4d4d; }  /* 刻度线 */
.tick-label { font-size: 10px; color: #ff4d4d; }   /* 刻度标签（月份） */
```

### 年份标签（style.css 第 102-116 行）

```css
.year-label { font-size: 16px; font-weight: 700; }
```

### 事件气泡（style.css 第 209-258 行）

```css
.b-date  { font-size: 11px; }                    /* 气泡日期 */
.b-title { font-size: 14px; font-weight: 700; }  /* 气泡标题 */

/* 左侧（组织）气泡：红色渐变 */
.event-group.org .bubble { background: linear-gradient(135deg, #b71c1c, #e53935); }
/* 右侧（个人）气泡：蓝黄渐变 */
.event-group.per .bubble { background: linear-gradient(135deg, #1565c0, #f9a825); }
```

### 标签图标（style.css 第 260-271 行）

```css
.tag-icon { width: 26px; height: 26px; }  /* 气泡右上角图标 */
```

### 详情框（style.css 第 273-322 行）

```css
.detail { width: var(--detail-width); }           /* 未展开宽度 */
.detail.open { max-height: 2000px; }              /* 展开最大高度 */
```

### 多图/多视频轮播（style.css 第 324-358 行）

```css
.carousel-arrow { /* 左右箭头按钮 */ }
.carousel-counter { /* "1 / N" 计数器 */ }
```

### 连接虚线（style.css 第 167-183 行）

```css
.connector { flex: 1; }   /* 虚线长度 */
.spacer    { flex: 3; }   /* 缩短虚线的占位器（调大 flex 值虚线更短） */
```

虚线长度 = `connector的flex / (connector的flex + spacer的flex)`。当前 `1/(1+3) = 25%`。

### 详情框内媒体（style.css 第 394-410 行）

```css
.detail img    { width: 100%; height: auto; }         /* 图片自适应宽度 */
.detail iframe { width: 100%; aspect-ratio: 16/9; }   /* 视频 16:9 */
.detail .mc    { font-size: 12px; color: #888; }      /* 媒体说明文字 */
```

### 响应式断点（style.css 第 465-528 行）

- `@media (max-width: 768px)` — 平板/小屏
- `@media (max-width: 480px)` — 手机

---

## 修改页面标题

在 `index.html` 第 12-14 行：

```html
<h1>Ave Mujica TimeLine</h1>
<p>Band & Nonrico</p>
```

改完保存即可，无需运行脚本。

---

## 调整时间轴间距

在 `data.js` 最后一行的 `timelineConfig` 中：

```javascript
pixelsPerDay: 4   // 每天占多少像素，数值越大事件间距越大
```

修改后刷新页面。

> 注意：`pixelsPerDay` 需要手动在 `data.js` 中修改（脚本不覆盖此值）。

### 调整事件间最小间距

在 `index.html` 第 176 行：

```javascript
const MIN_GAP = 10; // 事件之间的最小间距（px）
```

### 调整年份标签与月份刻度间距

在 `index.html` 第 60 行：

```javascript
const YEAR_LABEL_GAP = 60; // 年份标签与月份刻度的间距（px）
```

---

## 部署

本项目是纯静态网站，可部署到任何静态托管服务：

### 方式一：GitHub Pages（免费）

1. 在 GitHub 创建仓库，上传 `web/` 文件夹内容
2. Settings → Pages → Source 选择 `main` 分支
3. 访问 `https://你的用户名.github.io/仓库名`

### 方式二：Vercel（免费）

1. 在 Vercel 导入 GitHub 仓库
2. 自动部署，获得 `https://xxx.vercel.app` 域名

### 方式三：自有域名 + 服务器

将 `web/` 文件夹内容上传到服务器的网站根目录即可。

---

## 常见问题

### Q：运行 `python generate_data.py` 报错？

确保已安装 Python 3 和 openpyxl：

```powershell
pip install openpyxl
```

### Q：图片不显示？

检查路径是否正确。图片放在 `images/` 文件夹，xlsx 中写 `images/文件名.jpg`（相对路径）。

### Q：视频不显示？

目前只支持 Bilibili 嵌入链接。格式为：

```
https://player.bilibili.com/player.html?bvid=BVxxxxxx
```

从 Bilibili 视频页 → 分享 → 嵌入代码 → 复制 `src` 中的 URL。

### Q：标签图标不显示？

1. 确认 `icons/` 文件夹下有对应的 PNG 文件（如 `icons/live.png`）
2. 确认 xlsx 中 `tag` 列的值与 `index.html` 中 `TAG_ICONS` 的 key 一致
3. 确认图标文件名完全匹配（区分大小写）

### Q：如何新增标签类型？

1. 在 `icons/` 放入图标（如 `icons/newtag.png`）
2. 在 `index.html` 的 `TAG_ICONS` 对象中添加 `newtag: "icons/newtag.png"`
3. 在 `data.xlsx` 的隐藏工作表 `Lists` 中添加对应值

### Q：展开事件后详情框与后续事件重叠？

Ctrl+F5 强制刷新浏览器，避免缓存旧版 CSS/JS。

### Q：如何修改详情框展开时的宽度？

修改 `style.css` 第 6 行 `--detail-expanded-width` 的值。

### Q：如何修改刻度/事件气泡离页面边缘的距离？

修改 `style.css` 第 7 行 `--edge-gap` 的值。

### Q：Excel 中换行在网页中不显示？

已支持。在 Excel 单元格中按 Alt+Enter 换行，网页中会自动转为换行显示。如果仍有问题，运行 `python generate_data.py` 重新生成数据。