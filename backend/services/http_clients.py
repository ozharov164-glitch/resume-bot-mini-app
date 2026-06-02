"""Shared httpx.AsyncClient instances (connection pooling, fewer TLS handshakes)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from config import settings

logger = logging.getLogger(__name__)

_api_client: httpx.AsyncClient | None = None
_groq_client: httpx.AsyncClient | None = None


def _client_limits() -> httpx.Limits:
    return httpx.Limits(max_connections=40, max_keepalive_connections=20, keepalive_expiry=30.0)


async def get_api_client(*, timeout: float = 90.0) -> httpx.AsyncClient:
    """OpenRouter, DaData, and other API calls without a dedicated proxy."""
    global _api_client
    if _api_client is None or _api_client.is_closed:
        _api_client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout, connect=10.0),
            limits=_client_limits(),
            follow_redirects=True,
        )
    return _api_client


async def get_groq_client(*, timeout: float = 60.0) -> httpx.AsyncClient:
    """Groq — optional HTTP proxy from settings."""
    global _groq_client
    if _groq_client is None or _groq_client.is_closed:
        proxy: Any = settings.GROQ_PROXY_URL.strip() or None
        _groq_client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout, connect=10.0),
            limits=_client_limits(),
            proxy=proxy,
            follow_redirects=True,
        )
    return _groq_client


async def close_http_clients() -> None:
    global _api_client, _groq_client
    for name, client in (("api", _api_client), ("groq", _groq_client)):
        if client is not None and not client.is_closed:
            try:
                await client.aclose()
            except Exception:
                logger.exception("failed to close %s http client", name)
    _api_client = None
    _groq_client = None
