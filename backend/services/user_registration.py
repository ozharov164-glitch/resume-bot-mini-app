"""Register Telegram users and notify admin on first seen."""

from __future__ import annotations

import logging
from typing import Any

from services.admin_notify import notify_new_user

logger = logging.getLogger(__name__)


def ensure_user_row(
    db: Any,
    *,
    telegram_id: int,
    first_name: str = "",
    last_name: str = "",
    username: str = "",
) -> bool:
    """Create DB user if missing. Returns True when a new row was created."""
    if db.find_user_by_telegram_id(telegram_id):
        return False
    db.create_user(
        telegram_id=telegram_id,
        first_name=first_name,
        last_name=last_name,
        username=username,
    )
    return True


async def register_telegram_user(
    db: Any,
    *,
    telegram_id: int,
    first_name: str = "",
    last_name: str = "",
    username: str = "",
) -> bool:
    """Ensure user exists; send admin alert on first registration. Returns True if new."""
    created = ensure_user_row(
        db,
        telegram_id=telegram_id,
        first_name=first_name,
        last_name=last_name,
        username=username,
    )
    if not created:
        return False
    try:
        sent = await notify_new_user(
            db,
            telegram_id=telegram_id,
            first_name=first_name,
            username=username,
        )
        if sent is False:
            logger.warning(
                "admin new-user notify not delivered telegram_id=%s (check ADMIN_GROUP_CHAT_ID / bot in group)",
                telegram_id,
            )
        else:
            logger.info("admin new-user notify sent telegram_id=%s", telegram_id)
    except Exception:
        logger.exception("admin new-user notify failed telegram_id=%s", telegram_id)
    return True
