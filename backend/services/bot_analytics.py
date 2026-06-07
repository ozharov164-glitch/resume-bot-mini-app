"""Bot-side analytics events (no JWT — written directly to storage)."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


def track_bot_start(db: Any, telegram_id: int) -> None:
    """Record /start or «В меню» — unique users counted in admin funnel."""
    if not telegram_id:
        return
    try:
        db.insert_analytics_event(
            {
                "id": str(uuid.uuid4()),
                "event": "bot_start",
                "telegram_id": int(telegram_id),
                "step": None,
                "metadata": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    except Exception:
        logger.debug("bot_start analytics failed telegram_id=%s", telegram_id, exc_info=True)
