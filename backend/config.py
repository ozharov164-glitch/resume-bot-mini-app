from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    BOT_TOKEN: str
    BOT_USERNAME: str

    OPENROUTER_API_KEY: str
    OPENROUTER_APP_URL: str = "https://yourdomain.ru"
    OPENROUTER_MODEL: str = "deepseek/deepseek-v4-flash"
    OPENROUTER_MODEL_FALLBACK: str = "deepseek/deepseek-v3.2"
    # Fastest providers for v4-flash (OpenRouter latency p50, auto-updated via deploy script).
    OPENROUTER_PROVIDER_ONLY: str = "parasail,alibaba,deepseek,morph"
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

    # Local SQLite when Supabase key is invalid or missing.
    SQLITE_PATH: str = "data/resumebot.db"

    # Groq STT: comma-separated keys, first is primary; auto-fallback on 401/429/5xx.
    GROQ_API_KEYS: str = ""
    GROQ_STT_MODEL: str = "whisper-large-v3-turbo"
    GROQ_PUNCTUATE_MODEL: str = "llama-3.1-8b-instant"
    # HTTP proxy for Groq API, e.g. http://user:pass@host:port
    GROQ_PROXY_URL: str = ""

    DADATA_API_KEY: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
