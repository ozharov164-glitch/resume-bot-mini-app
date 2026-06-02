"""Optional Redis for distributed rate limits."""

from __future__ import annotations

import logging
from typing import Any

from config import settings

logger = logging.getLogger(__name__)

_redis: Any = None
_redis_checked = False


def redis_available() -> bool:
    global _redis, _redis_checked
    if _redis_checked:
        return _redis is not None
    _redis_checked = True
    url = (settings.REDIS_URL or "").strip()
    if not url:
        return False
    try:
        import redis.asyncio as aioredis  # type: ignore[import-untyped]
    except ImportError:
        logger.warning("REDIS_URL set but redis package not installed — using in-memory limits")
        return False
    try:
        client = aioredis.from_url(url, decode_responses=True, socket_connect_timeout=2.0)
        _redis = client
        return True
    except Exception:
        logger.exception("redis connection failed url=%s", url.split("@")[-1][:80])
        _redis = None
        return False


def get_redis() -> Any:
    if redis_available():
        return _redis
    return None


async def close_redis() -> None:
    global _redis, _redis_checked
    if _redis is not None:
        try:
            await _redis.aclose()
        except Exception:
            logger.exception("redis close failed")
    _redis = None
    _redis_checked = False


async def ping_redis() -> bool:
    client = get_redis()
    if client is None:
        return False
    try:
        return bool(await client.ping())
    except Exception:
        return False
