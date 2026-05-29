#!/usr/bin/env python3
"""Pull main on VPS and restart API + bot. Credentials: scripts/.deploy_env or DEPLOY_PASSWORD."""

from __future__ import annotations

import os
import sys
from pathlib import Path

try:
    import paramiko
except ImportError:
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "paramiko", "-q"])
    import paramiko

HOST = os.environ.get("DEPLOY_HOST", "62.217.182.239")
USER = os.environ.get("DEPLOY_USER", "root")
ENV_FILE = Path(__file__).resolve().parent / ".deploy_env"

REMOTE_CMD = """
set -e
cd /opt/resumebot
git fetch origin main
git reset --hard origin/main
cd backend && ./venv/bin/pip install -q -r requirements.txt
if grep -q '^FOUNDER_TELEGRAM_IDS=' .env 2>/dev/null; then
  sed -i 's/^FOUNDER_TELEGRAM_IDS=.*/FOUNDER_TELEGRAM_IDS=1003598434943/' .env
else
  echo 'FOUNDER_TELEGRAM_IDS=1003598434943' >> .env
fi
systemctl restart resumebot-api resumebot-bot
sleep 2
systemctl is-active resumebot-api resumebot-bot
curl -sf http://127.0.0.1:8000/health
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


def main() -> None:
    password = _load_password()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=password, timeout=30)
    print(f"Connected to {HOST}")
    _, stdout, stderr = client.exec_command(REMOTE_CMD, get_pty=True, timeout=300)
    code = stdout.channel.recv_exit_status()
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    if out:
        print(out)
    if err.strip():
        print(err, file=sys.stderr)
    client.close()
    if code != 0 or "VPS_UPDATE_OK" not in out:
        raise SystemExit(f"VPS update failed (exit {code})")
    print("Deploy complete.")


if __name__ == "__main__":
    main()
