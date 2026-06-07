"""Upload backend/bot from local repo to VPS — no git on server."""

from __future__ import annotations

import fnmatch
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REMOTE_ROOT = "/opt/resumebot"

# Only these paths leave the laptop. Frontend → GitHub Pages, not VPS.
SYNC_DIRS = ("backend", "bot", "deploy")
SYNC_FILES = (
    "scripts/broadcast.py",
    "scripts/run_broadcast_vps.py",
)

SKIP_DIR_NAMES = frozenset(
    {
        "__pycache__",
        ".pytest_cache",
        ".mypy_cache",
        ".git",
        ".venv",
        "venv",
        "node_modules",
        "tests",
        "htmlcov",
        "graphify-out",
        ".agents",
        ".cursor",
        "data",
    }
)

SKIP_FILE_NAMES = frozenset({".env", ".DS_Store", ".deploy_env"})
SKIP_SUFFIXES = (".pyc", ".pyo", ".db", ".sqlite", ".sqlite3", ".log")

# Extra patterns (relative to repo root) — never upload secrets or local junk.
SKIP_GLOBS = (
    "backend/.env*",
    "scripts/.deploy_env*",
    "**/.env",
    "**/*.pem",
    "**/*.key",
)


def _skip_glob(rel_posix: str) -> bool:
    for pattern in SKIP_GLOBS:
        if fnmatch.fnmatch(rel_posix, pattern):
            return True
    return False


def _skip_name(name: str, *, is_dir: bool) -> bool:
    if is_dir and name in SKIP_DIR_NAMES:
        return True
    if not is_dir and name in SKIP_FILE_NAMES:
        return True
    if not is_dir and name.endswith(SKIP_SUFFIXES):
        return True
    return False


def iter_upload_paths() -> list[tuple[Path, str]]:
    """Local absolute path → remote path under REMOTE_ROOT."""
    out: list[tuple[Path, str]] = []

    def walk(local_dir: Path, remote_prefix: str) -> None:
        for entry in sorted(local_dir.iterdir(), key=lambda p: p.name):
            rel = f"{remote_prefix}/{entry.name}".lstrip("/")
            if _skip_name(entry.name, is_dir=entry.is_dir()):
                continue
            if _skip_glob(rel.replace("\\", "/")):
                continue
            if entry.is_dir():
                walk(entry, rel)
            elif entry.is_file():
                out.append((entry, f"{REMOTE_ROOT}/{rel}"))

    for dirname in SYNC_DIRS:
        local = ROOT / dirname
        if local.is_dir():
            walk(local, dirname)

    for relpath in SYNC_FILES:
        local = ROOT / relpath
        if local.is_file():
            out.append((local, f"{REMOTE_ROOT}/{relpath.replace(os.sep, '/')}"))

    return out


def mkdir_p(sftp, remote_dir: str) -> None:
    parts = [p for p in remote_dir.split("/") if p]
    current = ""
    for part in parts:
        current = f"{current}/{part}" if current else f"/{part}"
        try:
            sftp.stat(current)
        except OSError:
            sftp.mkdir(current)


def upload_tree(sftp, *, dry_run: bool = False) -> int:
    paths = iter_upload_paths()
    if dry_run:
        for local, remote in paths:
            print(f"  {local.relative_to(ROOT)} → {remote}")
        print(f"dry-run: {len(paths)} files")
        return len(paths)

    uploaded = 0
    for local, remote in paths:
        mkdir_p(sftp, os.path.dirname(remote))
        sftp.put(str(local), remote)
        uploaded += 1
    print(f"uploaded {uploaded} files to {REMOTE_ROOT}")
    return uploaded


if __name__ == "__main__":
    import sys

    dry = "--dry-run" in sys.argv
    for local, remote in iter_upload_paths():
        print(f"{local.relative_to(ROOT)} → {remote}")
    print(f"total: {len(iter_upload_paths())} files{' (dry-run)' if dry else ''}")
