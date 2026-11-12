"""Cache public Our Notes sources or convert an explicitly selected image."""
import argparse
import json
from io import BytesIO
from pathlib import Path
import requests
from PIL import Image

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('kind', choices=['page', 'video', 'dynamic', 'image'])
    p.add_argument('source', help='URL; video also accepts BV ID, dynamic accepts opus ID')
    p.add_argument('output', type=Path, help='New cache/JSON/WebP file; existing files are not overwritten')
    a = p.parse_args()
    if a.output.exists():
        p.error('Output exists; choose a new cache file or inspect existing content first')
    url = a.source
    if a.kind == 'video' and url.startswith('BV'):
        url = 'https://www.bilibili.com/video/' + url
    if a.kind == 'dynamic' and url.isdigit():
        url = 'https://api.bilibili.com/x/polymer/web-dynamic/v1/detail?id=' + url
    if not url.startswith('https://'):
        p.error('Use an HTTPS public source URL')
    r = requests.get(url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.bilibili.com/'}, timeout=45)
    r.raise_for_status()
    r.encoding = 'utf-8'
    if a.kind == 'image':
        im = Image.open(BytesIO(r.content))
        im.load()
        if min(im.size) < 400:
            raise ValueError(f'Likely thumbnail: {im.size}; inspect the source')
        if a.output.suffix.lower() != '.webp':
            p.error('Image output must end in .webp')
        a.output.parent.mkdir(parents=True, exist_ok=True)
        with a.output.open('xb') as f:
            im.save(f, 'WEBP', quality=94, method=6)
        print(json.dumps({'source': url, 'size': im.size, 'output': str(a.output)}, ensure_ascii=False))
        return
    data = r.text
    if a.kind == 'video':
        marker = '__INITIAL_STATE__='
        if marker not in data:
            raise ValueError('Video state unavailable; inspect the public page or report the limitation')
        state = json.JSONDecoder().raw_decode(data.split(marker, 1)[1])[0]
        data = state['videoData']
        if str(data.get('owner', {}).get('mid')) != '3706946530052970':
            raise ValueError('Video is not from OurNotesOfficial')
    elif a.kind == 'dynamic':
        data = r.json()
        if data.get('code') != 0:
            raise ValueError(f"Bilibili API error: {data.get('code')} {data.get('message')}")
        author = data['data']['item']['modules']['module_author']
        if str(author.get('mid')) != '3706946530052970':
            raise ValueError('Dynamic is not from OurNotesOfficial')
    a.output.parent.mkdir(parents=True, exist_ok=True)
    with a.output.open('x', encoding='utf-8') as f:
        f.write(data if isinstance(data, str) else json.dumps(data, ensure_ascii=False, indent=2))
    print(a.output)

if __name__ == '__main__':
    main()
