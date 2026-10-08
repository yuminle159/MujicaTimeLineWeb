"""Import a program archive and sync public YouTube playlist covers into one sheet.

python sync_programs.py --import-source "path/to/archive.xlsx" --import-only
python sync_programs.py
python sync_programs.py --offline

Only the programs worksheet is edited. Existing values are never overwritten by
the playlist; set video_url explicitly to resolve an ambiguous match. No videos
are downloaded, only public playlist metadata and thumbnail images.
"""
from __future__ import annotations

import argparse
from datetime import date, datetime, time
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import re
import shutil
import tempfile
import unicodedata
from urllib.parse import parse_qs, urlparse

import openpyxl
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Font, PatternFill
from PIL import Image
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

ROOT = Path(__file__).resolve().parent
PLAYLIST = "https://www.youtube.com/playlist?list=PLvRmS87ezZfpnV-KtU1vz--KFUz5zIQYo"
SHEET = "programs"
HEADERS = ["program_id", "program", "episode", "date", "time", "timezone",
           "title", "performers", "clips", "video_url", "cover", "notes", None,
           "cast_name", "band", "band_color", "aliases"]
COMMENTS = {
    "program_id": "稳定标识，由脚本自动填写；生成后不要修改。",
    "program": "节目系列，如 バンドリ！TV LIVE；特别节目也可另填系列名。",
    "episode": "期数，如 #199；不定期节目可留空。",
    "date": "播出日期，YYYY/MM/DD。原表的日期原样保留。",
    "time": "可选：开播时间 HH:MM。没有可靠来源时留空，不能把日期中的 00:00 当作开播时间。",
    "timezone": "时间对应时区，如 +09:00 日本、+08:00 中国；未填时间时可留空。",
    "title": "本期标题；普通期目可留空，特别节目填写完整名称。",
    "performers": "出演者姓名，用半角 | 分隔；名字与 N 列或 Q 列别名一致。",
    "clips": "字幕组切片链接，用半角 | 分隔。可写 URL 或 标题=>URL；不需要另建表。",
    "video_url": "完整节目链接。脚本只自动填入唯一匹配项；也可手动粘贴 YouTube 链接。",
    "cover": "本地封面路径，脚本自动填写，如 images/programs/bdtv-0199.webp。",
    "notes": "可选备注。",
    "cast_name": "出演者标准名。N:Q 为独立字典，与左侧同一行的节目没有对应关系。只需为新人加一次。",
    "band": "该出演者所属乐队。未知先留空；多个乐队用 | 分隔。",
    "band_color": "从原表颜色提取的网页色值，如 #881144；不用给单元格涂色。多乐队色值按顺序用 | 分隔。",
    "aliases": "同一个人的其他写法，用 | 分隔，统计时归到 N 列标准名。",
}


def text(value):
    return "" if value is None else str(value).strip()


def split_values(value):
    return list(dict.fromkeys(v.strip() for v in text(value).split("|") if v.strip()))


def normalize(value):
    return re.sub(r"[\W_]+", "", unicodedata.normalize("NFKC", text(value))).casefold()


def date_text(value):
    if isinstance(value, (datetime, date)):
        return value.strftime("%Y/%m/%d")
    raw = text(value)
    if not raw:
        return ""
    parsed = datetime.strptime(raw.replace("-", "/").replace(".", "/"), "%Y/%m/%d")
    return parsed.strftime("%Y/%m/%d")


def stable_id(program, episode, day, title):
    number = re.fullmatch(r"#?(\d+)", text(episode))
    if normalize(program) == normalize("バンドリ！TV LIVE") and number:
        return f"bdtv-{int(number[1]):04d}"
    digest = sha256("|".join((program, episode, day, title)).encode()).hexdigest()[:8]
    return f"program-{day.replace('/', '') or 'undated'}-{digest}"


def fill_color(cell):
    color = cell.fill.fgColor
    if cell.fill.patternType == "solid" and color.type == "rgb":
        return "#" + color.rgb[-6:].upper()
    return ""


def create_sheet(workbook):
    sheet = workbook.create_sheet(SHEET)
    sheet.append(HEADERS)
    sheet.freeze_panes = "D2"
    sheet.sheet_view.showGridLines = True
    sheet.auto_filter.ref = "A1:L1"
    widths = [23, 26, 12, 15, 10, 12, 46, 66, 65, 48, 46, 38, 3, 20, 25, 17, 25]
    for column, width in enumerate(widths, 1):
        sheet.column_dimensions[openpyxl.utils.get_column_letter(column)].width = width
        cell = sheet.cell(1, column)
        if cell.value:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="363941")
            cell.comment = Comment(COMMENTS[cell.value], "wijipedia")
    sheet.column_dimensions["A"].hidden = True
    sheet.row_dimensions[1].height = 24
    return sheet


def columns(sheet):
    result = {text(c.value): c.column for c in sheet[1] if c.value}
    missing = set(filter(None, HEADERS)) - result.keys()
    if missing:
        raise ValueError("programs 缺少列：" + ", ".join(sorted(missing)))
    return result


def read_episodes(sheet):
    cols = columns(sheet)
    result = []
    seen = set()
    for row in range(2, sheet.max_row + 1):
        record = {key: sheet.cell(row, cols[key]).value for key in HEADERS[:12]}
        if not any(record.values()):
            continue
        record = {key: text(value) for key, value in record.items() if key not in {"date", "time"}} | {
            "date": date_text(sheet.cell(row, cols["date"]).value),
            "time": sheet.cell(row, cols["time"]).value,
        }
        if not record["program"]:
            raise ValueError(f"programs 第 {row} 行缺少节目系列")
        value = record["time"]
        record["time"] = value.strftime("%H:%M") if isinstance(value, (datetime, time)) else text(value)
        if record["time"]:
            datetime.strptime(record["time"], "%H:%M")
            if not re.fullmatch(r"[+-]\d{2}:\d{2}", record["timezone"]):
                raise ValueError(f"programs 第 {row} 行填写时间后还需填写时区，如 +09:00")
        record["program_id"] = record["program_id"] or stable_id(record["program"], record["episode"], record["date"], record["title"])
        if not re.fullmatch(r"[a-zA-Z0-9_-]+", record["program_id"]):
            raise ValueError(f"programs 第 {row} 行 program_id 只能使用字母、数字、下划线和连字符")
        if record["program_id"] in seen:
            raise ValueError(f"programs 第 {row} 行 program_id 重复：{record['program_id']}")
        seen.add(record["program_id"])
        record["row"] = row
        result.append(record)
    return result


def read_cast(sheet):
    cols = columns(sheet)
    cast, aliases = {}, {}
    for row in range(2, sheet.max_row + 1):
        name = text(sheet.cell(row, cols["cast_name"]).value)
        if not name:
            continue
        if name in cast:
            raise ValueError(f"出演者字典重名：{name}")
        cast[name] = {key: text(sheet.cell(row, cols[key]).value) for key in ("band", "band_color", "aliases")}
        for alias in [name, *split_values(cast[name]["aliases"])]:
            if alias in aliases and aliases[alias] != name:
                raise ValueError(f"出演者别名有冲突：{alias}")
            aliases[alias] = name
    return cast, aliases


def import_source(workbook, source):
    original = openpyxl.load_workbook(source, data_only=True)
    try:
        src = original.active
        if text(src["C1"].value) != "回数" or text(src["N1"].value) != "出演者":
            raise ValueError("原表结构不符：需要 C 列期数、D:J 出演者、N:O 姓名和乐队")
        sheet = workbook[SHEET] if SHEET in workbook.sheetnames else create_sheet(workbook)
        existing = read_episodes(sheet)
        ids = {row["program_id"] for row in existing}
        next_row = max((row["row"] for row in existing), default=1) + 1
        added = 0
        for row in range(2, src.max_row + 1):
            label = text(src.cell(row, 3).value)
            if not label:
                continue
            day = date_text(src.cell(row, 2).value)
            is_number = re.fullmatch(r"#\d+", label) is not None
            program = "バンドリ！TV LIVE" if is_number else "特别节目"
            episode, title = (label, "") if is_number else ("", label)
            ident = stable_id(program, episode, day, title)
            if ident in ids:
                continue
            people = list(dict.fromkeys(text(src.cell(row, c).value) for c in range(4, 11) if src.cell(row, c).value))
            values = [ident, program, episode, day, "", "", title, "|".join(people), "", "", "", ""]
            for col, value in enumerate(values, 1):
                cell = sheet.cell(next_row, col, value)
                cell.alignment = Alignment(vertical="top", wrap_text=True)
            ids.add(ident)
            next_row += 1
            added += 1
        cast, _ = read_cast(sheet)
        mapping_row = max((r for r in range(2, sheet.max_row + 1) if sheet.cell(r, 14).value), default=1) + 1
        added_cast = 0
        for row in range(2, src.max_row + 1):
            name, band = text(src.cell(row, 14).value), text(src.cell(row, 15).value)
            if not name or name in cast:
                continue
            color = fill_color(src.cell(row, 15)) or fill_color(src.cell(row, 14))
            for col, value in ((14, name), (15, band), (16, color)):
                sheet.cell(mapping_row, col, value)
            cast[name] = {"band": band}
            mapping_row += 1
            added_cast += 1
        unmapped = sorted({name for entry in read_episodes(sheet) for name in split_values(entry["performers"]) if name not in cast})
        for name in unmapped:
            sheet.cell(mapping_row, 14, name)
            sheet.cell(mapping_row, 15).comment = Comment("原表 N:O 中没有此名字，请填写归属或在标准名的 aliases 中添加此写法。", "wijipedia")
            mapping_row += 1
        sheet.auto_filter.ref = f"A1:L{next_row - 1}"
        return {"added_episodes": added, "added_cast": added_cast, "unmapped_performers": unmapped}
    finally:
        original.close()


def walk_values(node, key):
    if isinstance(node, dict):
        for name, value in node.items():
            if name == key:
                yield value
            yield from walk_values(value, key)
    elif isinstance(node, list):
        for value in node:
            yield from walk_values(value, key)


def json_after(html, pattern):
    match = re.search(pattern, html)
    if not match:
        raise ValueError("YouTube 页面未包含所需数据（可能暂时不可访问或页面结构已变化）")
    return json.JSONDecoder().raw_decode(html[match.end():])[0]


def parse_playlist_page(data):
    actions = list(walk_values(data, "appendContinuationItemsAction"))
    if actions:
        data = [action.get("continuationItems", []) for action in actions]
    # Scope the first page to the playlist itself: the outer section has a
    # separate continuation for recommendations, which is not this playlist.
    tabs = list(walk_values(data, "tabRenderer"))
    if tabs:
        selected = next((tab for tab in tabs if tab.get("selected")), tabs[0])
        content = selected.get("content", {})
        lists = list(walk_values(content, "playlistVideoListRenderer"))
        if lists:
            data = lists[0]
        else:
            sections = list(walk_values(content, "itemSectionRenderer"))
            data = next((section for section in sections if any(walk_values(section, "lockupViewModel"))), content)
    videos = {}
    for entry in walk_values(data, "playlistVideoRenderer"):
        ident = entry.get("videoId", "")
        title = "".join(part.get("text", "") for part in entry.get("title", {}).get("runs", [])) or entry.get("title", {}).get("simpleText", "")
        if ident and title:
            videos[ident] = {"id": ident, "title": title}
    for entry in walk_values(data, "lockupViewModel"):
        ident = entry.get("contentId", "")
        if not re.fullmatch(r"[\w-]{11}", ident) or entry.get("contentType") != "LOCKUP_CONTENT_TYPE_VIDEO":
            continue
        metadata = entry.get("metadata", {}).get("lockupMetadataViewModel", {})
        title = metadata.get("title", {}).get("content", "")
        if title:
            videos[ident] = {"id": ident, "title": title}
    tokens = list(dict.fromkeys(item["token"] for item in walk_values(data, "continuationCommand") if isinstance(item, dict) and "token" in item))
    if len(tokens) > 1:
        raise ValueError("播放列表分页有多个分支，拒绝把不确定数据当成完整列表")
    return list(videos.values()), tokens[0] if tokens else None


def session():
    client = requests.Session()
    client.headers.update({"User-Agent": "Mozilla/5.0", "Accept-Language": "ja,en;q=0.7"})
    retry = Retry(total=2, backoff_factor=1, status_forcelist=(429, 500, 502, 503, 504), allowed_methods=("GET", "POST"))
    client.mount("https://", HTTPAdapter(max_retries=retry))
    return client


def fetch_playlist(client, url, cache):
    parsed = urlparse(url)
    if parsed.hostname not in {"www.youtube.com", "youtube.com"} or not parse_qs(parsed.query).get("list"):
        raise ValueError("请输入 YouTube 播放列表链接")
    response = client.get(url, timeout=30)
    response.raise_for_status()
    html = response.text
    data = json_after(html, r"(?:var\s+)?ytInitialData\s*=\s*")
    context = json_after(html, r'"INNERTUBE_CONTEXT"\s*:\s*')
    key = json_after(html, r'"INNERTUBE_API_KEY"\s*:\s*')
    page = data.get("contents", data)
    entries, visited = {}, set()
    for page_number in range(100):
        videos, token = parse_playlist_page(page)
        if page_number and not videos:
            raise ValueError("后续分页没有返回视频，未将不完整结果保存为缓存")
        for video in videos:
            entries[video["id"]] = video
        print(f"播放列表第 {page_number + 1} 页，累计 {len(entries)} 个视频", flush=True)
        if not token:
            break
        if token in visited:
            raise ValueError("播放列表分页循环，拒绝保存不完整缓存")
        visited.add(token)
        response = client.post("https://www.youtube.com/youtubei/v1/browse", params={"key": key}, json={"context": context, "continuation": token}, timeout=30)
        response.raise_for_status()
        page = response.json()
    else:
        raise ValueError("播放列表超出 100 页，请检查分页逻辑")
    if not entries:
        raise ValueError("未读取到播放列表视频，未修改工作簿")
    result = {"playlist_url": url, "fetched_at": datetime.now().isoformat(timespec="seconds"), "videos": list(entries.values())}
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result["videos"]


def video_id(url):
    parsed = urlparse(url)
    if parsed.hostname in {"youtu.be", "www.youtu.be"}:
        value = parsed.path.strip("/")
    elif parsed.hostname in {"youtube.com", "www.youtube.com", "m.youtube.com"}:
        value = parse_qs(parsed.query).get("v", [""])[0]
        if not value and parsed.path.startswith(("/live/", "/shorts/", "/embed/")):
            value = parsed.path.split("/")[2]
    else:
        return ""
    return value if re.fullmatch(r"[\w-]{11}", value) else ""


def match_video(entry, videos):
    if entry["video_url"]:
        ident = video_id(entry["video_url"])
        return ([{"id": ident, "title": "手动指定视频"}] if ident else []), "manual"
    number = re.fullmatch(r"#?(\d+)", entry["episode"])
    if normalize(entry["program"]) == normalize("バンドリ！TV LIVE") and number:
        matches = []
        for video in videos:
            title = unicodedata.normalize("NFKC", video["title"])
            found = re.search(r"#\s*(\d+)\b", title)
            if found and int(found[1]) == int(number[1]) and "バンドリtvlive" in normalize(title):
                year = re.search(r"\b(20\d{2})\b", title)
                if entry["date"] and year and year[1] != entry["date"][:4]:
                    continue
                matches.append(video)
        return matches, "episode"
    # The source sometimes omits only the franchise prefix on special titles.
    title = normalize(entry["title"]).removeprefix("バンドリ")
    return ([v for v in videos if title and normalize(v["title"]).removeprefix("バンドリ") == title], "title")


def download_cover(client, ident, target):
    if target.exists():
        with Image.open(target) as existing:
            existing.verify()
        return "cached"
    for filename in ("maxresdefault.jpg", "sddefault.jpg", "hqdefault.jpg"):
        response = client.get(f"https://i.ytimg.com/vi/{ident}/{filename}", timeout=25)
        if response.status_code == 404:
            continue
        response.raise_for_status()
        with Image.open(BytesIO(response.content)) as image:
            if image.width < 320 or image.height < 180:
                continue
            image = image.convert("RGB")
            image.thumbnail((1280, 720))
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = target.with_suffix(".part")
            image.save(temporary, format="WEBP", quality=88)
            temporary.replace(target)
        return "downloaded"
    raise ValueError("没有可用封面")


def save_workbook(workbook, path, expected_digest):
    if sha256(path.read_bytes()).hexdigest() != expected_digest:
        raise RuntimeError("data.xlsx 在运行期间被修改，请重新运行；本次未覆盖文件")
    backup = path.parent.parent / "_backups" / ("programs-" + datetime.now().strftime("%Y%m%d-%H%M%S-%f")) / path.name
    backup.parent.mkdir(parents=True)
    shutil.copy2(path, backup)
    with tempfile.NamedTemporaryFile(suffix=".xlsx", dir=path.parent, delete=False) as handle:
        temporary = Path(handle.name)
    try:
        workbook.save(temporary)
        preserve_empty_clip_strings(temporary, workbook)
        if sha256(path.read_bytes()).hexdigest() != expected_digest:
            raise RuntimeError("保存前发现 data.xlsx 有新修改，本次未覆盖文件")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)
    return str(backup)


def preserve_empty_clip_strings(path, workbook):
    """Keep explicit empty clip strings intact across openpyxl save/load."""
    import zipfile
    sheet = workbook[SHEET]
    clip_column = columns(sheet)["clips"]
    cells = {sheet.cell(row, clip_column).coordinate for row in range(2, sheet.max_row + 1)
             if sheet.cell(row, clip_column).value == ""}
    if not cells:
        return
    entry = f"xl/worksheets/sheet{workbook.index(sheet) + 1}.xml"
    with zipfile.ZipFile(path) as archive:
        contents = [(info, archive.read(info.filename)) for info in archive.infolist()]
    def restore(match):
        attributes, coordinate = match.group(1), match.group(2)
        return f'<c{attributes}><is><t></t></is></c>' if coordinate in cells else match.group(0)
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for info, content in contents:
            if info.filename == entry:
                content = re.sub(r'<c(\s+r="([^"]+)"[^>]*?)(?:\s*/>|></c>)', restore, content.decode('utf-8')).encode('utf-8')
            archive.writestr(info, content)


def run(args):
    path = args.workbook.resolve()
    root = path.parent.parent
    digest = sha256(path.read_bytes()).hexdigest()
    workbook = openpyxl.load_workbook(path)
    report = {"updated_at": datetime.now().isoformat(timespec="seconds"), "playlist": args.playlist, "matched": [], "unmatched": [], "ambiguous": [], "failed": []}
    changed = False
    try:
        if args.import_source:
            report["import"] = import_source(workbook, args.import_source)
            changed = bool(report["import"]["added_episodes"] or report["import"]["added_cast"] or report["import"]["unmapped_performers"])
        if SHEET not in workbook.sheetnames:
            raise ValueError("data.xlsx 没有 programs 表，请先 --import-source 导入原表")
        sheet = workbook[SHEET]
        if sheet.freeze_panes != "D2":
            sheet.freeze_panes = "D2"
            changed = True
        cols = columns(sheet)
        entries = read_episodes(sheet)
        cast, aliases = read_cast(sheet)
        report["unmapped_performers"] = sorted({name for e in entries for name in split_values(e["performers"]) if not cast.get(aliases.get(name), {}).get("band")})
        for entry in entries:
            cell = sheet.cell(entry["row"], cols["program_id"])
            if not cell.value:
                cell.value = entry["program_id"]
                changed = True
        client = session()
        try:
            if not args.import_only:
                if args.offline:
                    cache = json.loads(args.cache.read_text(encoding="utf-8"))
                    if cache["playlist_url"] != args.playlist:
                        raise ValueError("缓存的播放列表与当前参数不一致")
                    videos = cache["videos"]
                else:
                    videos = fetch_playlist(client, args.playlist, args.cache)
                report["playlist_videos"] = len(videos)
                for entry in entries:
                    summary = {key: entry[key] for key in ("program_id", "date", "episode", "title")}
                    matches, method = match_video(entry, videos)
                    if len(matches) != 1:
                        report["ambiguous" if matches else "unmatched"].append(summary | {"candidates": matches})
                        continue
                    video = matches[0]
                    summary |= {"video_id": video["id"], "video_title": video["title"], "match": method}
                    if not entry["video_url"]:
                        sheet.cell(entry["row"], cols["video_url"], "https://www.youtube.com/watch?v=" + video["id"])
                        changed = True
                    if entry["cover"]:
                        summary["cover_status"] = "preserved"
                    else:
                        relative = f"images/programs/{entry['program_id']}-{video['id']}.webp"
                        target = root / relative
                        try:
                            if args.offline and not target.is_file():
                                raise ValueError("离线模式下本地封面不存在，请联网运行以下载")
                            summary["cover_status"] = download_cover(client, video["id"], target)
                            sheet.cell(entry["row"], cols["cover"], relative)
                            changed = True
                        except (requests.RequestException, OSError, ValueError) as error:
                            report["failed"].append(summary | {"error": str(error)})
                            continue
                    report["matched"].append(summary)
                    if len(report["matched"]) % 20 == 0:
                        print(f"已处理 {len(report['matched'])}/{len(entries)} 条节目", flush=True)
        finally:
            client.close()
        if changed:
            report["backup"] = save_workbook(workbook, path, digest)
        report["episodes"] = len(entries)
        report["performer_dictionary"] = len(cast)
        report["changed"] = changed
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps({key: report[key] for key in ("episodes", "performer_dictionary", "changed")}, ensure_ascii=False))
        print(f"封面成功 {len(report['matched'])}，未匹配 {len(report['unmatched'])}，歧义 {len(report['ambiguous'])}，失败 {len(report['failed'])}")
        print(f"报告：{args.report}")
        return 1 if report["failed"] else 0
    finally:
        workbook.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--workbook", type=Path, default=ROOT / "_data" / "data.xlsx")
    parser.add_argument("--import-source", type=Path)
    parser.add_argument("--import-only", action="store_true", help="仅导入原表，不联网")
    parser.add_argument("--playlist", default=PLAYLIST)
    parser.add_argument("--cache", type=Path, default=ROOT / "_reports" / "programs-playlist.json")
    parser.add_argument("--report", type=Path, default=ROOT / "_reports" / "programs-sync.json")
    parser.add_argument("--offline", action="store_true", help="使用播放列表缓存和已下载封面，不联网")
    args = parser.parse_args()
    if hasattr(__import__("sys").stdout, "reconfigure"):
        __import__("sys").stdout.reconfigure(encoding="utf-8")
    try:
        return run(args)
    except (OSError, ValueError, RuntimeError, requests.RequestException) as error:
        print(f"失败：{error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
