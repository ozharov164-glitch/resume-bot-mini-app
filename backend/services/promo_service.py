"""Promo code activation, pricing, and attribution."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
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


def _parse_activation_ts(raw: str) -> datetime:
    text = (raw or "").strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    dt = datetime.fromisoformat(text)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _cooldown_remaining_days(last_activation_at: str) -> int:
    cooldown = timedelta(days=settings.PROMO_REACTIVATION_COOLDOWN_DAYS)
    last_dt = _parse_activation_ts(last_activation_at)
    now = datetime.now(timezone.utc)
    elapsed = now - last_dt
    if elapsed >= cooldown:
        return 0
    remaining = cooldown - elapsed
    days = remaining.days + (1 if remaining.seconds else 0)
    return max(1, days)


def assert_promo_activation_allowed(db: Any, user_tg_id: int, upper_code: str) -> None:
    """Same promo code — once per lifetime; another code — after cooldown."""
    if db.user_has_promo_code_activation(user_tg_id, upper_code):
        raise ValueError(
            "Вы уже использовали этот промокод. Повторная активация недоступна."
        )

    last_at = db.get_last_promo_activation_at(user_tg_id)
    if not last_at:
        return

    days_left = _cooldown_remaining_days(last_at)
    if days_left > 0:
        raise ValueError(
            f"Новый промокод можно активировать через {days_left} дн. "
            f"(между активациями — {settings.PROMO_REACTIVATION_COOLDOWN_DAYS} дн.)."
        )


def activate_promo(db: Any, code: str, user_tg_id: int) -> dict:
    promo = db.validate_promo_code(code.strip(), user_tg_id)
    if not promo:
        raise ValueError("Промокод не найден или недействителен.")
    upper_code = str(promo["code"]).strip().upper()
    assert_promo_activation_allowed(db, user_tg_id, upper_code)
    result = db.activate_promo_for_user(code.strip(), user_tg_id)
    return {**result, "already_active": False}
