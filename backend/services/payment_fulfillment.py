import json
import logging
from datetime import datetime
from typing import Any

from config import settings
from services.admin_notify import PaymentNotifyInfo, notify_payment
from services.pdf_async import generate_pdf_async
from services.resume_schema import normalize_resume_data
from services.telegram_service import send_document_to_user

logger = logging.getLogger(__name__)


def parse_resume_data(raw: Any) -> dict:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        return json.loads(raw)
    raise ValueError("resume data must be dict or json string")


def _parse_paid_amount(payment: PaymentNotifyInfo | None) -> int:
    if not payment:
        return settings.STARS_PRICE_SINGLE_PDF
    raw = str(payment.amount).strip()
    digits = "".join(ch for ch in raw if ch.isdigit())
    try:
        return int(digits) if digits else settings.STARS_PRICE_SINGLE_PDF
    except ValueError:
        return settings.STARS_PRICE_SINGLE_PDF


async def fulfill_paid_resume(
    db: Any,
    resume_id: str,
    telegram_id: int,
    *,
    payment: PaymentNotifyInfo | None = None,
    bonus_stars_applied: int = 0,
) -> bool:
    """Mark resume paid and send PDF to user's Telegram chat. Idempotent."""
    resume = db.find_resume(resume_id)
    if not resume:
        logger.warning("fulfill: resume %s not found", resume_id)
        return False

    first_payment = not resume.get("is_paid")
    if resume.get("is_paid"):
        logger.info("fulfill: resume %s already paid, resending PDF", resume_id)
    else:
        db.update_resume(
            resume_id,
            {"is_paid": True, "paid_at": datetime.utcnow().isoformat()},
        )
        if payment:
            await notify_payment(db, payment, first_payment=True)

    try:
        resume_data = normalize_resume_data(parse_resume_data(resume["data"]))
    except (json.JSONDecodeError, ValueError) as exc:
        logger.exception("fulfill: invalid resume data for %s", resume_id)
        raise exc

    template_name = resume.get("template_id") or "classic"
    if bonus_stars_applied > 0:
        db.use_bonus_stars(telegram_id, bonus_stars_applied)

    try:
        pdf_bytes = await generate_pdf_async(resume_data, template_name)
    except Exception:
        logger.exception("fulfill: pdf generation failed resume_id=%s", resume_id)
        raise
    safe_name = resume_data.get("full_name", "resume").replace(" ", "_")[:80]
    filename = f"resume_{safe_name}.pdf"
    name = (resume_data.get("full_name") or "").strip()
    caption = f"Готово! Ваше резюме в PDF уже в чате. Удачи в поиске работы{f', {name}' if name else ''}!"
    await send_document_to_user(
        user_telegram_id=telegram_id,
        document=pdf_bytes,
        filename=filename,
        caption=caption.strip(),
    )
    logger.info("fulfill: PDF sent for resume %s to telegram_id=%s", resume_id, telegram_id)

    if first_payment:
        try:
            buyer = db.find_user_by_telegram_id(telegram_id)
            if buyer and buyer.get("active_promo_code"):
                code = buyer["active_promo_code"]
                db.use_promo_code(code, resume_id)
                db.mark_promo_activation_paid(telegram_id, resume_id)
            referred_by = buyer.get("referred_by") if buyer else None
            if referred_by:
                referrer_id = int(referred_by)
                paid_amount = _parse_paid_amount(payment)
                bonus = max(1, round(paid_amount * 0.20))
                db.add_bonus_stars(referrer_id, bonus)
                from telegram import Bot

                bot = Bot(token=settings.BOT_TOKEN)
                await bot.send_message(
                    chat_id=referrer_id,
                    text=(
                        f"Ваш друг создал резюме! +{bonus} Stars на вашем счёте. "
                        "Используйте при следующей оплате командой /my"
                    ),
                )
        except Exception as exc:
            logger.warning("fulfill: referral bonus failed resume_id=%s: %s", resume_id, exc)

    return True
