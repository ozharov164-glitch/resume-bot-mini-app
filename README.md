# ResumeBot

Telegram Mini App для быстрого создания резюме на русском языке: фронтенд размещается на `GitHub Pages`, backend и бот работают на `VPS`.

## Архитектура

- `frontend/` — React + Vite Mini App (GitHub Pages).
- `backend/` — FastAPI API, OpenRouter, PDF, платежи.
- `bot/` — Telegram-бот с кнопкой запуска Mini App.

## Production-схема

1. Пользователь открывает Mini App в Telegram.
2. Frontend отправляет `initData` на backend.
3. Backend валидирует подпись Telegram и выдает JWT.
4. Пользователь проходит диалог, backend генерирует резюме через `deepseek/deepseek-v4-flash`.
5. Оплата проходит через `Telegram Stars` (основной канал) или `ЮKassa` (fallback).
6. Backend генерирует PDF через WeasyPrint и отправляет файл пользователю в чат.

## Быстрый старт локально

### 1) Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Для локального теста в Telegram нужен HTTPS-туннель (`ngrok` или аналог).

## GitHub Pages для Mini App

1. Убедитесь, что workflow `.github/workflows/deploy-pages.yml` в ветке `main`.
2. Добавьте secret `VITE_API_URL` в GitHub репозитории.
3. В `Settings -> Pages` выберите `GitHub Actions`.
4. После пуша в `main` фронтенд публикуется автоматически.

## VPS для backend и бота

Рекомендуемый стек:

- `Nginx` (TLS + reverse proxy),
- `systemd` сервисы для `uvicorn` и `python bot/bot.py`,
- `certbot` для HTTPS.

Минимум для старта: `1 vCPU / 1 GB RAM`.

## Переменные окружения

Все нужные переменные перечислены в `backend/.env.example`.

Критично заполнить:

- `BOT_TOKEN`,
- `OPENROUTER_API_KEY`,
- `SUPABASE_URL` и `SUPABASE_KEY`,
- `JWT_SECRET`,
- `FRONTEND_URL` (URL GitHub Pages),
- `APP_URL` (домен backend на VPS).

## База данных (Supabase)

Создайте таблицы:

- `users`,
- `resumes`,
- `payments`.

SQL-основа описана в проектной спецификации. Для `resumes.data` используйте `jsonb`.

## Важные ограничения MVP

- Основная модель: `deepseek/deepseek-v4-flash` (fallback `deepseek/deepseek-v3.2`).
- PDF формируется только через `WeasyPrint + Jinja2`.
- Авторизация только через проверку `Telegram initData`.
- Основной платежный канал: `Telegram Stars`.

