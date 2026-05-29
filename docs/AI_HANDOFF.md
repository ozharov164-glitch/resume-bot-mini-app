# ResumeBot — Handoff для другой ИИ

Документ для передачи контекста следующему агенту. Описывает, что было сделано, как устроен проект, как выполнен UI/UX, как прошёл деплой и что не трогать.

---

## 1. Цель продукта

Telegram Mini App: пользователь за ~5 минут через диалог получает резюме под российский рынок (формат hh.ru). ЦА — не IT (продавцы, водители, кладовщики и т.д.). Монетизация: бесплатное текстовое превью → оплата → PDF в чат Telegram.

---

## 2. Что реализовано (факт)

### Frontend (`frontend/`)

- **Стек:** React 18, Vite, TypeScript, Zustand, TailwindCSS.
- **Страницы:** `Onboarding` (8 шагов), `Preview`, `Payment`, `Success`.
- **Telegram:** `telegram.ts` — `ready()`, `expand()`, CSS-переменные из `themeParams` (`--tg-bg`, `--tg-text`, `--tg-button`, `--tg-secondary-bg`).
- **API:** `api.ts` — auth, generate, payment, download; `VITE_API_URL` из env при сборке.
- **Состояние:** `store.ts` — ответы, JWT, resumeId, resumeData, isPaid, навигация по page.
- **Деплой:** GitHub Actions → GitHub Pages, `base: /resume-bot-mini-app/` в `vite.config.ts`.

### Backend (`backend/`)

- **Стек:** FastAPI, httpx, python-jose, supabase-py, WeasyPrint, Jinja2, python-telegram-bot, yookassa.
- **Роутеры:**
  - `auth.py` — POST `/api/auth/telegram` (verify initData → JWT).
  - `resume.py` — POST `/api/resume/generate`, GET `/{id}`, GET `/{id}/download` (PDF в TG).
  - `payment.py` — Stars invoice, YooKassa create, telegram webhook.
- **Сервисы:**
  - `ai_service.py` — OpenRouter, DeepSeek v4 flash, routing fastest providers.
  - `pdf_service.py` — HTML → PDF.
  - `telegram_service.py` — verify initData, sendDocument.
  - `payment_service.py` — Stars + YooKassa.
- **Шаблон PDF:** `templates/resume_classic.html`.
- **CORS:** GitHub Pages origin + `FRONTEND_URL`.

### Bot (`bot/bot.py`)

- `/start` — кнопка Web App на `FRONTEND_URL`.
- `/help` — краткая инструкция.
- Polling (не webhook для команд; payment webhook отдельно на API).

### Инфраструктура

- **GitHub:** `ozharov164-glitch/resume-bot-mini-app` (public).
- **Pages URL:** `https://ozharov164-glitch.github.io/resume-bot-mini-app/`
- **VPS:** `62.217.182.239`, код в `/opt/resumebot`.
- **API HTTPS:** `https://62-217-182-239.nip.io` (Caddy → uvicorn :8000).
- **systemd:** `resumebot-api`, `resumebot-bot`.
- **Скрипты:** `scripts/remote_deploy.py`, `scripts/update_vps_openrouter.py` (секреты только через env, не в git).

---

## 3. Дизайн и UX (как выполнен)

Принцип: **нативный вид Telegram Mini App**, не «отдельный сайт».

| Решение | Реализация |
|--------|------------|
| Цвета | CSS variables из `Telegram.WebApp.themeParams`, fallback для light |
| Типографика | system stack (Inter-like), 16–20px вопросы, читаемые отступы |
| Кнопки | `OptionButton` — pill chips, selected = `button_color` TG |
| Прогресс | `ProgressBar` — линейный, цвет кнопки TG |
| Haptic | `HapticFeedback.impactOccurred('light')` на действиях (где подключено) |
| Копирайт | Русский, без канцелярита, короткие формулировки на шагах |
| Layout | mobile-first, `min-h-screen`, крупные touch targets (py-3/py-4) |

**Не использовалось:** shadcn, отдельная дизайн-система, кастомные шрифты с CDN (в PDF — Arial для WeasyPrint).

**Страницы по смыслу:**

1. Onboarding — один вопрос на экран, options / text / textarea.
2. Preview — карточка с именем, должностью, summary, skills.
3. Payment — два канала: Stars (primary), YooKassa (fallback).
4. Success — подтверждение отправки PDF в чат.

**Оплата Stars (in-app):** `POST /api/payment/create-invoice` → `invoice_link` → `WebApp.openInvoice` → бот (`successful_payment`) → PDF в чат.

---

## 4. ИИ-слой (текущая конфигурация)

Файл: `backend/services/ai_service.py`

- **Модель:** `deepseek/deepseek-v4-flash`
- **Fallback:** `deepseek/deepseek-v3.2` только при JSON parse error или HTTP 402/429/503
- **Провайдеры (only):** `parasail`, `alibaba`, `deepseek`, `morph` — выбраны по latency p50 OpenRouter
- **Routing:** `sort: { by: latency, partition: model }`, `preferred_max_latency`
- **max_tokens:** 1600
- **temperature:** 0.68 (generate), 0.5 (adapt vacancy)
- **response_format:** `json_object` (retry без него при 400)

**Баланс качество/токены:**

- System prompt с HR-правилами hh.ru (опыт, summary, без выдуманного стажа).
- User payload структурированный, без лишних вводных фраз.
- Обрезка полей только при переборе (last_job до 2000 символов и т.д.).
- Нет двойного вызова модели «на всякий случай».

Env: `OPENROUTER_*` в `backend/config.py` и `.env` на VPS.

---

## 5. Как прошёл деплой (хронология)

1. С нуля собран monorepo локально в `/Users/dmitriidekhanov/resumebot`.
2. `git init` → push в `ozharov164-glitch/resume-bot-mini-app`.
3. VPS: `remote_deploy.py` — apt, clone, venv, pip, systemd, nginx (потом заменён на Caddy).
4. Certbot на nip.io не сработал → Caddy на 80/443, nginx отключён.
5. API `/health` — OK по HTTPS.
6. GitHub Pages workflow — success после push в `frontend/`.
7. OpenRouter ключ и provider settings — `update_vps_openrouter.py`, только в `.env` на сервере.
8. Промпт AI перебалансирован: качество резюме важнее агрессивной экономии токенов.

**Секреты в Git не попадали.** `.gitignore`: `.env`, `venv`, `node_modules`, `dist`.

---

## 6. Переменные окружения (VPS: `/opt/resumebot/backend/.env`)

Обязательные:

```
BOT_TOKEN=
BOT_USERNAME=
OPENROUTER_API_KEY=
OPENROUTER_APP_URL=https://62-217-182-239.nip.io
OPENROUTER_MODEL=deepseek/deepseek-v4-flash
OPENROUTER_MODEL_FALLBACK=deepseek/deepseek-v3.2
OPENROUTER_PROVIDER_ONLY=parasail,alibaba,deepseek,morph
OPENROUTER_MAX_TOKENS=1600
SUPABASE_URL=
SUPABASE_KEY=
JWT_SECRET=
APP_URL=https://62-217-182-239.nip.io
FRONTEND_URL=https://ozharov164-glitch.github.io/resume-bot-mini-app
```

Опционально: `YOKASSA_*`, `DEBUG=false`.

---

## 7. База данных (Supabase)

Таблицы по спецификации: `users`, `resumes`, `payments`.  
`resumes.data` — jsonb. Проверить, что пользователь создал таблицы и RLS/ключ service role корректен.

---

## 8. Известные ограничения / долги

- Payment webhook Telegram может требовать настройки URL в BotFather на API endpoint.
- `adapt_resume_for_vacancy` — заготовка, не в MVP UI.
- Нет rate limit на `/generate`.
- Домен nip.io — временный; лучше свой домен.
- Bot и API на одном VPS — при росте нагрузки разделить.
- Пользователь светил credentials в чате — рекомендована ротация BOT_TOKEN и root password.

---

## 9. Команды для следующей ИИ

```bash
# Локально
cd backend && uvicorn main:app --reload --port 8000
cd frontend && npm run dev

# VPS
ssh root@62.217.182.239
systemctl status resumebot-api resumebot-bot
journalctl -u resumebot-api -n 100 --no-pager
# Локально (из корня репо, credentials в scripts/.deploy_env):
python3 scripts/vps_update.py

# Или вручную на VPS:
cd /opt/resumebot && git pull && systemctl restart resumebot-api resumebot-bot

# Проверки
curl https://62-217-182-239.nip.io/health
curl -I https://ozharov164-glitch.github.io/resume-bot-mini-app/
```

---

## 10. Правила проекта (не ломать)

1. PDF только WeasyPrint + Jinja2 (не Puppeteer).
2. Auth только Telegram initData (не email/password).
3. Основная модель OpenRouter: `deepseek/deepseek-v4-flash`.
4. Секреты не коммитить.
5. MVP scope — не добавлять V1.1 фичи без запроса.
6. UI должен использовать theme Telegram (`--tg-*`).

---

## 11. Бот

- Username: `@resumeez_bot`
- Mini App URL в BotFather: `https://ozharov164-glitch.github.io/resume-bot-mini-app/`

---

## 12. Структура файлов (кратко)

```
frontend/src/pages/     — UI flow
frontend/src/api.ts     — backend calls
backend/routers/        — HTTP API
backend/services/       — business logic
bot/bot.py              — TG entry
deploy/*.service        — systemd
.github/workflows/      — Pages CI
```

---

*Документ создан для handoff. HTML-презентация `VIDEO_REPORT_*` удалена по запросу владельца.*
