#!/usr/bin/env python3
"""
读取 data.xlsx，生成 data.js

用法：
  python generate_data.py

XLSX 列说明：
  date        - 日期（YYYY/M/D，脚本自动规范化 Excel 日期格式）
  title       - 事件标题
  category    - organization（左侧/Band）或 personal（右侧/Nonrico）
  description - 事件描述（支持多行换行）
  tag         - 事件标签，用于图标显示和搜索
                live / single / album / anime / offline（组织相关）
                private / business（个人相关）
                留空 = 无标签/无图标
  media_type  - image / video / link（空=无媒体）
  media_src   - 图片路径或视频嵌入URL（image/video 用）
  media_caption - 媒体说明文字（image/video 用）
  media_url   - 外部链接地址（link 用）
  media_title - 外部链接显示文字（link 用）

规则：
  - 同一事件的多个媒体项，重复填写 date/title/category/description/tag
  - 脚本会自动合并为同一事件的 media 数组
"""

import os
import re
from collections import OrderedDict

import openpyxl

OUTPUT_FILE = "data.js"
XLSX_FILE = "data.xlsx"

# 读取 data.xlsx
wb = openpyxl.load_workbook(XLSX_FILE)
ws = wb.active
rows = list(ws.iter_rows(values_only=True))
if len(rows) < 2:
    print(f"错误: {XLSX_FILE} 中没有数据行")
    exit(1)

header = [str(h) if h else "" for h in rows[0]]
data_rows = []
for row in rows[1:]:
    data_rows.append([str(c) if c is not None else "" for c in row])
print(f"从 {XLSX_FILE} 读取了 {len(data_rows)} 行数据")

# 构建列索引映射
col_map = {name.strip().lower(): i for i, name in enumerate(header)}

def get_col(row, name):
    idx = col_map.get(name.strip().lower())
    if idx is not None and idx < len(row):
        return (row[idx] or "").strip()
    return ""

def normalize_date(raw):
    """统一日期格式为 YYYY/M/D"""
    raw = raw.strip()
    if not raw:
        return raw
    # 匹配 Excel 日期时间格式: 2024-12-26 00:00:00
    m = re.match(r"(\d{4})-(\d{1,2})-(\d{1,2})\s", raw)
    if m:
        return f"{m.group(1)}/{int(m.group(2))}/{int(m.group(3))}"
    # 匹配 ISO 格式: 2024-12-26
    m = re.match(r"(\d{4})-(\d{1,2})-(\d{1,2})$", raw)
    if m:
        return f"{m.group(1)}/{int(m.group(2))}/{int(m.group(3))}"
    # 已经是 YYYY/M/D 格式，直接返回
    return raw

# 读取事件
events = OrderedDict()  # key: (date, title, category, desc, tag), value: media list

for row in data_rows:
    key = (
        normalize_date(get_col(row, "date")),
        get_col(row, "title"),
        get_col(row, "category"),
        get_col(row, "description"),
        get_col(row, "tag")
    )

    if key not in events:
        events[key] = []

    mt = get_col(row, "media_type").lower()

    media = None
    if mt == "image":
        media = {"type": "image", "src": get_col(row, "media_src")}
        caption = get_col(row, "media_caption")
        if caption:
            media["caption"] = caption
    elif mt == "video":
        media = {"type": "video", "src": get_col(row, "media_src")}
        caption = get_col(row, "media_caption")
        if caption:
            media["caption"] = caption
    elif mt == "link":
        media = {"type": "link", "url": get_col(row, "media_url")}
        title = get_col(row, "media_title")
        if title:
            media["title"] = title

    if media:
        events[key].append(media)

# 生成 data.js
def js_str(s):
    """转义 JS 字符串中的特殊字符（换行、引号、反斜杠）"""
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n").replace("\r", "")

lines = []
lines.append("// 时间轴数据")
lines.append("// 由 generate_data.py 自动生成，请勿手动修改")
lines.append("// 编辑 data.xlsx 后运行「一键更新数据.bat」即可更新")
lines.append("")
lines.append("const timelineData = [")

event_items = list(events.items())
for i, (key, media_list) in enumerate(event_items):
    date, title, category, desc, tag = key
    lines.append("  {")
    lines.append(f'    date: "{js_str(date)}",')
    lines.append(f'    title: "{js_str(title)}",')
    lines.append(f'    category: "{js_str(category)}",')
    lines.append(f'    description: "{js_str(desc)}",')
    lines.append(f'    tag: "{js_str(tag)}",')
    if media_list:
        lines.append("    media: [")
        for j, m in enumerate(media_list):
            if m["type"] == "image":
                cap = f', caption: "{js_str(m["caption"])}"' if "caption" in m else ""
                lines.append(f'      {{ type: "image", src: "{js_str(m["src"])}"{cap} }}' + ("," if j < len(media_list) - 1 else ""))
            elif m["type"] == "video":
                cap = f', caption: "{js_str(m["caption"])}"' if "caption" in m else ""
                lines.append(f'      {{ type: "video", src: "{js_str(m["src"])}"{cap} }}' + ("," if j < len(media_list) - 1 else ""))
            elif m["type"] == "link":
                ttl = f', title: "{js_str(m["title"])}"' if "title" in m else ""
                lines.append(f'      {{ type: "link", url: "{js_str(m["url"])}"{ttl} }}' + ("," if j < len(media_list) - 1 else ""))
        lines.append("    ]")
    else:
        lines.append("    media: []")
    lines.append("  }" + ("," if i < len(event_items) - 1 else ""))

lines.append("];")
lines.append("")
lines.append("// 时间轴配置")
lines.append("const timelineConfig = {")
lines.append('  zeroDate: "2023-06-04",')
lines.append("  pixelsPerDay: 4 // 每一天占多少像素，可自行调整")
lines.append("};")

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")

print(f"Done! {len(event_items)} events written to {OUTPUT_FILE}")