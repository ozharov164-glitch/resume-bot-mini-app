#!/usr/bin/env python3
"""Update OpenRouter settings on VPS (.env only, never in git)."""

from __future__ import annotations

import os
import sys

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "62.217.182.239")
USER = os.environ.get("DEPLOY_USER", "root")
PASSWORD = os.environ["DEPLOY_PASSWORD"]
OPENROUTER_KEY = os.environ["OPENROUTER_API_KEY"]

ENV_LINES = {
    "OPENROUTER_API_KEY": OPENROUTER_KEY,
    "OPENROUTER_MODEL": "deepseek/deepseek-v4-flash",
    "OPENROUTER_MODEL_FALLBACK": "deepseek/deepseek-v3.2",
    "OPENROUTER_PROVIDER_ONLY": "parasail,alibaba,deepseek,morph",
    "OPENROUTER_MAX_TOKENS": "1200",
}


def main() -> None:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    sftp = client.open_sftp()
    path = "/opt/resumebot/backend/.env"
    try:
        with sftp.file(path, "r") as f:
            lines = f.read().decode().splitlines()
    except FileNotFoundError:
        lines = []

    out: list[str] = []
    seen = set()
    for line in lines:
        key = line.split("=", 1)[0].strip() if "=" in line else ""
        if key in ENV_LINES:
            out.append(f"{key}={ENV_LINES[key]}")
            seen.add(key)
        else:
            out.append(line)
    for key, val in ENV_LINES.items():
        if key not in seen:
            out.append(f"{key}={val}")

    with sftp.file(path, "w") as f:
        f.write("\n".join(out) + "\n")
    sftp.close()

    for cmd in (
        "cd /opt/resumebot && git pull origin main",
        "systemctl restart resumebot-api",
        "sleep 2 && systemctl is-active resumebot-api",
    ):
        _, stdout, stderr = client.exec_command(cmd)
        print(stdout.read().decode(), stderr.read().decode())

    client.close()
    print("OpenRouter config applied on VPS.")


if __name__ == "__main__":
    main()
