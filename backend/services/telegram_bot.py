"""Singleton Telegram Bot instance — reuse one Bot across the entire process."""

from __future__ import annotations

from telegram import Bot

from config import settings

_bot: Bot | None = None


def get_bot() -> Bot:
    """Return the shared Bot instance (created once, reused everywhere)."""
    global _bot
    if _bot is None:
        _bot = Bot(token=settings.BOT_TOKEN)
    return _bot
