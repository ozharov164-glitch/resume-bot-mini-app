#!/usr/bin/env bash
# Pull latest main on VPS and restart services (uses scripts/.deploy_env).
set -euo pipefail
cd "$(dirname "$0")/.."
exec python3 scripts/vps_update.py
