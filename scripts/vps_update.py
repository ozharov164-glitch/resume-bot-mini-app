#!/usr/bin/env python3
"""
Deploy backend + bot to VPS from LOCAL repo (SFTP). Does NOT git pull on server.

Frontend → push to main → GitHub Actions (GitHub Pages only).
Secrets stay on VPS (backend/.env is never overwritten).
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

try:
    import paramiko
except ImportError:
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "paramiko", "-q"])
    import paramiko

from vps_sync import REMOTE_ROOT, upload_tree

HOST = os.environ.get("DEPLOY_HOST", "62.217.182.239")
USER = os.environ.get("DEPLOY_USER", "root")
ENV_FILE = Path(__file__).resolve().parent / ".deploy_env"

REMOTE_POST_CMD = f"""
set -e
mkdir -p {REMOTE_ROOT}/data
if grep -q '^SQLITE_PATH=' {REMOTE_ROOT}/backend/.env 2>/dev/null; then
  sed -i 's|^SQLITE_PATH=.*|SQLITE_PATH={REMOTE_ROOT}/data/resumebot.db|' {REMOTE_ROOT}/backend/.env
else
  echo 'SQLITE_PATH={REMOTE_ROOT}/data/resumebot.db' >> {REMOTE_ROOT}/backend/.env
fi
cd {REMOTE_ROOT}/backend && ./venv/bin/pip install -q -r requirements.txt
set_env() {{
  local key="$1" val="$2"
  if grep -q "^${{key}}=" .env 2>/dev/null; then
    sed -i "s|^${{key}}=.*|${{key}}=${{val}}|" .env
  else
    echo "${{key}}=${{val}}" >> .env
  fi
}}
set_env OPENROUTER_MODEL deepseek/deepseek-chat-v3.1
set_env OPENROUTER_MODEL_FALLBACK deepseek/deepseek-v3.2
set_env OPENROUTER_PROVIDER_ONLY ''
set_env STARS_PRICE_SINGLE_PDF 149
set_env RUB_PRICE_SINGLE_PDF 149
if grep -q '^FOUNDER_TELEGRAM_IDS=' .env 2>/dev/null; then
  sed -i 's/^FOUNDER_TELEGRAM_IDS=.*/FOUNDER_TELEGRAM_IDS=7595981350/' .env
else
  echo 'FOUNDER_TELEGRAM_IDS=7595981350' >> .env
fi
if grep -q '^ADMIN_GROUP_CHAT_ID=' .env 2>/dev/null; then
  sed -i 's/^ADMIN_GROUP_CHAT_ID=.*/ADMIN_GROUP_CHAT_ID=1003959501619/' .env
else
  echo 'ADMIN_GROUP_CHAT_ID=1003959501619' >> .env
fi
set_env PDF_MAX_CONCURRENT 2
set_env PDF_QUEUE_ENABLED true
if command -v redis-cli >/dev/null 2>&1 && redis-cli ping 2>/dev/null | grep -q PONG; then
  set_env REDIS_URL redis://127.0.0.1:6379/0
fi
systemctl restart resumebot-api resumebot-bot
sleep 4
systemctl is-active resumebot-api resumebot-bot
curl -sf --retry 3 --retry-delay 2 http://127.0.0.1:8000/health
echo ""
echo VPS_UPDATE_OK
"""


def _load_password() -> str:
    if os.environ.get("DEPLOY_PASSWORD"):
        return os.environ["DEPLOY_PASSWORD"]
    if ENV_FILE.is_file():
        for line in ENV_FILE.read_text().splitlines():
            line = line.strip()
            if line.startswith("DEPLOY_PASSWORD="):
                return line.split("=", 1)[1].strip().strip("'\"")
    raise SystemExit(
        "Set DEPLOY_PASSWORD or create scripts/.deploy_env with DEPLOY_PASSWORD=..."
    )


def _connect() -> paramiko.SSHClient:
    password = _load_password()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=password, timeout=30)
    return client


def main() -> None:
    parser = argparse.ArgumentParser(description="Deploy backend/bot to VPS from local files.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List files that would be uploaded; do not connect.",
    )
    parser.add_argument(
        "--upload-only",
        action="store_true",
        help="Upload files without pip install / restart.",
    )
    args = parser.parse_args()

    if args.dry_run:
        from vps_sync import iter_upload_paths, ROOT

        paths = iter_upload_paths()
        for local, remote in paths:
            print(f"  {local.relative_to(ROOT)} → {remote}")
        print(f"dry-run: {len(paths)} files (no connection)")
        return

    client = _connect()
    print(f"Connected to {HOST}")
    try:
        sftp = client.open_sftp()
        try:
            upload_tree(sftp)
        finally:
            sftp.close()

        if args.upload_only:
            print("Upload-only complete (services not restarted).")
            return

        _, stdout, stderr = client.exec_command(REMOTE_POST_CMD, get_pty=True, timeout=300)
        code = stdout.channel.recv_exit_status()
        out = stdout.read().decode(errors="replace")
        err = stderr.read().decode(errors="replace")
        if out:
            print(out)
        if err.strip():
            print(err, file=sys.stderr)
        if code != 0 or "VPS_UPDATE_OK" not in out:
            raise SystemExit(f"VPS update failed (exit {code})")
        print("Deploy complete (local → VPS, no git on server).")
    finally:
        client.close()


if __name__ == "__main__":
    main()
