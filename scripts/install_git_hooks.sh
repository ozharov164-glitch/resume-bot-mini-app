#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
chmod +x scripts/pre_push_check.sh .githooks/pre-push
git config core.hooksPath .githooks
echo "Installed git hooks: core.hooksPath=.githooks"
echo "Pre-push runs scripts/pre_push_check.sh (frontend build + backend syntax)."
