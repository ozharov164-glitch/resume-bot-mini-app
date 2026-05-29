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
    OPENROUTER_MAX_TOKENS: int = 1600

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

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
