"""Telegram admin group notifications (new users, payments)."""

from __future__ import annotations

import html
import logging
from dataclasses import dataclass
from typing import Any

from telegram import Bot

from config import settings
from services.admin_stats import count_paid_resumes_clean, count_users_clean

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
    external_id: str = ""


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
        from services.telegram_bot import get_bot
        await get_bot().send_message(chat_id=chat_id, text=text, parse_mode=parse_mode)
        return True
    except Exception as exc:
        logger.error("admin notify failed chat_id=%s: %s", chat_id, exc)
        return False


def _user_line(telegram_id: int, first_name: str = "", username: str = "") -> str:
    name = html.escape((first_name or "Без имени").strip() or "Без имени")
    if username:
        handle = html.escape(f"@{username.lstrip('@')}")
        return f"{name} ({handle}, id <code>{telegram_id}</code>)"
    return f"{name} (id <code>{telegram_id}</code>)"


async def notify_new_user(db: Any, *, telegram_id: int, first_name: str = "", username: str = "") -> bool:
    try:
        total = count_users_clean(db)
    except Exception:
        logger.exception("count_users failed")
        total = "?"
    text = (
        "👤 <b>Новый пользователь</b>\n\n"
        f"{_user_line(telegram_id, first_name, username)}\n\n"
        f"📊 Всего пользователей: <b>{total}</b>"
    )
    return await send_admin_message(text)


async def notify_promo_activation(
    db: Any,
    *,
    promo_code: str,
    discount_percent: int,
    telegram_id: int,
    first_name: str = "",
    username: str = "",
    owner_tg_id: int | None = None,
) -> bool:
    owner_line = f"Траффер: <code>{owner_tg_id}</code>" if owner_tg_id else "Траффер: не указан"
    text = (
        "🎟 <b>Промокод активирован</b>\n\n"
        f"Код: <code>{html.escape(promo_code)}</code> (−{discount_percent}%)\n"
        f"Пользователь: {_user_line(telegram_id, first_name, username)}\n"
        f"{owner_line}"
    )
    return await send_admin_message(text)


async def notify_payment(
    db: Any,
    info: PaymentNotifyInfo,
    *,
    first_payment: bool,
) -> None:
    if not first_payment:
        return
    try:
        paid_total = count_paid_resumes_clean(db)
    except Exception:
        logger.exception("count_paid_resumes failed")
        paid_total = "?"

    resume = db.find_resume(info.resume_id)
    promo_code = (resume or {}).get("promo_code")
    discount = (resume or {}).get("discount_applied")

    provider_labels = {
        "telegram_stars": "Telegram Stars",
        "stars": "Telegram Stars",
        "yookassa": "ЮKassa",
    }
    provider_label = provider_labels.get(info.provider.lower(), info.provider)
    currency = (info.currency or "").strip().upper()
    if currency == "RUB":
        amount_display = f"{info.amount} ₽"
    elif currency == "XTR":
        amount_display = f"{info.amount} ⭐"
    else:
        amount_display = f"{info.amount} {info.currency}".strip()

    lines = [
        "💰 <b>Оплата получена</b>",
        "",
        f"Способ: {html.escape(provider_label)}",
        f"Сумма: <b>{html.escape(amount_display)}</b>",
        f"Пользователь: {_user_line(info.telegram_id, info.first_name, info.username)}",
        f"Резюме: <code>{html.escape(info.resume_id)}</code>",
    ]
    if info.external_id:
        lines.append(f"Платёж: <code>{html.escape(info.external_id)}</code>")
    if promo_code:
        promo_line = f"Промокод: <code>{html.escape(str(promo_code))}</code>"
        if discount:
            promo_line += f" (−{discount}%)"
        lines.append(promo_line)
    lines.extend(["", f"📈 Всего оплаченных резюме: <b>{paid_total}</b>"])
    text = "\n".join(lines)
    await send_admin_message(text)
