"""Bonus Stars discount for Stars and RUB payments (1 bonus unit = 1 ⭐ or 1 ₽)."""

from __future__ import annotations

from typing import Any


def bonus_units_to_apply(available: int, price: int) -> int:
    if price <= 1 or available <= 0:
        return 0
    return min(available, price - 1)


def apply_bonus_stars(db: Any, telegram_id: int, stars: int, use_bonus: bool) -> tuple[int, int]:
    if not use_bonus:
        return stars, 0
    available = db.get_bonus_stars(telegram_id)
    discount = bonus_units_to_apply(available, stars)
    return stars - discount, discount


def apply_bonus_rub(db: Any, telegram_id: int, rub_amount: str, use_bonus: bool) -> tuple[str, int]:
    if not use_bonus:
        return rub_amount, 0
    rub_int = max(1, int(round(float(rub_amount))))
    available = db.get_bonus_stars(telegram_id)
    discount = bonus_units_to_apply(available, rub_int)
    return f"{max(1, rub_int - discount):.2f}", discount
