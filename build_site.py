"""Build the public-only static site into dist/.

The repository root remains the authoring workspace. Only files explicitly
listed here are allowed into the deployable directory.
"""

from __future__ import annotations

import os
import re
import shutil
import tempfile
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"

ROOT_FILES = (
    "index.html",
    "nav-style.css",
    "favicon.ico",
    "robots.txt",
    "announcements.js",
    "something-new.js",
    "search-index.js",
    "search-bodies.js",
)

SHARED_DIRECTORIES = (
    "css",
    "js",
    "icons",
    "images",
)

PAGE_FILES = {
    "songs": (
        "index.html",
        "style.css",
        "data.js",
        "lyrics-atlas.js",
        "lyrics-atlas-data.js",
        "vendor",
    ),
    "live": ("index.html", "style.css", "data.js"),
    "timeline": ("index.html", "style.css", "data.js"),
    "gallery": ("index.html", "style.css", "data.js"),
    "interview": ("index.html", "style.css", "page.js", "data.js"),
    "discography": ("index.html", "style.css", "data.js"),
}

FORBIDDEN_PUBLIC_SUFFIXES = {".py", ".pyc", ".xlsx", ".md", ".exe"}
HTML_REFERENCE_RE = re.compile(r'(?:href|src)=["\']([^"\']+)["\']', re.IGNORECASE)


def copy_item(source: Path, destination: Path) -> None:
    if not source.exists():
        raise FileNotFoundError(f"发布清单中的文件不存在：{source.relative_to(ROOT)}")
    if source.is_dir():
        shutil.copytree(source, destination)
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)


def validate_public_tree(public_root: Path) -> None:
    forbidden = [
        path.relative_to(public_root)
        for path in public_root.rglob("*")
        if path.is_file() and path.suffix.lower() in FORBIDDEN_PUBLIC_SUFFIXES
    ]
    if forbidden:
        names = ", ".join(str(path) for path in forbidden[:10])
        raise RuntimeError(f"发布目录包含不应公开的源码或工具文件：{names}")

    missing: list[str] = []
    for html_file in public_root.rglob("*.html"):
        html = html_file.read_text(encoding="utf-8")
        for reference in HTML_REFERENCE_RE.findall(html):
            if "${" in reference:
                continue
            parsed = urlsplit(reference)
            if parsed.scheme or parsed.netloc or reference.startswith(("#", "//")):
                continue
            relative_path = unquote(parsed.path)
            if not relative_path:
                continue
            target = (html_file.parent / relative_path).resolve()
            try:
                target.relative_to(public_root.resolve())
            except ValueError:
                missing.append(f"{html_file.relative_to(public_root)} -> {reference}（越出发布目录）")
                continue
            if not target.exists():
                missing.append(f"{html_file.relative_to(public_root)} -> {reference}")

    if missing:
        details = "\n  ".join(missing[:20])
        raise RuntimeError(f"发布目录存在缺失的本地资源：\n  {details}")


def build() -> tuple[int, int]:
    temporary = Path(tempfile.mkdtemp(prefix=".dist-", dir=ROOT))
    try:
        for relative in ROOT_FILES:
            copy_item(ROOT / relative, temporary / relative)

        for directory in SHARED_DIRECTORIES:
            copy_item(ROOT / directory, temporary / directory)

        for page, entries in PAGE_FILES.items():
            for entry in entries:
                copy_item(ROOT / page / entry, temporary / page / entry)

        validate_public_tree(temporary)

        if DIST.exists():
            if DIST.resolve().parent != ROOT.resolve() or DIST.name != "dist":
                raise RuntimeError(f"拒绝清理非预期目录：{DIST}")
            shutil.rmtree(DIST)
        os.replace(temporary, DIST)

        files = [path for path in DIST.rglob("*") if path.is_file()]
        return len(files), sum(path.stat().st_size for path in files)
    except Exception:
        if temporary.exists():
            shutil.rmtree(temporary)
        raise


if __name__ == "__main__":
    file_count, total_bytes = build()
    print(f"发布目录已生成：{DIST}")
    print(f"文件：{file_count} 个，大小：{total_bytes / 1024 / 1024:.2f} MB")
    print("请只部署 dist/ 中的内容。")
