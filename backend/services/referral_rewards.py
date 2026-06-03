"""First-payment rewards: friend referrals (bonus Stars) vs affiliate promo (commission)."""

from __future__ import annotations

import html
import logging
from typing import Any

from config import settings
from services.admin_notify import PaymentNotifyInfo, send_admin_message

logger = logging.getLogger(__name__)

# Friend invite (ref_ link): fixed bonus when the invited user pays.
REFERRAL_FRIEND_BONUS_STARS = 30


def paid_amount_stars(payment: PaymentNotifyInfo | None) -> int:
    if not payment:
        return settings.STARS_PRICE_SINGLE_PDF
    raw = str(payment.amount).strip()
    digits = "".join(ch for ch in raw if ch.isdigit())
    try:
        return int(digits) if digits else settings.STARS_PRICE_SINGLE_PDF
    except ValueError:
        return settings.STARS_PRICE_SINGLE_PDF


def affiliate_commission_stars(paid_amount: int, commission_percent: int) -> int:
    pct = max(0, min(100, int(commission_percent or 20)))
    return max(1, round(paid_amount * pct / 100))


async def process_first_payment_attribution(
    db: Any,
    *,
    buyer: dict | None,
    buyer_telegram_id: int,
    resume_id: str,
    resume: dict,
    payment: PaymentNotifyInfo | None,
) -> None:
    """
    After the buyer's first paid resume:
    - Affiliate promo → notify trafficker + admin (commission %, no bonus Stars).
    - Friend ref_ link → +30 bonus Stars to non-affiliate referrer.
    """
    paid_amount = paid_amount_stars(payment)
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
            commission_pct = int(promo.get("commission_percent") or 20)
            commission = affiliate_commission_stars(paid_amount, commission_pct)
            await _notify_affiliate_commission(
                db,
                affiliate_owner_id,
                code=promo_code_used,
                commission_stars=commission,
                paid_amount=paid_amount,
                commission_percent=commission_pct,
            )

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
    from telegram import Bot

    bot = Bot(token=settings.BOT_TOKEN)
    await bot.send_message(
        chat_id=referrer_id,
        text=(
            f"Ваш друг оплатил резюме! +{REFERRAL_FRIEND_BONUS_STARS} бонусных Stars "
            "на вашем счёте. Используйте при следующей оплате командой /my"
        ),
    )


async def _notify_affiliate_commission(
    db: Any,
    affiliate_id: int,
    *,
    code: str,
    commission_stars: int,
    paid_amount: int,
    commission_percent: int,
) -> None:
    from telegram import Bot

    owner = db.find_user_by_telegram_id(affiliate_id)

    bot = Bot(token=settings.BOT_TOKEN)
    await bot.send_message(
        chat_id=affiliate_id,
        text=(
            f"💳 По вашему промокоду <code>{code}</code> оплатили резюме.\n\n"
            f"Ваша комиссия {commission_percent}%: <b>{commission_stars} ⭐</b> "
            f"(от оплаты {paid_amount} ⭐).\n\n"
            "Выплату оформляет администратор — на бонусный счёт Stars "
            "комиссия не начисляется. Статистика: /cabinet"
        ),
        parse_mode="HTML",
    )

    name = html.escape(str((owner or {}).get("first_name") or "")) or "—"
    username = (owner or {}).get("username")
    handle = f" @{html.escape(str(username))}" if username else ""
    await send_admin_message(
        "📈 <b>Комиссия траффера</b>\n\n"
        f"Траффер: {name}{handle} (<code>{affiliate_id}</code>)\n"
        f"Промокод: <code>{html.escape(code)}</code>\n"
        f"Комиссия: <b>{commission_stars} ⭐</b> ({commission_percent}% от {paid_amount} ⭐)"
    )
