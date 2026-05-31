"""YooKassa return bridge: browser → Telegram → Mini App with resume id."""

from __future__ import annotations

from urllib.parse import quote

from config import settings


def mini_app_payment_url(resume_id: str) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    q = quote(resume_id, safe="")
    return f"{base}/#payment-return?resume_id={q}"


def telegram_payment_start_link(resume_id: str) -> str:
    """Opens bot chat; /start handler shows WebApp button with payment-return hash."""
    username = settings.BOT_USERNAME.lstrip("@")
    return f"https://t.me/{username}?start=pay_{resume_id}"


def telegram_payment_tg_protocol(resume_id: str) -> str:
    username = settings.BOT_USERNAME.lstrip("@")
    return f"tg://resolve?domain={username}&start=pay_{resume_id}"


def yookassa_return_url(resume_id: str) -> str:
    """Intermediate page on our API (not GitHub Pages) — redirects into Telegram."""
    q = quote(resume_id, safe="")
    base = settings.APP_URL.rstrip("/")
    return f"{base}/payment/return?resume_id={q}"
