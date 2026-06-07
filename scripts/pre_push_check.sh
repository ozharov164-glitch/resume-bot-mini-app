#!/usr/bin/env bash
# Run the same gates as .github/workflows/ci-and-deploy.yml before git push.
# Used by .githooks/pre-push.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

collect_changed_files() {
  local files=""
  if [[ -n "${VERIFY_RANGE:-}" ]]; then
    files="$(git diff --name-only "$VERIFY_RANGE" 2>/dev/null || true)"
  elif [[ -n "${VERIFY_SHA:-}" ]]; then
    files="$(git diff-tree --no-commit-id --name-only -r "$VERIFY_SHA" 2>/dev/null || true)"
  elif [[ -p /dev/stdin ]]; then
    local local_ref local_sha remote_ref remote_sha
    while read -r local_ref local_sha remote_ref remote_sha; do
      [[ -z "${local_sha:-}" ]] && continue
      if [[ "${remote_sha:-}" == "0000000000000000000000000000000000000000" ]]; then
        local chunk
        chunk="$(git diff-tree --no-commit-id --name-only -r "$local_sha" 2>/dev/null || true)"
      else
        local chunk
        chunk="$(git diff --name-only "${remote_sha}..${local_sha}" 2>/dev/null || true)"
      fi
      files+=$'\n'"$chunk"
    done
  else
    files="$(git diff --name-only HEAD 2>/dev/null || true)"$'\n'"$(git diff --name-only --cached 2>/dev/null || true)"
  fi
  printf '%s\n' "$files" | sed '/^$/d' | sort -u
}

needs_frontend=false
needs_backend=false

while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  case "$path" in
    frontend/*) needs_frontend=true ;;
    backend/*|bot/*) needs_backend=true ;;
  esac
done < <(collect_changed_files)

if ! $needs_frontend && ! $needs_backend; then
  echo "pre-push: no frontend/backend changes — skip checks"
  exit 0
fi

if $needs_frontend; then
  echo "pre-push: frontend → npm run build"
  cd "$ROOT/frontend"
  if [[ ! -d node_modules ]]; then
    echo "pre-push: node_modules missing → npm ci"
    npm ci --silent
  fi
  VITE_API_URL="${VITE_API_URL:-https://62-217-182-239.nip.io}" npm run build
  cd "$ROOT"
fi

if $needs_backend; then
  echo "pre-push: backend/bot → python syntax check"
  py_files=()
  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    py_files+=("$path")
  done < <(collect_changed_files | grep -E '^(backend|bot)/.*\.py$' || true)
  if ((${#py_files[@]} > 0)); then
    python3 -m py_compile "${py_files[@]}"
  else
    python3 -m py_compile \
      backend/main.py \
      backend/storage/backends.py \
      backend/services/pdf_service.py \
      bot/bot.py
  fi
  echo "pre-push: после push выполните деплой на VPS: python3 scripts/vps_update.py"
fi

echo "pre-push: all checks passed"
