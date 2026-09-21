"""Publish the generated site to the deploy branch without checking it out."""

from __future__ import annotations

import argparse
import os
import subprocess
import tempfile
from pathlib import Path

from build_site import ROOT, build


DEPLOY_BRANCH = "deploy"


def git(*arguments: str, env: dict[str, str] | None = None, check: bool = True) -> str:
    completed = subprocess.run(
        ("git", *arguments),
        cwd=ROOT,
        env=env,
        check=False,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if check and completed.returncode != 0:
        message = completed.stderr.strip() or completed.stdout.strip() or "未知 Git 错误"
        raise RuntimeError(f"git {' '.join(arguments)} 失败：{message}")
    return completed.stdout.strip()


def verify_ref(reference: str) -> str | None:
    completed = subprocess.run(
        ("git", "rev-parse", "--verify", reference),
        cwd=ROOT,
        check=False,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    return completed.stdout.strip() if completed.returncode == 0 else None


def create_deploy_commit(allow_dirty: bool, skip_build: bool = False) -> tuple[str, bool]:
    status = git("status", "--porcelain", "--untracked-files=normal")
    is_dirty = bool(status)
    if is_dirty and not allow_dirty:
        raise RuntimeError(
            "工作区存在未提交修改。请先提交 main，再重新发布；"
            "只有首次初始化等明确场景才使用 --allow-dirty。"
        )

    if skip_build:
        if not (ROOT / "dist" / "index.html").is_file():
            raise RuntimeError("dist/ 尚未生成，不能使用 --skip-build")
        print("使用已经生成并校验的 dist/")
    else:
        file_count, total_bytes = build()
        print(f"dist/ 已生成：{file_count} 个文件，{total_bytes / 1024 / 1024:.2f} MB")

    descriptor, index_name = tempfile.mkstemp(prefix="wijipedia-deploy-index-")
    os.close(descriptor)
    index_path = Path(index_name)
    index_path.unlink()
    environment = os.environ.copy()
    environment["GIT_INDEX_FILE"] = str(index_path)

    try:
        git("--work-tree", str(ROOT / "dist"), "read-tree", "--empty", env=environment)
        git("--work-tree", str(ROOT / "dist"), "add", "--all", "--force", env=environment)
        tree = git("--work-tree", str(ROOT / "dist"), "write-tree", env=environment)

        local_ref = f"refs/heads/{DEPLOY_BRANCH}"
        parent = verify_ref(local_ref)
        if parent and verify_ref(f"{parent}^{{tree}}") == tree:
            return parent, False

        source_revision = git("rev-parse", "--short", "HEAD")
        source_label = f"{source_revision} (working tree)" if is_dirty else source_revision
        message = f"Deploy site from {source_label}"
        commit_arguments = ["commit-tree", tree, "-m", message]
        if parent:
            commit_arguments.extend(("-p", parent))
        commit = git(*commit_arguments)
        if parent:
            git("update-ref", local_ref, commit, parent)
        else:
            git("update-ref", local_ref, commit)
        return commit, True
    finally:
        index_path.unlink(missing_ok=True)
        Path(str(index_path) + ".lock").unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="构建 dist 并更新只包含公开文件的 deploy 分支")
    parser.add_argument("--allow-dirty", action="store_true", help="允许从未提交的工作区发布，仅应用于明确的初始化场景")
    parser.add_argument("--skip-build", action="store_true", help="使用现有 dist，仅用于已经单独完成构建与校验的场景")
    parser.add_argument("--push", action="store_true", help="更新本地 deploy 后推送到 origin/deploy")
    args = parser.parse_args()

    commit, changed = create_deploy_commit(args.allow_dirty, args.skip_build)
    if changed:
        print(f"本地 {DEPLOY_BRANCH} 已更新：{commit[:12]}")
    else:
        print(f"发布内容没有变化：{commit[:12]}")

    if args.push:
        git("push", "origin", f"refs/heads/{DEPLOY_BRANCH}:refs/heads/{DEPLOY_BRANCH}")
        print("已推送到 origin/deploy")
    else:
        print("尚未推送；确认后运行：git push -u origin deploy")


if __name__ == "__main__":
    main()
