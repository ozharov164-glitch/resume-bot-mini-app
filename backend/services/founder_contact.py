"""Support hub copy and founder DM link for the Telegram bot."""

from __future__ import annotations

import html
import logging
from typing import TYPE_CHECKING
from urllib.parse import quote

from config import settings
from services.bot_copy import PAYMENT_SHORT, partner_apply_prefill
from services.founder import founder_telegram_ids

if TYPE_CHECKING:
    from telegram import Bot

logger = logging.getLogger(__name__)

_founder_username_cache: str | None = None


def founder_display_name() -> str:
    name = (getattr(settings, "FOUNDER_DISPLAY_NAME", None) or "").strip()
    return name or "основателю"


def founder_username() -> str:
    """Public @username without @, from env or runtime cache."""
    global _founder_username_cache
    if _founder_username_cache:
        return _founder_username_cache
    raw = (getattr(settings, "FOUNDER_TELEGRAM_USERNAME", None) or "").strip().lstrip("@")
    return raw


async def ensure_founder_username(bot: Bot) -> str:
    """Resolve founder @username via Bot API if not configured in env."""
    global _founder_username_cache
    configured = founder_username()
    if configured:
        _founder_username_cache = configured
        return configured
    if _founder_username_cache:
        return _founder_username_cache
    ids = founder_telegram_ids()
    if not ids:
        return ""
    try:
        chat = await bot.get_chat(next(iter(ids)))
        if chat.username:
            _founder_username_cache = chat.username
            logger.info("founder contact: resolved @%s from Bot API", chat.username)
    except Exception as exc:
        logger.warning("founder contact: get_chat failed: %s", exc)
    return _founder_username_cache or ""


def founder_dm_url(username: str) -> str | None:
    if username:
        return f"https://t.me/{username.lstrip('@')}"
    return None


def partner_apply_dm_url(
    username: str,
    *,
    telegram_id: int,
    user_username: str | None = None,
    first_name: str | None = None,
) -> str | None:
    """Deep link to founder DM with a pre-filled partner application."""
    base = founder_dm_url(username)
    if not base:
        return None
    prefill = partner_apply_prefill(
        telegram_id=telegram_id,
        username=user_username,
        first_name=first_name,
    )
    return f"{base}?text={quote(prefill)}"


def support_hub_text(*, greeting: str | None = None) -> str:
    who = html.escape(founder_display_name())
    hello = f"{html.escape(greeting)}, " if greeting else ""
    return (
        f"💬 <b>Поддержка ResumeBot</b>\n\n"
        f"{hello}я на связи лично — без ботов и очередей.\n\n"
        f"<b>Частые вопросы</b>\n"
        "• <b>PDF или DOCX не пришли</b> — подождите 1–2 минуты, затем нажмите /start\n"
        "• <b>Изменить резюме</b> — «Мои резюме» → «Изменить ответы»\n"
        f"• <b>Ошибка оплаты</b> — повторите попытку: {PAYMENT_SHORT}\n\n"
        f"<b>Не нашли ответ?</b> Напишите {who} — обычно отвечаю "
        f"<b>{html.escape(response_time_label())}</b>.\n\n"
        "↩️ Если оплата не сработала — <b>вернём Stars</b>. "
        "Опишите ситуацию в личном сообщении."
    )


def response_time_label() -> str:
    raw = (getattr(settings, "FOUNDER_RESPONSE_TIME", None) or "").strip()
    return raw or "в течение 1–2 часов"


def founder_chat_hint_text(username: str) -> str:
    who = html.escape(founder_display_name())
    uname = html.escape(username.lstrip("@"))
    return (
        f"✉️ <b>Личное сообщение {who}</b>\n\n"
        f"Нажмите на ссылку — откроется чат в Telegram:\n"
        f'<a href="https://t.me/{uname}">@{uname}</a>\n\n'
        "В первом сообщении кратко опишите ситуацию — так я быстрее помогу."
    )
