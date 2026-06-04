from typing import Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    BOT_TOKEN: str
    BOT_USERNAME: str

    OPENROUTER_API_KEY: str
    OPENROUTER_APP_URL: str = "https://yourdomain.ru"
    # Non-reasoning instruct model: следует инструкциям (род, навыки по профессии),
    # не сжигает бюджет токенов на скрытые рассуждения. НЕ использовать reasoning-модели
    # (v4-flash у провайдера Parasail отдаёт пустой content — съедает лимит на reasoning).
    OPENROUTER_MODEL: str = "deepseek/deepseek-chat-v3.1"
    OPENROUTER_MODEL_FALLBACK: str = "deepseek/deepseek-v3.2"
    # Пусто = OpenRouter сам выбирает рабочего провайдера. Жёсткий whitelist опасен:
    # некоторые провайдеры запускают модель в reasoning-режиме и возвращают пустой ответ.
    OPENROUTER_PROVIDER_ONLY: str = ""
    # Достаточно для полноценного резюме; меньше 2000 — без лишнего запаса.
    OPENROUTER_MAX_TOKENS: int = 1800

    SUPABASE_URL: str
    SUPABASE_KEY: str

    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24

    APP_URL: str
    FRONTEND_URL: str
    DEBUG: bool = False

    YOKASSA_SHOP_ID: Optional[str] = None
    YOKASSA_SECRET_KEY: Optional[str] = None
    YOKASSA_RETURN_URL: Optional[str] = None

    STARS_PRICE_SINGLE_PDF: int = 149
    RUB_PRICE_SINGLE_PDF: int = 149
    STARS_PRICE_ADAPT: int = 99
    RUB_PRICE_ADAPT: int = 99

    # Telegram user IDs with free unlimited generate + PDF (comma-separated).
    FOUNDER_TELEGRAM_IDS: str = "7595981350"

    ADMIN_SECRET_KEY: str = "change-me-in-production"

    # Telegram setWebhook secret_token → header X-Telegram-Bot-Api-Secret-Token
    TELEGRAM_WEBHOOK_SECRET: str = ""

    # Reject Mini App initData older than this (seconds); mitigates replay.
    INIT_DATA_MAX_AGE_SECONDS: int = 86_400

    # Days before the same user may activate a different promo code (same code never again).
    PROMO_REACTIVATION_COOLDOWN_DAYS: int = 30

    # Supergroup for admin alerts (bare id 100… or full -100…).
    ADMIN_GROUP_CHAT_ID: str = "1003959501619"

    # Founder contact in bot (optional @username; auto-resolved via Bot API if empty).
    FOUNDER_TELEGRAM_USERNAME: str = ""
    FOUNDER_DISPLAY_NAME: str = "Дмитрию"
    FOUNDER_RESPONSE_TIME: str = "в течение 1–2 часов"

    # Local SQLite when Supabase key is invalid or missing.
    SQLITE_PATH: str = "data/resumebot.db"

    # Groq STT: comma-separated keys, first is primary; auto-fallback on 401/429/5xx.
    GROQ_API_KEYS: str = ""
    GROQ_STT_MODEL: str = "whisper-large-v3-turbo"
    GROQ_PUNCTUATE_MODEL: str = "llama-3.1-8b-instant"
    GROQ_POLISH_MODEL: str = "llama-3.3-70b-versatile"
    # HTTP proxy for Groq API, e.g. http://user:pass@host:port
    GROQ_PROXY_URL: str = ""

    DADATA_API_KEY: str = ""

    # Optional Redis (rate limits across uvicorn workers). Empty = in-process memory only.
    REDIS_URL: str = ""

    PDF_MAX_CONCURRENT: int = 2
    PDF_QUEUE_ENABLED: bool = True
    PDF_QUEUE_MAX_PENDING: int = 32

    # Log/metrics thresholds
    SLOW_REQUEST_MS: int = 3000

    @model_validator(mode="after")
    def single_pdf_prices_match(self) -> "Settings":
        if self.STARS_PRICE_SINGLE_PDF != self.RUB_PRICE_SINGLE_PDF:
            self.STARS_PRICE_SINGLE_PDF = self.RUB_PRICE_SINGLE_PDF
        return self

    @model_validator(mode="after")
    def production_secrets(self) -> "Settings":
        if self.DEBUG:
            return self
        if self.ADMIN_SECRET_KEY.strip() in {"", "change-me-in-production"}:
            raise ValueError("Set a strong ADMIN_SECRET_KEY in production (DEBUG=false).")
        if len(self.JWT_SECRET.strip()) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters when DEBUG=false.")
        return self

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
