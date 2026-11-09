"""Shared timeline validation for the updater and direct generation."""
from datetime import date, datetime
from pathlib import Path
import re


def check_timeline(sheet, root):
    issues = []
    def add(level, row, message):
        issues.append((level, f'timeline!{row}', message))
    def text(value):
        return '' if value is None else str(value).strip()
    def day(value):
        if isinstance(value, (date, datetime)):
            return f'{value.year}/{value.month}/{value.day}'
        match = re.fullmatch(r'(\d{4})[./-](\d{1,2})[./-](\d{1,2})', text(value))
        return '/'.join(str(int(v)) for v in match.groups()) if match else text(value)
    rows = iter(sheet.iter_rows(values_only=True))
    headers = [text(v).lower() for v in next(rows, ())]
    events, groups, media_seen, descriptions = {}, {}, {}, set()
    names = r'(?:佐佐木李子|高尾奏音)'
    speaker = re.compile(r'^(?:(?:回复|点赞)[|｜])?(?:\d{4}[./]\d{1,2}[./]\d{1,2}的)?(?:佐佐木李子|高尾奏音|李子→奏音|奏音→李子)[：:]')
    for number, values in enumerate(rows, 2):
        row = dict(zip(headers, values))
        if not any(text(v) for v in values):
            continue
        title, group = text(row.get('title')), text(row.get('group'))
        identity = (day(row.get('date')), title)
        fields = {k: text(row.get(k)) for k in ('description', 'category', 'tag', 'group')}
        if identity in events:
            previous, original = events[identity]
            different = [k for k in fields if fields[k] != original[k]]
            if different:
                details = '; '.join(f'{k}: {original[k][:70]!r} → {fields[k][:70]!r}' for k in different)
                add('ERROR', number, f'与第 {previous} 行同日期同标题，但字段不一致，会拆成多个条目：{details}')
        else:
            events[identity] = (number, fields)
        if group:
            metadata = (title, fields['category'], fields['tag'], fields['description'])
            if group in groups and any(value and value != original for value, original in zip(metadata, groups[group][1])):
                add('ERROR', number, f'Group {group!r} 与第 {groups[group][0]} 行的标题、分类、标签或说明不一致；请统一，避免分组内容被忽略')
            groups.setdefault(group, (number, metadata))
        desc_key = (identity, fields['description'])
        if desc_key not in descriptions:
            descriptions.add(desc_key)
            previous_speech = False
            for line_number, line in enumerate(fields['description'].splitlines(), 1):
                prefix = f'description 第 {line_number} 行'
                if re.match(r'^(回复|点赞|引用)', line) and re.search(r'[|｜]', line):
                    valid = re.match(r'^回复[|｜]'+names+r'[：:]\s*\S', line) or re.match(r'^回复[|｜]'+names+r'[：:]\s*$', line) or re.fullmatch(r'点赞[|｜]'+names+r'(?:[：:].*)?', line)
                    if not valid:
                        add('ERROR', number, f'{prefix} 标记无效：{line[:90]}；使用 回复|姓名：内容 或 点赞|姓名')
                    elif not previous_speech:
                        add('WARN', number, f'{prefix} 没有前一条发言可关联：{line[:60]}')
                if re.match(r'^'+names+r'[①-⑳][：:]', line):
                    add('ERROR', number, f'{prefix} 作者名带编号，请去掉编号：{line[:60]}')
                if speaker.match(line) and not line.startswith(('点赞|', '点赞｜')):
                    previous_speech = True
        kind, src = text(row.get('media_type')).lower(), text(row.get('media_src'))
        target = text(row.get('media_url')) if kind == 'link' else src
        if kind and kind not in ('image', 'video', 'link'):
            add('ERROR', number, f'未知 media_type：{kind}')
        elif kind and not target:
            add('WARN' if kind == 'link' else 'ERROR', number, f'{kind} 缺少媒体地址')
        if kind and target:
            media_key = (group or identity, kind, target)
            if media_key in media_seen:
                add('WARN', number, f'媒体与第 {media_seen[media_key]} 行重复：{target}')
            media_seen.setdefault(media_key, number)
        if kind == 'image' and src:
            if re.search(r'-(?:ins|推特回复)', src, re.I):
                add('WARN', number, f'旧互动截图仍在展示，请确认是否已转换为回复/点赞：{src}')
            if not src.startswith(('https://', 'http://')):
                cleaned = src.replace('\\', '/')
                while cleaned.startswith('../'):
                    cleaned = cleaned[3:]
                candidates = [Path(root)/cleaned, Path(root)/'images'/cleaned]
                if not any(p.is_file() for p in candidates):
                    add('ERROR', number, f'图片不存在：{src}')
    return issues
