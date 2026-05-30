"""Telegram admin group notifications (new users, payments)."""

from __future__ import annotations

import html
import logging
from dataclasses import dataclass
from typing import Any

from telegram import Bot

from config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PaymentNotifyInfo:
    provider: str
    amount: str
    currency: str
    resume_id: str
    telegram_id: int
    username: str = ""
    first_name: str = ""


def parse_admin_group_chat_id(raw: str | None) -> int | None:
    """Normalize group id: positive id from Telegram → negative chat_id."""
    if not raw or not str(raw).strip():
        return None
    try:
        chat_id = int(str(raw).strip())
    except ValueError:
        return None
    return chat_id if chat_id < 0 else -chat_id


def admin_group_chat_id() -> int | None:
    return parse_admin_group_chat_id(getattr(settings, "ADMIN_GROUP_CHAT_ID", None))


async def send_admin_message(text: str, *, parse_mode: str = "HTML") -> bool:
    chat_id = admin_group_chat_id()
    if not chat_id:
        logger.debug("admin notify skipped: ADMIN_GROUP_CHAT_ID not set")
        return False
    try:
        bot = Bot(token=settings.BOT_TOKEN)
        await bot.send_message(chat_id=chat_id, text=text, parse_mode=parse_mode)
        return True
    except Exception:
        logger.exception("admin notify failed chat_id=%s", chat_id)
        return False


def _user_line(telegram_id: int, first_name: str = "", username: str = "") -> str:
    name = html.escape((first_name or "Без имени").strip() or "Без имени")
    if username:
        handle = html.escape(f"@{username.lstrip('@')}")
        return f"{name} ({handle}, id <code>{telegram_id}</code>)"
    return f"{name} (id <code>{telegram_id}</code>)"


async def notify_new_user(db: Any, *, telegram_id: int, first_name: str = "", username: str = "") -> None:
    try:
        total = db.count_users()
    except Exception:
        logger.exception("count_users failed")
        total = "?"
    text = (
        "👤 <b>Новый пользователь</b>\n\n"
        f"{_user_line(telegram_id, first_name, username)}\n\n"
        f"📊 Всего пользователей: <b>{total}</b>"
    )
    await send_admin_message(text)


async def notify_payment(
    db: Any,
    info: PaymentNotifyInfo,
    *,
    first_payment: bool,
) -> None:
    if not first_payment:
        return
    try:
        paid_total = db.count_paid_resumes()
    except Exception:
        logger.exception("count_paid_resumes failed")
        paid_total = "?"

    provider_labels = {
        "telegram_stars": "Telegram Stars",
        "stars": "Telegram Stars",
        "yookassa": "ЮKassa",
    }
    provider_label = provider_labels.get(info.provider.lower(), info.provider)
    amount_display = f"{info.amount} {info.currency}".strip()

    text = (
        "💰 <b>Оплата получена</b>\n\n"
        f"Способ: {html.escape(provider_label)}\n"
        f"Сумма: <b>{html.escape(amount_display)}</b>\n"
        f"Пользователь: {_user_line(info.telegram_id, info.first_name, info.username)}\n"
        f"Резюме: <code>{html.escape(info.resume_id)}</code>\n\n"
        f"📈 Всего оплаченных резюме: <b>{paid_total}</b>"
    )
    await send_admin_message(text)
