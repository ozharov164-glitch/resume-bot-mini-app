#!/usr/bin/env python3
"""One-shot VPS deploy (secrets via environment, never committed)."""

from __future__ import annotations

import os
import sys
import textwrap

try:
    import paramiko
except ImportError:
    print("Installing paramiko...")
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "paramiko", "-q"])
    import paramiko


HOST = os.environ.get("DEPLOY_HOST", "62.217.182.239")
USER = os.environ.get("DEPLOY_USER", "root")
PASSWORD = os.environ["DEPLOY_PASSWORD"]
BOT_TOKEN = os.environ["BOT_TOKEN"]
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "REPLACE_ME")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://REPLACE_ME.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "REPLACE_ME")
JWT_SECRET = os.environ.get("JWT_SECRET", os.urandom(32).hex())

FRONTEND_URL = "https://ozharov164-glitch.github.io/resume-bot-mini-app"
APP_URL = "https://62-217-182-239.nip.io"
REPO = "https://github.com/ozharov164-glitch/resume-bot-mini-app.git"


def run(client: paramiko.SSHClient, cmd: str) -> None:
    print(f"$ {cmd}")
    _, stdout, stderr = client.exec_command(cmd, get_pty=True)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if out.strip():
        print(out)
    if err.strip():
        print(err)
    if exit_code != 0:
        raise RuntimeError(f"Command failed ({exit_code}): {cmd}")


def main() -> None:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    run(client, "apt-get update -y")
    run(
        client,
        "DEBIAN_FRONTEND=noninteractive apt-get install -y python3 python3-venv python3-pip "
        "nginx certbot python3-certbot-nginx git "
        "libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 libffi-dev shared-mime-info",
    )

    run(client, "mkdir -p /opt/resumebot")
    run(client, f"if [ ! -d /opt/resumebot/.git ]; then git clone {REPO} /opt/resumebot; else cd /opt/resumebot && git pull; fi")

    # get bot username
    import json
    import urllib.request

    me = json.loads(
        urllib.request.urlopen(f"https://api.telegram.org/bot{BOT_TOKEN}/getMe", timeout=15).read()
    )
    bot_username = me["result"]["username"]

    env_content = textwrap.dedent(
        f"""
        BOT_TOKEN={BOT_TOKEN}
        BOT_USERNAME={bot_username}
        OPENROUTER_API_KEY={OPENROUTER_API_KEY}
        SUPABASE_URL={SUPABASE_URL}
        SUPABASE_KEY={SUPABASE_KEY}
        JWT_SECRET={JWT_SECRET}
        JWT_ALGORITHM=HS256
        JWT_EXPIRE_HOURS=24
        APP_URL={APP_URL}
        FRONTEND_URL={FRONTEND_URL}
        DEBUG=false
        YOKASSA_SHOP_ID=
        YOKASSA_SECRET_KEY=
        YOKASSA_RETURN_URL={FRONTEND_URL}/
        STARS_PRICE_SINGLE_PDF=99
        STARS_PRICE_SUBSCRIPTION=199
        """
    ).strip()

    sftp = client.open_sftp()
    with sftp.file("/opt/resumebot/backend/.env", "w") as f:
        f.write(env_content)
    sftp.close()

    run(client, "cd /opt/resumebot/backend && python3 -m venv venv && ./venv/bin/pip install -U pip && ./venv/bin/pip install -r requirements.txt")
    run(client, "cp /opt/resumebot/deploy/nginx-resumebot.conf /etc/nginx/sites-available/resumebot")
    run(client, "ln -sf /etc/nginx/sites-available/resumebot /etc/nginx/sites-enabled/resumebot")
    run(client, "rm -f /etc/nginx/sites-enabled/default")
    run(client, "nginx -t && systemctl reload nginx")
    run(client, "cp /opt/resumebot/deploy/resumebot-api.service /etc/systemd/system/resumebot-api.service")
    run(client, "cp /opt/resumebot/deploy/resumebot-bot.service /etc/systemd/system/resumebot-bot.service")
    run(client, "systemctl daemon-reload && systemctl enable resumebot-api resumebot-bot && systemctl restart resumebot-api resumebot-bot")

    run(
        client,
        "certbot --nginx -d 62-217-182-239.nip.io --non-interactive --agree-tos -m admin@example.com --redirect || true",
    )

    print("Deploy finished.")
    print(f"API: {APP_URL}")
    print(f"Mini App (Pages): {FRONTEND_URL}")
    client.close()


if __name__ == "__main__":
    main()
