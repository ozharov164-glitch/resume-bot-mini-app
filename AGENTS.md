# ResumeBot agent memory

## Learned User Preferences

- User communicates in Russian.
- Do not commit or push unless explicitly asked.
- Expects autonomous end-to-end delivery: install deps, fetch assets, and produce deliverables (e.g. MP4) without asking the user to run manual steps.
- After large fixes or deploys, prefers very brief executive summaries over long reports.
- Position ResumeBot for many professions in copy and analysis, not only mass-market roles (driver, courier).

## Learned Workspace Facts

- Telegram Mini App + Python FastAPI backend + React frontend.
- VPS deploy: `python3 scripts/vps_update.py` — local SFTP upload to VPS (**no git pull on server**); secrets in `scripts/.deploy_env` (gitignored).
- Production: `https://62-217-182-239.nip.io/health` → `{"status":"ok"}`.
- SkillPick: `backend/services/ai_service.py` → `suggest_skills()`; fallback is substring on `FALLBACK_SKILLS`.
- Frontend: push to `main` with `frontend/` changes → GitHub Actions → GitHub Pages only. Production Mini App: `https://ozharov164-glitch.github.io/resume-bot-mini-app` (`FRONTEND_URL` on VPS). Backend/bot: always `vps_update.py` after local changes.
- graphify knowledge graph at `graphify-out/` — run `graphify query` for architecture questions.
- Local Python tooling uses repo-root `.venv` (not `backend/venv`, which is VPS-only).
- TikTok marketing reel: `marketing/tiktok-reel/` — build with `./scripts/build_tiktok_video.sh` or `.venv/bin/python marketing/tiktok-reel/build_final.py` (Pillow + imageio-ffmpeg; no Homebrew required).
- TikTok CTA handles: `@resumeez_bot` / `https://t.me/resumeez_bot`.
- `npm install` and `git push` often fail with `ECONNRESET`/SSL on this network — prefer offline Pillow/ffmpeg for marketing video; backend deploy always via `vps_update.py` (does not require git push).
- Admin stats and funnel exclude founder test traffic via `FOUNDER_TELEGRAM_IDS` (default `7595981350`).
- Telegram user broadcast: `scripts/broadcast.py` (`--text-file`, `--photo`); VPS runner `scripts/run_broadcast_vps.py` (dry-run / test / send).
