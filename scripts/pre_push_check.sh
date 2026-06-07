#!/usr/bin/env bash
# GitHub = frontend only. Backend/bot deploy: python3 scripts/vps_update.py (local SFTP).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

is_server_path() {
  local path="$1"
  case "$path" in
    backend/*|bot/*|deploy/*) return 0 ;;
    scripts/vps_*|scripts/remote_deploy.py|scripts/broadcast.py|scripts/run_broadcast_vps.py|scripts/verify_bot_handlers.py)
      return 0
      ;;
  esac
  return 1
}

check_no_server_additions() {
  local range="$1"
  local status path
  while IFS=$'\t' read -r status path; do
    [[ -z "$path" ]] && continue
    is_server_path "$path" || continue
    case "$status" in
      A|M)
        echo "pre-push: ОТКАЗ — $path не для GitHub (backend/bot только на VPS: python3 scripts/vps_update.py)" >&2
        exit 1
        ;;
    esac
  done < <(git diff --name-status "$range" 2>/dev/null || true)
}

files=""
if [[ -n "${VERIFY_RANGE:-}" ]]; then
  check_no_server_additions "$VERIFY_RANGE"
  files="$(git diff --name-only "$VERIFY_RANGE" 2>/dev/null || true)"
elif [[ -n "${VERIFY_SHA:-}" ]]; then
  check_no_server_additions "$VERIFY_SHA"
  files="$(git diff-tree --no-commit-id --name-only -r "$VERIFY_SHA" 2>/dev/null || true)"
elif [[ -p /dev/stdin ]]; then
  local_ref="" local_sha="" remote_ref="" remote_sha=""
  while read -r local_ref local_sha remote_ref remote_sha; do
    [[ -z "${local_sha:-}" ]] && continue
    if [[ "${remote_sha:-}" == "0000000000000000000000000000000000000000" ]]; then
      check_no_server_additions "$local_sha"
      chunk="$(git diff-tree --no-commit-id --name-only -r "$local_sha" 2>/dev/null || true)"
    else
      check_no_server_additions "${remote_sha}..${local_sha}"
      chunk="$(git diff --name-only "${remote_sha}..${local_sha}" 2>/dev/null || true)"
    fi
    files+=$'\n'"$chunk"
  done
else
  files="$(git diff --name-only HEAD 2>/dev/null || true)"$'\n'"$(git diff --name-only --cached 2>/dev/null || true)"
fi

needs_frontend=false
while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  case "$path" in
    frontend/*) needs_frontend=true ;;
  esac
done <<< "$(printf '%s\n' "$files" | sed '/^$/d' | sort -u)"

if ! $needs_frontend; then
  echo "pre-push: нет изменений frontend/ — проверки пропущены"
  exit 0
fi

echo "pre-push: frontend → npm run build"
cd "$ROOT/frontend"
if [[ ! -d node_modules ]]; then
  echo "pre-push: node_modules missing → npm ci"
  npm ci --silent
fi
VITE_API_URL="${VITE_API_URL:-https://62-217-182-239.nip.io}" npm run build
echo "pre-push: ok"
