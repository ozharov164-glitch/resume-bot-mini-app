from typing import Optional

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
    OPENROUTER_MAX_TOKENS: int = 2500

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

    STARS_PRICE_SINGLE_PDF: int = 99
    STARS_PRICE_SUBSCRIPTION: int = 199

    # Telegram user IDs with free unlimited generate + PDF (comma-separated).
    FOUNDER_TELEGRAM_IDS: str = "7595981350"

    ADMIN_SECRET_KEY: str = "change-me-in-production"

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

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
