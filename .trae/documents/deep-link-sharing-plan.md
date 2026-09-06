# Deep-Link 分享功能实现计划

## 背景

用户希望将某个具体的访谈、歌曲或 Live 演出的 URL 复制分享给他人，而不是只能分享分页的 index 页。目前 Songs 和 Interview 页面已有基础的 hash 读取支持，但打开 item 时不会更新 URL 栏；Live 页面完全没有 hash 支持。

## 方案

使用 `history.replaceState` 在打开/关闭 item 时更新 URL hash，不产生浏览器历史记录。三个页面统一模式：

| 页面 | Hash 格式 | 标识符 |
|------|----------|--------|
| Songs | `#song=NAME_JP` | `s.name_jp` |
| Interview | `#TITLE` | `item.title` |
| Live | `#live=NAME` | `live.name` |

## 需修改的文件

### 1. `songs/index.html` — 打开/关闭时更新 hash

- **`openModal`**：在缓存路径和非缓存路径中，打开后写入 `history.replaceState(null, '', '#song=' + encodeURIComponent(song.name_jp))`
- **`closeModal`**：关闭时清除 hash：`history.replaceState(null, '', window.location.pathname + window.location.search)`
- 已有的 hash 读取逻辑（`#song=NAME_JP`）不需要修改

### 2. `interview/index.html` — 重构关闭逻辑，打开时更新 hash

- **提取 `closeCinematic` 函数**：将 X 按钮、遮罩点击、ESC 三处重复的关闭逻辑合并，统一在其中清除 hash
- **`openCinematic`**：打开后写入 `history.replaceState(null, '', '#' + encodeURIComponent(item.title))`
- 已有的 hash 读取逻辑（`#INDEX` 和 `#TITLE`）不需要修改

### 3. `live/index.html` — 新增完整的 hash 读写支持

- **`openDrawer`**：打开后写入 `history.replaceState(null, '', '#live=' + encodeURIComponent(live.name))`
- **`closeDrawer`**：关闭时清除 hash
- **ESC 键处理**：关闭 drawer 时清除 hash
- **页面加载时读取 hash**：`#live=NAME` 自动打开对应 drawer（用 `setTimeout` 延迟 200ms 确保 DOM 就绪）

## 关键技术细节

- 使用 `history.replaceState`（非 `pushState`），不污染浏览器后退历史
- 清除 hash 时保留 `pathname + search`（如 `?v=...` 缓存版本号）
- 所有标识符用 `encodeURIComponent`/`decodeURIComponent` 处理特殊字符
- Songs 页面嵌入的 Interview 浮层不添加 hash 支持（避免与 `#song=` 冲突）

## 验证方式

1. 打开任意 Live 抽屉 → URL 栏显示 `#live=...` → 复制 URL 新标签页打开 → 自动打开
2. 打开任意歌曲灯箱 → URL 栏显示 `#song=...` → 复制 URL 新标签页打开 → 自动打开
3. 打开任意访谈浮层 → URL 栏显示 `#TITLE` → 复制 URL 新标签页打开 → 自动打开
4. 测试含特殊字符的条目（emoji、日文、`~`、`?`）都能正确编码/解码
5. 关闭弹窗时 hash 清除，后退按钮不会循环弹窗状态