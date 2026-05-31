"""Promo code activation, pricing, and attribution."""

from __future__ import annotations

from typing import Any

from config import settings

RUB_PRICE_SINGLE_PDF = settings.RUB_PRICE_SINGLE_PDF


def apply_discount(price: int, discount_percent: int) -> int:
    if discount_percent <= 0:
        return price
    return max(1, round(price * (1 - discount_percent / 100)))


def discounted_prices(discount_percent: int) -> tuple[int, str]:
    stars = apply_discount(settings.STARS_PRICE_SINGLE_PDF, discount_percent)
    rub_int = apply_discount(RUB_PRICE_SINGLE_PDF, discount_percent)
    return stars, f"{rub_int:.2f}"


def resolve_payment_promo(db: Any, telegram_id: int) -> tuple[str | None, int, dict | None]:
    promo = db.get_user_active_promo(telegram_id)
    if not promo:
        return None, 0, None
    code = str(promo.get("code") or "").strip().upper() or None
    discount = int(promo.get("discount_percent") or 0)
    return code, discount, promo


def activate_promo(db: Any, code: str, user_tg_id: int) -> dict:
    return db.activate_promo_for_user(code.strip(), user_tg_id)
