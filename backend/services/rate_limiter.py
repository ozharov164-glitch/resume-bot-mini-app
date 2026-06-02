"""In-memory per-telegram_id rate limits, reset at midnight MSK (UTC+3)."""

from __future__ import annotations

import logging
import math
from collections import defaultdict
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from services.founder import is_founder

logger = logging.getLogger(__name__)

MSK = ZoneInfo("Europe/Moscow")

# endpoint_key -> (max_requests, window_description for logs)
LIMITS: dict[str, tuple[int, str]] = {
    "resume_generate": (3, "24h"),
    "skills_suggest": (10, "24h"),
    "voice_transcribe": (5, "24h"),
    "voice_polish": (30, "24h"),
    "enrich_suggest": (120, "24h"),
    "analytics_event": (200, "24h"),
}

_counters: dict[str, dict[str, int]] = defaultdict(dict)
_window_day: str | None = None


def _msk_day_key() -> str:
    return datetime.now(MSK).strftime("%Y-%m-%d")


def _ensure_window() -> None:
    global _window_day
    day = _msk_day_key()
    if _window_day != day:
        _counters.clear()
        _window_day = day
        logger.info("rate_limit window reset msk_day=%s", day)


def retry_after_hours() -> int:
    now = datetime.now(MSK)
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    seconds = max(1.0, (tomorrow - now).total_seconds())
    return max(1, math.ceil(seconds / 3600))


def check_rate_limit(endpoint_key: str, identity: int | str | None) -> None:
    """Raise RateLimitExceeded if limit exceeded. identity: telegram_id or client key."""
    if identity is None:
        return
    if endpoint_key in {"resume_generate", "skills_suggest", "voice_transcribe", "voice_polish", "analytics_event"}:
        try:
            if is_founder(int(identity)):
                return
        except (TypeError, ValueError):
            pass

    limit_cfg = LIMITS.get(endpoint_key)
    if not limit_cfg:
        return

    max_requests, _ = limit_cfg
    bucket_key = str(identity)
    _ensure_window()

    bucket = _counters[endpoint_key]
    count = bucket.get(bucket_key, 0) + 1
    bucket[bucket_key] = count

    if count > max_requests:
        hours = retry_after_hours()
        logger.info(
            "rate_limit exceeded endpoint=%s identity=%s count=%s max=%s",
            endpoint_key,
            bucket_key,
            count,
            max_requests,
        )
        raise RateLimitExceeded(hours)


class RateLimitExceeded(Exception):
    def __init__(self, retry_after_hours: int) -> None:
        self.retry_after_hours = retry_after_hours
        super().__init__("rate_limit")
