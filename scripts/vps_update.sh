#!/usr/bin/env bash
# Pull latest main on VPS and restart services. Requires SSH access to DEPLOY_HOST.
set -euo pipefail

HOST="${DEPLOY_HOST:-62.217.182.239}"
USER="${DEPLOY_USER:-root}"

ssh "${USER}@${HOST}" <<'REMOTE'
set -e
cd /opt/resumebot
git fetch origin main
git reset --hard origin/main
cd backend && ./venv/bin/pip install -q -r requirements.txt
systemctl restart resumebot-api resumebot-bot
sleep 2
systemctl is-active resumebot-api resumebot-bot
curl -sf http://127.0.0.1:8000/health
echo ""
echo "VPS update OK"
REMOTE
