"""Per-identity rate limits (MSK midnight reset). Redis when REDIS_URL is set, else in-memory."""

from __future__ import annotations

import logging
import math
from collections import defaultdict
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from services.founder import is_founder
from services.redis_client import get_redis

logger = logging.getLogger(__name__)

MSK = ZoneInfo("Europe/Moscow")

LIMITS: dict[str, tuple[int, str]] = {
    "resume_generate": (3, "24h"),
    "skills_suggest": (10, "24h"),
    "voice_transcribe": (5, "24h"),
    "voice_polish": (30, "24h"),
    "enrich_suggest": (120, "24h"),
    "analytics_event": (200, "24h"),
    "auth_telegram": (20, "24h"),
}

_COUNTERS: dict[str, dict[str, int]] = defaultdict(dict)
_window_day: str | None = None

_FOUNDER_ENDPOINTS = frozenset(
    {
        "resume_generate",
        "skills_suggest",
        "voice_transcribe",
        "voice_polish",
        "analytics_event",
    }
)


def _msk_day_key() -> str:
    return datetime.now(MSK).strftime("%Y-%m-%d")


def _ttl_until_msk_midnight_sec() -> int:
    now = datetime.now(MSK)
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return max(60, int((tomorrow - now).total_seconds()) + 60)


def _ensure_window() -> None:
    global _window_day
    day = _msk_day_key()
    if _window_day != day:
        _COUNTERS.clear()
        _window_day = day
        logger.info("rate_limit window reset msk_day=%s", day)


def retry_after_hours() -> int:
    now = datetime.now(MSK)
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    seconds = max(1.0, (tomorrow - now).total_seconds())
    return max(1, math.ceil(seconds / 3600))


def _redis_key(endpoint_key: str, bucket_key: str) -> str:
    return f"rl:{endpoint_key}:{bucket_key}:{_msk_day_key()}"


async def _check_redis(endpoint_key: str, bucket_key: str, max_requests: int) -> bool | None:
    """True if exceeded, False if ok, None if Redis unavailable (use memory fallback)."""
    client = get_redis()
    if client is None:
        return None
    key = _redis_key(endpoint_key, bucket_key)
    try:
        count = await client.incr(key)
        if count == 1:
            await client.expire(key, _ttl_until_msk_midnight_sec())
        return count > max_requests
    except Exception:
        logger.exception("redis rate_limit failed endpoint=%s", endpoint_key)
        return None


def _check_memory(endpoint_key: str, bucket_key: str, max_requests: int) -> bool:
    _ensure_window()
    bucket = _COUNTERS[endpoint_key]
    count = bucket.get(bucket_key, 0) + 1
    bucket[bucket_key] = count
    return count > max_requests


async def check_rate_limit(endpoint_key: str, identity: int | str | None) -> None:
    if identity is None:
        return
    if endpoint_key in _FOUNDER_ENDPOINTS:
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

    backend = "redis"
    exceeded = await _check_redis(endpoint_key, bucket_key, max_requests)
    if exceeded is None:
        backend = "memory"
        exceeded = _check_memory(endpoint_key, bucket_key, max_requests)

    if exceeded:
        hours = retry_after_hours()
        logger.info(
            "rate_limit exceeded endpoint=%s identity=%s max=%s backend=%s",
            endpoint_key,
            bucket_key,
            max_requests,
            backend,
        )
        raise RateLimitExceeded(hours)


class RateLimitExceeded(Exception):
    def __init__(self, retry_after_hours: int) -> None:
        self.retry_after_hours = retry_after_hours
        super().__init__("rate_limit")
