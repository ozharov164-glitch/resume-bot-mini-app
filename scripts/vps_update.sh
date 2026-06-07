#!/usr/bin/env bash
# Upload backend/bot to VPS from local repo (scripts/vps_update.py).
set -euo pipefail
cd "$(dirname "$0")/.."
exec python3 scripts/vps_update.py "$@"
