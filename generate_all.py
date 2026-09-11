#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
唯鸡百科 · 统一数据生成工具
=============================
从 _data/data.xlsx 统一生成所有模块的 JS 数据文件。
"""

import os
import re
import json
import hashlib
import sys
from collections import OrderedDict
from datetime import datetime

# 修复 Windows 控制台编码（windowed exe 无控制台则跳过）
if sys.platform == "win32" and sys.stdout is not None:
    import io
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

try:
    import openpyxl
except ImportError:
    print("缺少 openpyxl 库，请运行: pip install openpyxl")
    sys.exit(1)

try:
    from sudachipy import Dictionary, SplitMode
    import jieba.posseg as jieba_posseg
    HAS_LEXICON_NLP = True
except ImportError:
    HAS_LEXICON_NLP = False

# 词性过滤后仍会剩下一些“语法上是实词、主题上却没有辨识度”的泛词。
# 这份基础表是默认清洗层；后续可再通过 Excel 维护项目专属的保留/排除词。
LEXICON_DEFAULT_STOP_WORDS = {
    "jp": {
        "いる", "ある", "する", "なる", "ない", "そう", "もう", "まだ", "まま",
        "もの", "こと", "よう", "ため", "中", "今", "今日", "全部", "あっぷ"
    },
    "cn": {
        "是", "会", "来", "去", "请", "成为", "让", "要", "想", "能", "可以",
        "没有", "不会", "已经", "还是", "只是", "如果", "因为", "所以", "这个", "那个"
    },
    "en": {
        "a", "an", "the", "and", "or", "but", "so", "to", "of", "in", "on", "at", "for",
        "from", "with", "by", "up", "down", "out", "off", "you", "me", "my", "your", "we",
        "our", "it", "its", "be", "am", "is", "are", "was", "were", "do", "does", "did",
        "gonna", "wanna", "yeah", "ya", "oh", "ah", "woah", "hey", "ever", "nyou", "daa",
        "yes", "know", "want", "la"
    }
}

def murmurhash3_128(key, seed=0):
    """MurmurHash3 128-bit (x64) → 返回 128-bit 整数"""
    data = key.encode('utf-8') if isinstance(key, str) else key
    length = len(data)
    c1 = 0x87c37b91114253d5
    c2 = 0x4cf5ad432745937f
    h1 = h2 = seed & 0xFFFFFFFFFFFFFFFF
    nblocks = length // 16
    for i in range(nblocks):
        k1 = int.from_bytes(data[i*16:i*16+8], 'little')
        k2 = int.from_bytes(data[i*16+8:i*16+16], 'little')
        h1 ^= (fmix64(k1 * c1) * c2) & 0xFFFFFFFFFFFFFFFF
        h1 = ((h1 << 27) | (h1 >> 37)) & 0xFFFFFFFFFFFFFFFF
        h1 = (h1 + h2) & 0xFFFFFFFFFFFFFFFF
        h1 = (h1 * 5 + 0x52dce729) & 0xFFFFFFFFFFFFFFFF
        h2 ^= (fmix64(k2 * c2) * c1) & 0xFFFFFFFFFFFFFFFF
        h2 = ((h2 << 31) | (h2 >> 33)) & 0xFFFFFFFFFFFFFFFF
        h2 = (h2 + h1) & 0xFFFFFFFFFFFFFFFF
        h2 = (h2 * 5 + 0x38495ab5) & 0xFFFFFFFFFFFFFFFF
    tail = data[nblocks * 16:]
    k1 = k2 = 0
    if len(tail) >= 8:
        k1 = int.from_bytes(tail[0:8], 'little')
        if len(tail) > 8:
            k2 = int.from_bytes(tail[8:], 'little')
    elif len(tail) > 0:
        k1 = int.from_bytes(tail, 'little')
    if len(tail) >= 8:
        h1 ^= (fmix64(k1 * c1) * c2) & 0xFFFFFFFFFFFFFFFF
        if len(tail) > 8:
            h2 ^= (fmix64(k2 * c2) * c1) & 0xFFFFFFFFFFFFFFFF
    elif len(tail) > 0:
        h1 ^= (fmix64(k1 * c1) * c2) & 0xFFFFFFFFFFFFFFFF
    h1 ^= length
    h2 ^= length
    h1 = (h1 + h2) & 0xFFFFFFFFFFFFFFFF
    h2 = (h2 + h1) & 0xFFFFFFFFFFFFFFFF
    h1 = fmix64(h1)
    h2 = fmix64(h2)
    h1 = (h1 + h2) & 0xFFFFFFFFFFFFFFFF
    h2 = (h2 + h1) & 0xFFFFFFFFFFFFFFFF
    return (h1 << 64) | h2

def fmix64(k):
    k ^= k >> 33
    k = (k * 0xff51afd7ed558ccd) & 0xFFFFFFFFFFFFFFFF
    k ^= k >> 33
    k = (k * 0xc4ceb9fe1a85ec53) & 0xFFFFFFFFFFFFFFFF
    k ^= k >> 33
    return k

BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

def hash_id(*parts):
    """用 MurmurHash3 + Base62 生成 11 位唯一分享码"""
    key = "|".join(str(p) for p in parts if p)
    h = murmurhash3_128(key)
    # 取 murmurhash 128-bit 做 Base62 编码，截取前 11 位
    result = []
    while h > 0 and len(result) < 11:
        result.append(BASE62[h % 62])
        h //= 62
    while len(result) < 11:
        result.append('0')
    return ''.join(reversed(result))

# =========================== 路径配置 ===========================
if getattr(sys, 'frozen', False):
    # PyInstaller --onefile: 数据文件从 exe 所在目录读取，输出也到 exe 所在目录
    BUNDLE_DIR = sys._MEIPASS
    ROOT = os.path.dirname(sys.executable)
else:
    BUNDLE_DIR = os.path.dirname(os.path.abspath(__file__))
    ROOT = BUNDLE_DIR

DATA_DIR = os.path.join(ROOT, "_data")
DOCS_DIR = os.path.join(ROOT, "_data", "_docs")
XLSX_PATH = os.path.join(DATA_DIR, "data.xlsx")

# 输出文件路径
OUTPUTS = {
    "announcements": os.path.join(ROOT, "announcements.js"),
    "songs":         os.path.join(ROOT, "songs", "data.js"),
    "lyrics_atlas":  os.path.join(ROOT, "songs", "lyrics-atlas-data.js"),
    "live":          os.path.join(ROOT, "live", "data.js"),
    "timeline":      os.path.join(ROOT, "timeline", "data.js"),
    "gallery":       os.path.join(ROOT, "gallery", "data.js"),
    "interview":     os.path.join(ROOT, "interview", "data.js"),
    "discography":   os.path.join(ROOT, "discography", "data.js"),
}

# 旧 xlsx 文件路径（用于 --init 合并）
OLD_XLSX = {
    "announcements":  os.path.join(ROOT, "announcements.xlsx"),
    "songs":          os.path.join(ROOT, "songs", "data.xlsx"),
    "live":           os.path.join(ROOT, "live", "data.xlsx"),
    "timeline":       os.path.join(ROOT, "timeline", "data.xlsx"),
    "gallery":        os.path.join(ROOT, "gallery", "data.xlsx"),
    "interview":      os.path.join(ROOT, "interview", "data.xlsx"),
}


# =========================== 工具函数 ===========================
def js_str(s):
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n").replace("\r", "")

def normalize_date(raw):
    """统一日期格式为 YYYY/M/D"""
    raw = raw.strip()
    if not raw:
        return raw
    m = re.match(r"(\d{4})-(\d{1,2})-(\d{1,2})\s", raw)
    if m:
        return f"{m.group(1)}/{int(m.group(2))}/{int(m.group(3))}"
    m = re.match(r"(\d{4})-(\d{1,2})-(\d{1,2})$", raw)
    if m:
        return f"{m.group(1)}/{int(m.group(2))}/{int(m.group(3))}"
    return raw

def fix_path(p, module_dir):
    """将 images/ 路径转为相对 HTML 的路径"""
    p = p.strip()
    if not p:
        return p
    if module_dir == "root":
        return p
    if p.startswith("images/") or p.startswith("icons/"):
        return "../" + p
    return p

def read_sheet(wb, sheet_name):
    """读取 sheet 为 dict 列表"""
    if sheet_name not in wb.sheetnames:
        return []
    ws = wb[sheet_name]
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) < 2:
        return []
    header = [str(h).strip() if h else "" for h in rows[0]]
    result = []
    for row in rows[1:]:
        d = {}
        for i, h in enumerate(header):
            if h:
                val = row[i]
                d[h.lower()] = str(val).strip() if val is not None and str(val).strip() != "None" else ""
        if any(v for v in d.values()):
            result.append(d)
    return result


def render_md_to_html(md):
    """预渲染 Markdown → HTML（保留 [original] [cN] [br] [translation] 标签供浏览器动态处理）"""
    if not md:
        return ""
    html = md

    # 1. 代码块保护
    code_blocks = []
    def save_code(m):
        idx = len(code_blocks)
        code_blocks.append(m.group(2).strip())
        return f"<!--CODEBLOCK_{idx}-->"
    html = re.sub(r'```\w*\n(.*?)```', save_code, html, flags=re.DOTALL)

    # 2. 转义 HTML
    html = html.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    # 3. 还原代码块
    def restore_code(m):
        idx = int(m.group(1))
        return f"<pre><code>{code_blocks[idx]}</code></pre>"
    html = re.sub(r'<!--CODEBLOCK_(\d+)-->', restore_code, html)

    # 保留 [original] [cN] [br] [translation] 不处理，留给浏览器

    # 4. 标题
    html = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
    html = re.sub(r'^## (.+)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
    html = re.sub(r'^# (.+)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)

    # 5. 粗体 / 斜体
    html = re.sub(r'\*\*\*(.+?)\*\*\*', r'<strong><em>\1</em></strong>', html)
    html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)
    html = re.sub(r'\*(.+?)\*', r'<em>\1</em>', html)

    # 6. 图片
    html = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', r'<img src="\2" alt="\1" loading="lazy">', html)

    # 7. 链接
    html = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2" target="_blank" rel="noopener">\1</a>', html)

    # 8. 引用块
    html = re.sub(r'^&gt; (.+)$', r'<blockquote><p>\1</p></blockquote>', html, flags=re.MULTILINE)

    # 9. 横线
    html = re.sub(r'^---$', r'<hr>', html, flags=re.MULTILINE)

    # 10. 无序列表
    html = re.sub(r'^[\-\*] (.+)$', r'<li>\1</li>', html, flags=re.MULTILINE)
    html = re.sub(r'((?:<li>.*</li>\n?)+)', r'<ul>\1</ul>', html)

    # 11. 有序列表
    html = re.sub(r'^\d+\. (.+)$', r'<li>\1</li>', html, flags=re.MULTILINE)
    def wrap_ol(m):
        if '<ul>' in m.group(0):
            return m.group(0)
        return '<ol>' + m.group(0) + '</ol>'
    html = re.sub(r'((?:<li>.*</li>\n?)+)', wrap_ol, html)

    # 12. [br] 空行标签 → 唯一占位符（在段落处理前替换）
    #     吞掉其前后紧邻的换行，使 [br] 自成一个"手动空行"单元，
    #     避免这些换行在后续被转成 <br> 而与 [br] 叠加产生多层间距。
    #     必须放在标题/列表/引用等块级处理后，避免占位符与块级标签粘连。
    html = re.sub(r'\n*\[br\]\n*', '__CUSTOM_BR__', html)

    # 13. 段落：普通空行仅作为段落边界，不再插入 <p>&nbsp;</p> 等视觉空行
    def para_handler(m):
        return '</p><p>'
    html = re.sub(r'\n\n+', para_handler, html)

    # 14. 单换行 → 软换行（普通换行，不产生视觉空行）
    html = html.replace('\n', '<br>')

    # 15. 包裹
    html = '<p>' + html + '</p>'

    # 16. 清理空段落与无意义的空白结构
    html = re.sub(r'<p>\s*</p>', '', html)
    html = re.sub(r'<p>(?:<br\s*/?>\s*)+</p>', '', html)

    # 17. 占位符 → 手动空行（唯一允许产生视觉空行的元素）
    html = html.replace('__CUSTOM_BR__', '<div class="manual-br"></div>')

    # 18. 移除紧邻块级元素的 <br>
    #     块级元素（标题/图片/列表/引用/代码块/横线等）自身已提供垂直换行，
    #     单换行被转成 <br> 后紧邻它们会产生多余空行，需移除。
    _block_open = r'<(?:h[1-6]|ul|ol|li|blockquote|pre|hr|img)[^>]*/?>'
    _block_close = r'</(?:h[1-6]|ul|ol|li|blockquote|pre)>'
    html = re.sub(r'(?:' + _block_open + r'|' + _block_close + r')\s*<br>',
                  lambda m: m.group(0).replace('<br>', ''), html)
    html = re.sub(r'<br>\s*(?:' + _block_open + r')',
                  lambda m: m.group(0).replace('<br>', ''), html)

    # 19. 移除自定义标签（[original] [/original] [translation]）前后由单换行产生的 <br>
    #     这些标签是结构性标记（块级），前后的软换行 <br> 是多余的，会产生视觉空行。
    for _token in ('[original]', '[/original]', '[translation]'):
        html = html.replace('<br>' + _token, _token)
        html = html.replace(_token + '<br>', _token)

    return html


# =========================== 1. 公告 ===========================
def generate_announcements(wb):
    raw = read_sheet(wb, "announcements")
    pinned_list = []
    normal_list = []
    for r in raw:
        pinned = str(r.get("pinned", "")).strip().lower() in ("1", "true", "yes")
        item = {
            "date": r.get("date", "").strip(),
            "msg": r.get("msg", "").strip(),
            "pinned": pinned
        }
        if pinned:
            pinned_list.append(item)
        else:
            normal_list.append(item)
    # 置顶在前，普通条目反转（Excel 底部 = 最新 = 靠前显示）
    normal_list.reverse()
    data = pinned_list + normal_list
    js = "// 自动生成，请勿手动编辑。运行 generate_all.py 更新\n"
    js += "window.ANNOUNCEMENTS = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n"
    with open(OUTPUTS["announcements"], "w", encoding="utf-8") as f:
        f.write(js)
    return len(data)


# =========================== 2. 歌曲 ===========================
def require_lexicon_nlp():
    if not HAS_LEXICON_NLP:
        raise RuntimeError(
            "歌词词云缺少分词依赖，请运行: "
            "pip install sudachipy sudachidict_small jieba"
        )


def lyrics_clean_text(text):
    return re.sub(r"[（(][^）)]*[）)]", " ", text or "")


def japanese_lexicon_tokens(text, tokenizer):
    """保留日语实词，并用词典形合并动词、形容词的活用。"""
    keep_pos = {"名詞", "動詞", "形容詞", "副詞"}
    tokens = []
    for morpheme in tokenizer.tokenize(lyrics_clean_text(text), SplitMode.C):
        pos = morpheme.part_of_speech()
        if not pos or pos[0] not in keep_pos:
            continue
        # 代词在歌词中频率很高，但对主题词云的辨识度有限。
        if len(pos) > 1 and pos[1] == "代名詞":
            continue
        word = morpheme.dictionary_form() or morpheme.surface()
        if word in ("*", "", None) or re.fullmatch(r"[\W_]+", word):
            continue
        if len(word) == 1 and re.fullmatch(r"[A-Za-z]", word):
            continue
        normalized = word.lower() if re.fullmatch(r"[A-Za-z]+", word) else word
        if normalized in LEXICON_DEFAULT_STOP_WORDS["jp"] or normalized in LEXICON_DEFAULT_STOP_WORDS["en"]:
            continue
        tokens.append(normalized)
    return tokens


def chinese_lexicon_tokens(text):
    """保留中文实词和专有名词，过滤结构助词、语气词、代词等。"""
    keep_prefixes = ("n", "v", "a")
    keep_exact = {"eng", "nz", "vn", "an", "j"}
    tokens = []
    for pair in jieba_posseg.cut(lyrics_clean_text(text)):
        word = pair.word.strip()
        flag = pair.flag or ""
        if not word or not (flag.startswith(keep_prefixes) or flag in keep_exact):
            continue
        if re.fullmatch(r"[\W_]+", word) or (len(word) == 1 and re.fullmatch(r"[A-Za-z]", word)):
            continue
        normalized = word.lower() if re.fullmatch(r"[A-Za-z]+", word) else word
        if normalized in LEXICON_DEFAULT_STOP_WORDS["cn"] or normalized in LEXICON_DEFAULT_STOP_WORDS["en"]:
            continue
        tokens.append(normalized)
    return tokens


def generate_lyrics_atlas_data(songs):
    """为 Lyrics Atlas 预计算仅原创曲目的、已按词性过滤的词频。"""
    require_lexicon_nlp()
    japanese_tokenizer = Dictionary(dict="small").create()
    result = {"jp": {"track_count": 0, "terms": {}}, "cn": {"track_count": 0, "terms": {}}}

    for song in songs:
        if song.get("type") != "Original":
            continue
        for language, lyric_key in (("jp", "lyrics_jp"), ("cn", "lyrics_cn")):
            lyrics = song.get(lyric_key, "").strip()
            if not lyrics:
                continue
            result[language]["track_count"] += 1
            tokens = japanese_lexicon_tokens(lyrics, japanese_tokenizer) if language == "jp" else chinese_lexicon_tokens(lyrics)
            for word in tokens:
                item = result[language]["terms"].setdefault(word, {"word": word, "count": 0, "songs": {}})
                item["count"] += 1
                item["songs"][song["hash_id"]] = item["songs"].get(song["hash_id"], 0) + 1

    data = {}
    for language in ("jp", "cn"):
        terms = list(result[language]["terms"].values())
        terms.sort(key=lambda item: (-item["count"], -len(item["songs"]), item["word"]))
        data[language] = {"track_count": result[language]["track_count"], "terms": terms}

    js = "// Lyrics Atlas 词频数据（自动生成，请勿手动修改）\n"
    js += "window.LYRICS_ATLAS_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
    with open(OUTPUTS["lyrics_atlas"], "w", encoding="utf-8") as f:
        f.write(js)
    return {language: len(data[language]["terms"]) for language in ("jp", "cn")}


def generate_songs(wb):
    songs_raw = read_sheet(wb, "songs")
    comments_raw = read_sheet(wb, "song_comments")
    live_raw = read_sheet(wb, "song_live_history")

    # 合并 comments
    comments_map = {}
    for cr in comments_raw:
        sn = cr.get("song_name", "")
        if not sn:
            continue
        comments_map.setdefault(sn, []).append({
            "text": cr.get("comment_text", ""),
            "source": cr.get("comment_source", ""),
            "from": cr.get("comment_from", ""),
            "date": normalize_date(cr.get("comment_date", ""))
        })

    # 合并 live_history
    live_map = {}
    for lr in live_raw:
        sn = lr.get("song_name", "")
        if not sn:
            continue
        live_map.setdefault(sn, []).append({
            "date": normalize_date(lr.get("live_date", "")),
            "venue": lr.get("live_venue", ""),
            "name": lr.get("live_name", ""),
            "has_video": lr.get("has_video", "").lower() == "yes",
            "video_url": lr.get("video_url", "")
        })

    songs = []
    for s in songs_raw:
        sn = s.get("song_name", "")
        if not sn:
            continue
        songs.append({
            "name": sn,
            "name_jp": s.get("song_name_jp", ""),
            "hash_id": hash_id(sn, s.get("song_name_jp", ""), normalize_date(s.get("release_date", ""))),
            "album": s.get("album", ""),
            "album_year": s.get("album_year", ""),
            "release_date": normalize_date(s.get("release_date", "")),
            "cover": fix_path(s.get("cover", ""), "songs"),
            "type": s.get("type", ""),
            "lyricist": s.get("lyricist", ""),
            "composer": s.get("composer", ""),
            "arranger": s.get("arranger", ""),
            "first_stage": s.get("first_stage", ""),
            "mv_url": s.get("mv_url", ""),
            "lyrics_jp": s.get("lyrics_jp", ""),
            "lyrics_cn": s.get("lyrics_cn", ""),
            "search_keywords": s.get("search_keywords", ""),
            "appearances": [a.strip() for a in s.get("appearances", "").split(",") if a.strip()],
            "comments": comments_map.get(sn, []),
            "live_history": live_map.get(sn, [])
        })

    lines = []
    lines.append("// 曲目数据")
    lines.append("// 由 generate_all.py 自动生成，请勿手动修改")
    lines.append("")
    lines.append("const songsData = [")
    for i, song in enumerate(songs):
        lines.append("  {")
        lines.append(f'    name: "{js_str(song["name"])}",')
        lines.append(f'    name_jp: "{js_str(song["name_jp"])}",')
        lines.append(f'    hash_id: "{js_str(song["hash_id"])}",')
        lines.append(f'    album: "{js_str(song["album"])}",')
        lines.append(f'    album_year: "{js_str(song["album_year"])}",')
        lines.append(f'    release_date: "{js_str(song["release_date"])}",')
        lines.append(f'    cover: "{js_str(song["cover"])}",')
        lines.append(f'    type: "{js_str(song["type"])}",')
        lines.append(f'    lyricist: "{js_str(song["lyricist"])}",')
        lines.append(f'    composer: "{js_str(song["composer"])}",')
        lines.append(f'    arranger: "{js_str(song["arranger"])}",')
        lines.append(f'    first_stage: "{js_str(song["first_stage"])}",')
        lines.append(f'    mv_url: "{js_str(song["mv_url"])}",')
        lines.append(f'    lyrics_jp: "{js_str(song["lyrics_jp"])}",')
        lines.append(f'    lyrics_cn: "{js_str(song["lyrics_cn"])}",')
        lines.append(f'    search_keywords: "{js_str(song["search_keywords"])}",')
        lines.append(f'    appearances: {json.dumps(song["appearances"], ensure_ascii=False)},')
        if song["comments"]:
            lines.append("    comments: [")
            for j, c in enumerate(song["comments"]):
                comma = "," if j < len(song["comments"]) - 1 else ""
                lines.append(f'      {{ text: "{js_str(c["text"])}", source: "{js_str(c["source"])}", from: "{js_str(c["from"])}", date: "{js_str(c.get("date", ""))}" }}{comma}')
            lines.append("    ],")
        else:
            lines.append("    comments: [],")
        if song["live_history"]:
            lines.append("    live_history: [")
            for j, lh in enumerate(song["live_history"]):
                comma = "," if j < len(song["live_history"]) - 1 else ""
                lines.append(f'      {{ date: "{js_str(lh["date"])}", venue: "{js_str(lh["venue"])}", name: "{js_str(lh["name"])}", has_video: {"true" if lh["has_video"] else "false"}, video_url: "{js_str(lh["video_url"])}" }}{comma}')
            lines.append("    ]")
        else:
            lines.append("    live_history: []")
        lines.append("  }" + ("," if i < len(songs) - 1 else ""))
    lines.append("];")

    with open(OUTPUTS["songs"], "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    generate_lyrics_atlas_data(songs)
    return len(songs)


# =========================== 3. 演唱会 ===========================
def generate_live(wb):
    lives_raw = read_sheet(wb, "lives")
    setlist_raw = read_sheet(wb, "setlist")
    backstage_raw = read_sheet(wb, "backstage")

    # 合并 setlist
    setlist_map = {}
    for sr in setlist_raw:
        sn = sr.get("live_name", "")
        if not sn:
            continue
        setlist_map.setdefault(sn, []).append({
            "num": sr.get("track_num", ""),
            "title": sr.get("track_title", ""),
            "highlight_label": sr.get("highlight_label", ""),
            "highlight_text": sr.get("highlight_text", ""),
            "mc_file": sr.get("mc_file", ""),
            "link": sr.get("link", ""),
        })

    # 合并 backstage
    backstage_map = {}
    for br in backstage_raw:
        sn = br.get("live_name", "")
        if not sn:
            continue
        backstage_map.setdefault(sn, []).append({
            "photo": fix_path(br.get("photo", ""), "live"),
            "credit": br.get("credit", ""),
            "credit_text": br.get("credit_text", ""),
            "source_url": br.get("source_url", ""),
            "source_label": br.get("source_label", ""),
            "group_id": br.get("group_id", "")
        })

    lives = []
    for l in lives_raw:
        name = l.get("live_name", "")
        if not name:
            continue
        lives.append({
            "name": name,
            "hash_id": hash_id(name, normalize_date(l.get("live_date", "")), l.get("live_venue", "")),
            "date": normalize_date(l.get("live_date", "")),
            "venue": l.get("live_venue", ""),
            "tag": l.get("live_tag", ""),
            "poster": fix_path(l.get("poster", ""), "live"),
            "kv": fix_path(l.get("kv", ""), "live"),
            "video_url": l.get("video_url", ""),
            "description": l.get("description", ""),
            "for_short": l.get("for short", ""),
            "setlist": setlist_map.get(name, []),
            "backstage": backstage_map.get(name, [])
        })

    # 加载 MC 内容
    MC_DIR = os.path.join(ROOT, "_data")
    mc_count = 0
    for live in lives:
        for track in live.get("setlist", []):
            mc_file = track.get("mc_file", "").strip()
            if mc_file:
                md_path = os.path.join(MC_DIR, mc_file)
                if os.path.isfile(md_path):
                    with open(md_path, "r", encoding="utf-8") as f:
                        track["mc_content"] = render_md_to_html(f.read())
                    mc_count += 1

    lines = []
    lines.append("// 演唱会数据")
    lines.append("// 由 generate_all.py 自动生成，请勿手动修改")
    lines.append("")
    lines.append("const livesData = [")
    for i, live in enumerate(lives):
        lines.append("  {")
        lines.append(f'    name: "{js_str(live["name"])}",')
        lines.append(f'    hash_id: "{js_str(live["hash_id"])}",')
        lines.append(f'    date: "{js_str(live["date"])}",')
        lines.append(f'    venue: "{js_str(live["venue"])}",')
        lines.append(f'    tag: "{js_str(live["tag"])}",')
        lines.append(f'    poster: "{js_str(live["poster"])}",')
        lines.append(f'    kv: "{js_str(live["kv"])}",')
        lines.append(f'    video_url: "{js_str(live["video_url"])}",')
        lines.append(f'    description: "{js_str(live["description"])}",')
        lines.append(f'    for_short: "{js_str(live["for_short"])}",')
        lines.append(f'    setlist: {json.dumps(live["setlist"], ensure_ascii=False)},')
        lines.append(f'    backstage: {json.dumps(live["backstage"], ensure_ascii=False)}')
        lines.append("  }" + ("," if i < len(lives) - 1 else ""))
    lines.append("];")

    with open(OUTPUTS["live"], "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return len(lives), mc_count


# =========================== 4. 时间轴 ===========================
def generate_timeline(wb):
    raw = read_sheet(wb, "timeline")
    if not raw:
        return 0

    # 构建列映射
    header_keys = list(raw[0].keys())
    data_rows = []
    for d in raw:
        data_rows.append([d.get(k, "") for k in header_keys])

    # 构建列索引
    col_map = {name.strip().lower(): i for i, name in enumerate(header_keys)}
    def get_col(row, name):
        idx = col_map.get(name.strip().lower())
        if idx is not None and idx < len(row):
            return (row[idx] or "").strip()
        return ""

    events = OrderedDict()
    grouped_rows = OrderedDict()

    for row in data_rows:
        group = get_col(row, "group")
        date = normalize_date(get_col(row, "date"))
        title = get_col(row, "title")
        category = get_col(row, "category")
        desc = get_col(row, "description")
        tag = get_col(row, "tag")
        mt = get_col(row, "media_type").lower()

        if group:
            grouped_rows.setdefault(group, []).append({
                "date": date, "title": title, "category": category,
                "desc": desc, "tag": tag, "media_type": mt,
                "media_src": get_col(row, "media_src"),
                "media_caption": get_col(row, "media_caption"),
                "media_url": get_col(row, "media_url"),
                "media_title": get_col(row, "media_title"),
            })
            continue

        key = (date, title, category, desc, tag)
        events.setdefault(key, [])
        media = None
        if mt == "image":
            media = {"type": "image", "src": fix_path(get_col(row, "media_src"), "timeline")}
            if get_col(row, "media_caption"):
                media["caption"] = get_col(row, "media_caption")
        elif mt == "video":
            media = {"type": "video", "src": get_col(row, "media_src")}
            if get_col(row, "media_caption"):
                media["caption"] = get_col(row, "media_caption")
        elif mt == "link":
            media = {"type": "link", "url": get_col(row, "media_url")}
            if get_col(row, "media_title"):
                media["title"] = get_col(row, "media_title")
        if media:
            events[key].append(media)

    # 处理分组事件
    for group_name, rows in grouped_rows.items():
        dates = sorted(set(r["date"] for r in rows if r["date"]))
        merged_date = dates[0] if len(dates) == 1 else f"{dates[0]} - {dates[-1]}"
        first = rows[0]
        key = (merged_date, first["title"], first["category"], first["desc"], first["tag"])
        events[key] = []
        for r in rows:
            mt = r["media_type"].lower()
            media = None
            if mt == "image":
                media = {"type": "image", "src": fix_path(r["media_src"], "timeline")}
                if r["media_caption"]:
                    media["caption"] = r["media_caption"]
            elif mt == "video":
                media = {"type": "video", "src": r["media_src"]}
                if r["media_caption"]:
                    media["caption"] = r["media_caption"]
            elif mt == "link":
                media = {"type": "link", "url": r["media_url"]}
                if r["media_title"]:
                    media["title"] = r["media_title"]
            if media:
                events[key].append(media)

    lines = []
    lines.append("// 时间轴数据")
    lines.append("// 由 generate_all.py 自动生成，请勿手动修改")
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
    lines.append("const timelineConfig = {")
    lines.append('  zeroDate: "2023-06-04",')
    lines.append("  pixelsPerDay: 4")
    lines.append("};")

    with open(OUTPUTS["timeline"], "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return len(event_items)


# =========================== 5. 画廊 ===========================
def parse_gallery_tags(raw_tags):
    """解析 "LIVE:0th, LIVE:1st" 为嵌套 dict"""
    result = {}
    if not raw_tags:
        return result
    for tag in raw_tags.split(","):
        tag = tag.strip()
        if not tag:
            continue
        if ":" in tag:
            cat, sub = tag.split(":", 1)
            cat, sub = cat.strip(), sub.strip()
            if sub:
                result.setdefault(cat, [])
                if sub not in result[cat]:
                    result[cat].append(sub)
        else:
            cat = tag.strip()
            if cat and cat not in result:
                result[cat] = []
    return result

def generate_gallery(wb):
    images_raw = read_sheet(wb, "gallery_images")
    images = []
    for img in images_raw:
        if not img.get("filename"):
            continue
        images.append({
            "filename": img.get("filename", ""),
            "title": img.get("title", ""),
            "date": img.get("date", ""),
            "tags": parse_gallery_tags(img.get("tags", "")),
            "description": img.get("description", "")
        })

    lines = []
    lines.append("// 画廊图片数据")
    lines.append("// 由 generate_all.py 自动生成，请勿手动修改")
    lines.append("")
    lines.append("const galleryData = [")
    for i, item in enumerate(images):
        lines.append("  {")
        lines.append(f'    filename: "{js_str(item["filename"])}",')
        lines.append(f'    title: "{js_str(item["title"])}",')
        lines.append(f'    date: "{js_str(item["date"])}",')
        lines.append(f'    tags: {json.dumps(item["tags"], ensure_ascii=False)},')
        lines.append(f'    description: "{js_str(item["description"])}"')
        lines.append("  }" + ("," if i < len(images) - 1 else ""))
    lines.append("];")

    with open(OUTPUTS["gallery"], "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return len(images)


# =========================== 6. 访谈 ===========================
def generate_interview(wb):
    raw = read_sheet(wb, "interview")
    interviews = []
    MC_DIR = os.path.join(ROOT, "_data", "mc")

    for r in raw:
        if not r.get("title"):
            continue
        if_translated = str(r.get("if_translated", "no") or "no").strip().lower()
        if if_translated not in ("yes", "no"):
            print(f"  ⚠ interview: {r.get('title', '')} 的 if_translated 值无效，按 no 处理")
            if_translated = "no"
        md_path = r.get("md_path", "").strip()
        md_content = ""
        if md_path:
            # md_path 可能是相对路径如 "mc/sample_interview.md"
            full_path = os.path.join(ROOT, "_data", md_path.lstrip("/\\"))
            if not os.path.exists(full_path):
                # 尝试直接从 _data 目录找
                full_path = os.path.join(DATA_DIR, md_path.lstrip("/\\"))
            if os.path.isfile(full_path):
                with open(full_path, "r", encoding="utf-8") as f:
                    md_content = f.read()
        interviews.append({
            "poster": fix_path(r.get("poster", ""), "interview"),
            "date": r.get("date", "").strip(),
            "interviewee": r.get("interviewee", "").strip(),
            "title": r.get("title", "").strip(),
            "if_translated": if_translated,
            "hash_id": hash_id(r.get("title", "").strip(), r.get("interviewee", "").strip(), r.get("date", "").strip()),
            "md_html": render_md_to_html(md_content)
        })

    lines = []
    lines.append("// 访谈数据")
    lines.append("// 由 generate_all.py 自动生成，请勿手动修改")
    lines.append("")
    lines.append("const interviewData = [")
    for i, item in enumerate(interviews):
        lines.append("  {")
        lines.append(f'    poster: "{js_str(item["poster"])}",')
        lines.append(f'    date: "{js_str(item["date"])}",')
        lines.append(f'    interviewee: "{js_str(item["interviewee"])}",')
        lines.append(f'    title: "{js_str(item["title"])}",')
        lines.append(f'    if_translated: "{js_str(item["if_translated"])}",')
        lines.append(f'    hash_id: "{js_str(item["hash_id"])}",')
        lines.append(f'    md_html: "{js_str(item["md_html"])}"')
        lines.append("  }" + ("," if i < len(interviews) - 1 else ""))
    lines.append("];")

    with open(OUTPUTS["interview"], "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return len(interviews)


# =========================== 7. 唱片目录 ===========================
def split_list(raw, separator=","):
    """将 Excel 中以逗号分隔的单元格转换为列表，忽略空项。"""
    return [item.strip() for item in (raw or "").split(separator) if item.strip()]


def excel_bool(raw):
    """解析 Excel 中便于手工填写的布尔值。"""
    return str(raw or "").strip().lower() in ("1", "true", "yes", "y", "是", "有")


def generate_discography(wb):
    """将发行作品、版本、内容和特典内容表合并为页面所需的嵌套数据。"""
    releases_raw = read_sheet(wb, "discography_releases")
    editions_raw = read_sheet(wb, "discography_editions")
    contents_raw = read_sheet(wb, "discography_contents")
    bonus_contents_raw = read_sheet(wb, "discography_bonus_contents")

    editions_by_release = {}
    for row in editions_raw:
        release_id = row.get("release_id", "").strip()
        name = row.get("edition_name", "").strip()
        if not release_id or not name:
            continue
        editions_by_release.setdefault(release_id, []).append({
            "name": name,
            "type": row.get("edition_type", ""),
            "catalog_no": row.get("catalog_no", ""),
            "price": row.get("price", ""),
            "cover": fix_path(row.get("cover", ""), "discography"),
            "cover_gallery": [fix_path(path, "discography") for path in split_list(row.get("cover_gallery", ""), "|")],
            "format": row.get("format", ""),
            "distribution": row.get("distribution", ""),
            "limited": row.get("limited", ""),
            "bonus": split_list(row.get("bonus", ""), "|"),
            "features": {
                "cd": excel_bool(row.get("includes_cd", "")),
                "bluray": excel_bool(row.get("includes_bluray", "")),
                "box": excel_bool(row.get("includes_box", "")),
                "goods": excel_bool(row.get("includes_goods", ""))
            }
        })

    contents_by_release = {}
    contents_by_edition = {}
    for row in contents_raw:
        release_id = row.get("release_id", "").strip()
        if not release_id:
            continue
        item = {
            "disc_no": row.get("disc_no", ""),
            "disc_type": row.get("disc_type", ""),
            "track_no": row.get("track_no", ""),
            "song_name": row.get("song_name", ""),
            "content_title": row.get("content_title", ""),
            "duration": row.get("duration", ""),
            "note": row.get("note", "")
        }
        edition_name = row.get("edition_name", "").strip()
        if edition_name:
            contents_by_edition.setdefault((release_id, edition_name), []).append(item)
        else:
            contents_by_release.setdefault(release_id, []).append(item)

    bonus_contents_by_release = {}
    for row in bonus_contents_raw:
        release_id = row.get("release_id", "").strip()
        if not release_id:
            continue
        bonus_id = row.get("bonus_id", "").strip() or row.get("disc_name", "").strip() or "bonus"
        bonus_contents_by_release.setdefault(release_id, []).append({
            "bonus_id": bonus_id,
            "disc_name": row.get("disc_name", ""),
            "track_no": row.get("track_no", ""),
            "song_name": row.get("song_name", ""),
            "note": row.get("note", "")
        })

    releases = []
    for row in releases_raw:
        release_id = row.get("release_id", "").strip()
        if not release_id:
            continue
        editions = editions_by_release.get(release_id, [])
        for edition in editions:
            edition["contents"] = contents_by_edition.get((release_id, edition["name"]), [])
        releases.append({
            "id": release_id,
            "hash_id": hash_id(row.get("title", ""), row.get("title_jp", ""), normalize_date(row.get("release_date", ""))),
            "title": row.get("title", ""),
            "title_jp": row.get("title_jp", ""),
            "release_date": normalize_date(row.get("release_date", "")),
            "type": row.get("type", ""),
            "formats": split_list(row.get("formats", "")),
            "label": row.get("label", ""),
            "description": row.get("description", ""),
            "cover": fix_path(row.get("cover", ""), "discography"),
            "search_keywords": row.get("search_keywords", ""),
            "chart": {
                "first_day_rank": row.get("chart_first_day_rank", ""),
                "first_week_sales": row.get("chart_first_week_sales", ""),
                "first_week_rank": row.get("chart_first_week_rank", ""),
                "total_sales": row.get("chart_total_sales", ""),
                "source": row.get("chart_source", "")
            },
            "contents": contents_by_release.get(release_id, []),
            "bonus_contents": bonus_contents_by_release.get(release_id, []),
            "editions": editions
        })

    js = "// 唱片目录数据\n// 由 generate_all.py 自动生成，请勿手动修改。\n\n"
    js += "const discographyData = " + json.dumps(releases, ensure_ascii=False, indent=2) + ";\n"
    with open(OUTPUTS["discography"], "w", encoding="utf-8") as f:
        f.write(js)
    return len(releases)


# =========================== 初始化：合并旧 xlsx ===========================
def init_merged_xlsx():
    """从旧的分散 xlsx 合并创建 _data/data.xlsx"""
    os.makedirs(DATA_DIR, exist_ok=True)

    wb = openpyxl.Workbook()
    wb.remove(wb.active)  # 删除默认 sheet

    # 定义 sheet 名称映射：旧文件 key → (sheet 名称, 源 sheet 名称)
    sheet_sources = {
        "announcements":     [("announcements", None)],
        "songs":             [("songs", "songs"), ("song_comments", "comments"), ("song_live_history", "live_history")],
        "live":              [("lives", "lives"), ("setlist", "setlist"), ("backstage", "backstage")],
        "gallery":           [("gallery_images", "images")],
        "timeline":          [("timeline", "时间轴数据")],
        "interview":         [("interview", "interview")],
    }

    merged_count = 0
    for module_key, sheet_list in sheet_sources.items():
        old_path = OLD_XLSX[module_key]
        if not os.path.exists(old_path):
            print(f"  [SKIP] 旧文件不存在: {old_path}")
            continue
        old_wb = openpyxl.load_workbook(old_path)
        for new_sheet_name, old_sheet_name in sheet_list:
            src_name = old_sheet_name or old_wb.sheetnames[0] if old_wb.sheetnames else None
            if src_name and src_name in old_wb.sheetnames:
                ws_src = old_wb[src_name]
                ws_new = wb.create_sheet(new_sheet_name)
                for row in ws_src.iter_rows(values_only=True):
                    ws_new.append(list(row))
                merged_count += 1
                print(f"  [OK] {module_key}/{src_name} -> {new_sheet_name}")
        old_wb.close()

    wb.save(XLSX_PATH)
    print(f"\n合并完成！{merged_count} 个 Sheet 已写入 {XLSX_PATH}")
    return merged_count


# =========================== 画廊图片自动扫描 ===========================
def scan_gallery_images(log_func=None):
    """扫描 images/ 文件夹，将文件名写入 gallery_images sheet 的 filename 列"""
    images_dir = os.path.join(ROOT, "images")
    if not os.path.isdir(images_dir):
        (log_func or print)("  [跳过] images/ 目录不存在")
        return 0

    # 读取现有 xlsx 中的 gallery_images sheet
    try:
        import openpyxl
    except ImportError:
        (log_func or print)("  [失败] 缺少 openpyxl")
        return 0

    wb = openpyxl.load_workbook(XLSX_PATH)
    if "gallery_images" not in wb.sheetnames:
        (log_func or print)("  [失败] 找不到 gallery_images sheet")
        wb.close()
        return 0

    ws = wb["gallery_images"]
    # 找到 filename 列
    headers = [str(c.value).strip().lower() if c.value else "" for c in ws[1]]
    if "filename" not in headers:
        (log_func or print)("  [失败] gallery_images 表缺少 filename 列")
        wb.close()
        return 0
    filename_col = headers.index("filename") + 1  # 1-based

    # 收集现有文件名（跳过空行）
    existing = set()
    for row_idx in range(2, ws.max_row + 1):
        val = ws.cell(row=row_idx, column=filename_col).value
        if val and str(val).strip():
            existing.add(str(val).strip())

    # 扫描 images/ 下所有图片文件
    IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}
    new_files = []
    for fname in os.listdir(images_dir):
        ext = os.path.splitext(fname)[1].lower()
        if ext in IMG_EXTS and fname not in existing:
            new_files.append(fname)

    if not new_files:
        (log_func or print)(f"  已扫描 {len(existing)} 张图片，无新增")
        wb.close()
        return 0

    # 写入新图片（追加到现有数据之后，路径格式为 ../images/xxx）
    next_row = ws.max_row + 1
    for fname in new_files:
        ws.cell(row=next_row, column=filename_col, value=f"../images/{fname}")
        next_row += 1

    wb.save(XLSX_PATH)
    wb.close()
    (log_func or print)(f"  新增 {len(new_files)} 张图片: {', '.join(new_files)}")
    return len(new_files)


# =========================== 主流程 ===========================
def inject_version(log_func=None):
    """在所有 HTML 中为 data.js / announcements.js 引用注入版本号，输出版本号字符串"""
    version = datetime.now().strftime("%Y%m%d%H%M")
    html_files = [
        os.path.join(ROOT, "index.html"),
        os.path.join(ROOT, "songs", "index.html"),
        os.path.join(ROOT, "live", "index.html"),
        os.path.join(ROOT, "timeline", "index.html"),
        os.path.join(ROOT, "gallery", "index.html"),
        os.path.join(ROOT, "interview", "index.html"),
        os.path.join(ROOT, "discography", "index.html"),
    ]
    # 匹配所有本地 .css / .js / .svg 引用（跳过 https:// 外部链接）
    pattern = re.compile(
        r'((?:href|src)="(?!https?://)(?!data:)[^"]*\.(?:css|js|svg))'
        r'(?:\?v=[^"]*)?(")'
    )

    for html_path in html_files:
        if not os.path.exists(html_path):
            continue
        with open(html_path, "r", encoding="utf-8") as f:
            html = f.read()
        new_html = pattern.sub(rf"\1?v={version}\2", html)
        if new_html != html:
            with open(html_path, "w", encoding="utf-8") as f:
                f.write(new_html)
            (log_func or print)(f"  ✓ {os.path.relpath(html_path, ROOT)} → v={version}")
    return version


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--init":
        print("=== 初始化：从旧 xlsx 合并创建 _data/data.xlsx ===")
        init_merged_xlsx()
        print("\n现在可以运行 py generate_all.py 来生成所有 JS 文件。")
        return

    if not os.path.exists(XLSX_PATH):
        print(f"错误: 找不到 {XLSX_PATH}")
        print("请先运行 py generate_all.py --init 来从旧文件合并创建。")
        sys.exit(1)

    print("=== 唯鸡百科 · 统一数据生成 ===")
    print(f"数据源: {XLSX_PATH}\n")

    wb = openpyxl.load_workbook(XLSX_PATH, data_only=True)
    sheets = wb.sheetnames
    print(f"Sheet 列表: {', '.join(sheets)}\n")

    results = {}

    # 公告
    if "announcements" in sheets:
        n = generate_announcements(wb)
        results["公告"] = f"{n} 条"
        print(f"  ✓ announcements.js — {n} 条公告")

    # 歌曲
    if "songs" in sheets:
        n = generate_songs(wb)
        results["歌曲"] = f"{n} 首"
        print(f"  ✓ songs/data.js — {n} 首歌曲")

    # 演唱会
    if "lives" in sheets:
        n, mc = generate_live(wb)
        extra = f" ({mc} MC)" if mc else ""
        results["演唱会"] = f"{n} 场{extra}"
        print(f"  ✓ live/data.js — {n} 场演唱会" + (f"，{mc} 个 MC 文件" if mc else ""))

    # 时间轴
    if "timeline" in sheets:
        n = generate_timeline(wb)
        results["时间轴"] = f"{n} 条事件"
        print(f"  ✓ timeline/data.js — {n} 条事件")

    # 画廊
    if "gallery_images" in sheets:
        n = generate_gallery(wb)
        results["画廊"] = f"{n} 张图片"
        print(f"  ✓ gallery/data.js — {n} 张图片")

    # 访谈
    if "interview" in sheets:
        n = generate_interview(wb)
        results["访谈"] = f"{n} 篇"
        print(f"  ✓ interview/data.js — {n} 篇访谈")

    # 唱片目录（发行物、版本、内容和特典内容表）
    if "discography_releases" in sheets:
        n = generate_discography(wb)
        results["唱片目录"] = f"{n} 张发行作品"
        print(f"  ✓ discography/data.js — {n} 张发行作品")

    wb.close()

    print("\n--- 注入版本号 ---")
    v = inject_version()
    print(f"  版本号: {v}")

    print("\n=== 全部完成 ===")
    for k, v in results.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
