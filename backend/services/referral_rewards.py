"""First-payment rewards: friend referrals (bonus Stars) vs affiliate promo (sale notice)."""

from __future__ import annotations

import logging
from typing import Any

from config import settings

logger = logging.getLogger(__name__)

# Friend invite (ref_ link): fixed bonus when the invited user pays.
REFERRAL_FRIEND_BONUS_STARS = 30


async def process_first_payment_attribution(
    db: Any,
    *,
    buyer: dict | None,
    buyer_telegram_id: int,
    resume_id: str,
    resume: dict,
    payment: Any | None,
) -> None:
    """
    After the buyer's first paid resume:
    - Affiliate promo → short sale notice to trafficker (payout in ₽ is tracked for admin).
    - Friend ref_ link → +30 bonus Stars to non-affiliate referrer.
    """
    del payment  # commission is always computed in ₽ from resume price

    promo_code_used: str | None = None

    if buyer and buyer.get("active_promo_code"):
        promo_code_used = str(buyer["active_promo_code"]).strip().upper()
        db.use_promo_code(promo_code_used, resume_id)
        db.mark_promo_activation_paid(buyer_telegram_id, resume_id)
    elif resume.get("promo_code"):
        promo_code_used = str(resume["promo_code"]).strip().upper()

    affiliate_owner_id: int | None = None
    if promo_code_used:
        promo = db.validate_promo_code(promo_code_used, buyer_telegram_id)
        owner = promo.get("owner_tg_id") if promo else None
        if owner and db.is_user_affiliate(int(owner)):
            affiliate_owner_id = int(owner)
            await _notify_affiliate_sale(affiliate_owner_id, code=promo_code_used)

    referred_by = buyer.get("referred_by") if buyer else None
    if not referred_by:
        return

    referrer_id = int(referred_by)
    if referrer_id == buyer_telegram_id:
        return
    if affiliate_owner_id is not None and referrer_id == affiliate_owner_id:
        return
    if db.is_user_affiliate(referrer_id):
        return

    db.add_bonus_stars(referrer_id, REFERRAL_FRIEND_BONUS_STARS)
    await _notify_friend_referral_bonus(referrer_id)


async def _notify_friend_referral_bonus(referrer_id: int) -> None:
    from services.telegram_bot import get_bot

    await get_bot().send_message(
        chat_id=referrer_id,
        text=(
            f"Ваш друг оплатил резюме! +{REFERRAL_FRIEND_BONUS_STARS} бонусных Stars "
            "на вашем счёте. Используйте при следующей оплате командой /my"
        ),
    )


async def _notify_affiliate_sale(affiliate_id: int, *, code: str) -> None:
    from services.telegram_bot import get_bot

    await get_bot().send_message(
        chat_id=affiliate_id,
        text=(
            f"✅ По вашему промокоду <code>{code}</code> купили резюме.\n\n"
            "Статистика и выплаты — в панели траффера: /cabinet"
        ),
        parse_mode="HTML",
    )
