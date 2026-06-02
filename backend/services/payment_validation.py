"""Payment and resume ownership checks shared by bot and API."""

from __future__ import annotations

from typing import Any

from config import settings
from services.bonus_payment import apply_bonus_stars
from services.promo_service import discounted_prices, resolve_payment_promo


def resume_belongs_to_telegram(db: Any, resume_id: str, telegram_id: int) -> bool:
    resume = db.find_resume(resume_id)
    if not resume:
        return False
    user = db.find_user_by_telegram_id(int(telegram_id))
    if not user:
        return False
    return str(resume.get("user_id")) == str(user.get("id"))


def expected_stars_amount(
    db: Any,
    *,
    resume_id: str,
    telegram_id: int,
    payment_type: str,
    bonus_stars_applied: int,
) -> int | None:
    """Stars total that must match pre_checkout_query.total_amount."""
    if not resume_belongs_to_telegram(db, resume_id, telegram_id):
        return None

    if payment_type == "adapt":
        return settings.STARS_PRICE_ADAPT

    resume = db.find_resume(resume_id)
    if not resume:
        return None

    stored = resume.get("final_price_stars")
    if stored is not None:
        try:
            stars = int(stored)
        except (TypeError, ValueError):
            stars = settings.STARS_PRICE_SINGLE_PDF
    else:
        _promo_code, discount, _promo = resolve_payment_promo(db, telegram_id)
        stars, _rub = discounted_prices(discount)

    bonus = max(0, int(bonus_stars_applied or 0))
    use_bonus = bonus > 0
    stars, applied = apply_bonus_stars(db, telegram_id, stars, use_bonus)
    if use_bonus and applied != bonus:
        return None
    return max(1, int(stars))
