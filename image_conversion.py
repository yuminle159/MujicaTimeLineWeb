"""Shared WebP conversion rules for folder and selected-file workflows."""
import os
import uuid
from pathlib import Path
from PIL import Image

SUPPORTED_FORMATS = {'.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.tif'}

def convert_image_files_to_webp(paths, log_func=None, *, remove_originals=False):
    log = log_func or print
    result = {'created': [], 'skipped': [], 'failed': [], 'removed': []}
    for raw in paths:
        source = Path(raw)
        target = source.with_suffix('.webp')
        if source.suffix.lower() not in SUPPORTED_FORMATS or source.suffix.lower() == '.webp':
            result['skipped'].append(source)
            continue
        if os.path.lexists(target):
            log(f'    [跳过] 已有同名 WebP：{target.name}')
            result['skipped'].append(source)
            continue
        temp = target.with_name('.webp-' + uuid.uuid4().hex + '.tmp')
        try:
            original_stat = source.stat()
            original_size = original_stat.st_size / 1024
            with Image.open(source) as img:
                if img.mode not in ('RGB', 'RGBA'):
                    img = img.convert('RGBA')
                if img.width > 1920:
                    old_width, old_height = img.size
                    height = int(img.height * (1920 / img.width))
                    img = img.resize((1920, height), Image.Resampling.LANCZOS)
                    log(f'    [缩放] {source.name}: {old_width}x{old_height} -> 1920x{height}')
                img.save(temp, 'webp', quality=75, method=6)
            if os.path.lexists(target):
                raise FileExistsError(f'已有同名 WebP：{target.name}')
            # Windows rename refuses an existing destination, including a late conflict.
            os.rename(temp, target)
            result['created'].append(target)
            log(f'    {source.name} ({original_size:.1f}KB -> {target.stat().st_size / 1024:.1f}KB)')
            if remove_originals:
                with Image.open(target) as converted:
                    converted.load()
                    if converted.format != 'WEBP':
                        raise ValueError('输出不是有效的 WebP，原图保留。')
                current_stat = source.stat()
                if (current_stat.st_size, current_stat.st_mtime_ns) != (original_stat.st_size, original_stat.st_mtime_ns):
                    raise RuntimeError('转换期间原图被修改，原图保留。')
                source.unlink()
                result['removed'].append(source)
        except Exception as exc:
            result['failed'].append((source, str(exc)))
            log(f'    [失败] {source.name}: {exc}')
        finally:
            if temp.exists():
                temp.unlink()
    return result
