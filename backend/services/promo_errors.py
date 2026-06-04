"""Promo activation error helpers."""

from __future__ import annotations


def is_promo_activation_blocked_error(message: str) -> bool:
    lowered = (message or "").lower()
    return (
        "уже использовали этот промокод" in lowered
        or "уже активирован промокод" in lowered
        or "можно активировать через" in lowered
    )
