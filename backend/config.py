from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    BOT_TOKEN: str
    BOT_USERNAME: str

    OPENROUTER_API_KEY: str
    OPENROUTER_APP_URL: str = "https://yourdomain.ru"

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
