# ResumeBot — ревью кода и русской речи (2026-06-01)

**Ориентир:** Graphify (`graphify-out/GRAPH_REPORT.md`, commit `aa290789`)  
**Объём:** bot + backend + frontend Mini App  
**Действие:** исправлена русская речь в пользовательских текстах (единый тон «вы»)

---

## 1. Executive summary

| Оценка | Область |
|--------|---------|
| ✅ Хорошо | Чёткий продуктовый поток: шаблон → онбординг → SkillPick → preview → оплата → PDF в чат |
| ✅ Хорошо | Централизация копирайта бота (`bot_copy.py`, `marketing_copy.py`) и маркетинга фронта (`marketingCopy.ts`) |
| ✅ Хорошо | PDF-пайплайн: 3 шаблона, Nunito, preview PNG, WeasyPrint — параметризован |
| ✅ Хорошо | Платежи: Stars + ЮKassa webhook, idempotent `fulfill_paid_resume`, return-bridge |
| ⚠️ Средне | **Тон «ты/вы»** был смешан — **исправлено** в Mini App и части backend |
| ⚠️ Средне | `bot/bot.py` ~950 строк — admin, promo, payments, handlers в одном файле |
| ⚠️ Средне | `storage/backends.py` ~950 строк — SQLite + Supabase дублирование |
| ⚠️ Средне | 15+ `alert()` во фронте вместо in-app toast/dialog |
| ⚠️ Средне | Graphify stale: граф от `aa290789`, HEAD может быть новее — `graphify update .` |
| 🔴 Риск | systemd-сервисы под `root` на VPS |
| 🔴 Риск | Bot импортирует backend через `sys.path` — хрупко для тестов/пакетирования |

---

## 2. Архитектура (Graphify hubs)

**God nodes:** `SQLiteBackend`, `useAppStore`, `getTg()`, `InlineKeyboardMarkup`, `fulfill_paid_resume`.

**Ключевые сообщества:**

| Community | Содержание |
|-----------|------------|
| C9 | Admin panel в боте: promo, stats, refs |
| C1 | Frontend bootstrap + auth |
| C15 | AI service (OpenRouter, промпты) |
| C17 | PDF service + scripts |
| C18 | Payment hooks, pricing, History |
| C34 | ЮKassa payment return bridge |

**Surprising connections (проверены):** bot напрямую вызывает `get_db()`, `fulfill_paid_resume`, promo — осознанное решение для polling-бота на VPS.

---

## 3. Пользовательский поток Mini App

```
Home → TemplatePick → Onboarding (динам.) → SkillPick → Loading
  → Preview (PNG) → TemplateSelect → Payment → Success
```

**Страницы:** `store.ts` — client-side routing без React Router.  
**Deep links:** `#history`, `#examples`, `#payment-return`.

---

## 4. Ревью русской речи

### 4.1. Проблема до правок

- Бот и `marketingCopy.ts` — **вы** (формально, уважительно).
- Mini App (онбординг, оплата, success, alerts) — **ты** (неформально).
- Орфография: «Создаем» без «ё», «Твое» вместо «Твоё», «еще» вместо «ещё».
- API: «Напиши боту», «скачай из превью» — разговорный стиль.

### 4.2. Принятое решение

**Единый тон: «вы»** — соответствует hh.ru-аудитории (соискатели 25–55), боту и маркетинговым текстам.

### 4.3. Исправленные файлы (2026-06-01)

| Файл | Примеры правок |
|------|----------------|
| `frontend/src/lib/onboardingSteps.ts` | «Укажите пол», «Где вы работали?», «Введите имя…» |
| `frontend/src/pages/Loading.tsx` | «Создаём ваше идеальное резюме…» |
| `frontend/src/pages/Success.tsx` | «Ваше резюме готово», «в ваш чат» |
| `frontend/src/pages/SkillPick.tsx` | «Выберите навыки», «Отметьте те, что у вас есть» |
| `frontend/src/pages/TemplatePick.tsx` | «Выберите дизайн», «ваше резюме» |
| `frontend/src/pages/TemplateSelect.tsx` | «Подтвердите шаблон» |
| `frontend/src/pages/Onboarding.tsx` | alerts на «вы» |
| `frontend/src/pages/Payment.tsx` | «Выберите способ оплаты», «нажмите», «вернитесь» |
| `frontend/src/pages/History.tsx` | alerts на «вы» |
| `frontend/src/components/ui/VoiceTextArea.tsx` | alerts на «вы» |
| `backend/services/founder_contact.py` | «Нажмите на ссылку» |
| `backend/services/payment_fulfillment.py` | «Ваш друг оплатил…» |
| `backend/routers/resume.py` | «Напишите боту», «ещё» |
| `backend/routers/payment.py` | «скачайте из предпросмотра» |
| `backend/routers/payment_return.py` | «нажмите кнопку» |
| `bot/bot.py` | post-payment: «Нажмите кнопку ниже» |

### 4.4. Уже корректно (не трогали)

- `backend/services/bot_copy.py` — последовательный «вы»
- `frontend/src/lib/marketingCopy.ts` — «вы»
- `frontend/src/components/preview/PreviewStatusHero.tsx` — «Проверьте текст…»
- `frontend/src/lib/bootstrap.ts`, `App.tsx` — «вы»
- PDF-примеры в `resumeExamples.json` — от первого лица кандидата (это контент резюме, не UI)

### 4.5. Не исправляли (архив / не prod)

- `docs/stitch-handoff/screens/*.html` — старые макеты Stitch

---

## 5. Ревью кода по слоям

### 5.1. Frontend

**Сильные стороны:**
- Zustand store — простой и предсказуемый
- Motion для micro-UX (Loading, SkillPick)
- Locked light theme + semantic tokens
- Template pick с PNG-превью

**Замечания:**
1. **`alert()`** — заменить на inline error/toast (Telegram Haptic + banner).
2. **Нет ESLint/Prettier/tests** — добавить хотя бы `eslint` + smoke test store.
3. **Дублирование цен** — `pricing.ts` и backend config; промо-скидка только на клиенте до validate — OK, но Stars округление документировать.
4. **`HttpTimeoutError`** в Onboarding — хорошо; остальные страницы без typed errors.

### 5.2. Backend

**Сильные стороны:**
- JWT auth через Telegram initData
- AI: structured JSON + post-process + gender rules
- Promo/referral schema в storage
- Admin notify в Telegram-группу

**Замечания:**
1. **Смешанный язык API errors** — admin/webhook paths на English (`Forbidden`, `YooKassa is not configured`) — OK для dev, но унифицировать если попадут в UI.
2. **`@app.on_event("startup")`** — deprecated, перейти на lifespan.
3. **`backends.py`** — кандидат на split: users, resumes, promo, referrals.
4. **Founder check** дублируется frontend hint + server enforcement — правильно, но IDs захардкожены в `founder.ts`.

### 5.3. Bot

**Сильные стороны:**
- `bot_copy.py` — single source of truth
- Команды BotFather, admin panel для promo
- Кэш stats count

**Замечания:**
1. **Monolith `bot.py`** — вынести admin handlers в `bot/admin_handlers.py`.
2. **Inline copy** в admin callbacks — часть текстов не в `bot_copy.py`.
3. **`sys.path` hack** — долгосрочно HTTP client к local API или shared package.

---

## 6. Безопасность и DX

| Тема | Статус |
|------|--------|
| Секреты в git | ✅ `.env` gitignored |
| JWT | ✅ verify initData |
| Promo brute-force | ⚠️ нет rate limit на `/api/promo/validate` |
| Admin routes | ✅ founder check |
| CI frontend | ✅ GitHub Actions Pages |
| Backend tests | ⚠️ 6 модулей, нет e2e resume/payment |
| Graphify | ⚠️ обновить после больших PR |

---

## 7. Приоритетный бэклог (после речи)

| P | Задача | Сложность |
|---|--------|-----------|
| P1 | Заменить `alert()` на UI-компонент ошибок | M |
| P1 | Split `bot.py` admin → модуль | S |
| P2 | `graphify update .` + закрепить в README | S |
| P2 | Rate limit promo validate | S |
| P2 | Lifespan в FastAPI | S |
| P3 | ESLint + typecheck в CI frontend | M |
| P3 | systemd User=non-root | M |

---

## 8. Карта файлов с русским UI (для поддержки)

```
bot/bot.py                          — inline admin + payment success
backend/services/bot_copy.py        — главный копирайт бота
backend/services/founder_contact.py — support hub
backend/services/marketing_copy.py  — sync с frontend
frontend/src/lib/marketingCopy.ts
frontend/src/lib/onboardingSteps.ts — вопросы опросника
frontend/src/pages/*.tsx            — экраны
frontend/src/lib/templates.ts       — описания шаблонов
backend/templates/resume_*.html     — секции PDF
backend/routers/*.py                — detail= сообщения API
```

---

*Ревью выполнено с опорой на Graphify graph report и полный обход user-facing strings. Русская речь унифицирована на «вы» в production-коде.*
