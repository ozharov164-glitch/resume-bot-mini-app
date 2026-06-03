import json
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from telegram import Bot, Update

from config import settings
from database import get_db
from dependencies import get_current_user
from services.founder import is_founder
from services.admin_notify import PaymentNotifyInfo
from services.bonus_payment import apply_bonus_rub, apply_bonus_stars
from services.payment_dispatch import fulfill_from_invoice_payload
from services.payment_service import create_stars_invoice_link, create_yookassa_payment
from services.promo_service import RUB_PRICE_SINGLE_PDF, activate_promo, discounted_prices, resolve_payment_promo
from services.telegram_service import verify_telegram_webhook_secret
from services.yookassa_webhook import handle_yookassa_webhook

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/payment", tags=["payment"])


def _prepare_resume_promo(db, resume_id: str, telegram_id: int) -> tuple[int, str]:
    promo_code, discount, _promo = resolve_payment_promo(db, telegram_id)
    stars, rub = discounted_prices(discount)
    if promo_code and discount > 0:
        db.update_resume(
            resume_id,
            {
                "promo_code": promo_code,
                "discount_applied": discount,
                "final_price_stars": stars,
                "final_price_rub": max(1, round(RUB_PRICE_SINGLE_PDF * (1 - discount / 100))),
            },
        )
    return stars, rub


@router.post("/create-invoice/{resume_id}")
async def create_invoice(
    resume_id: str,
    body: dict | None = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    resume = db.find_resume(resume_id, current_user["id"])
    if not resume:
        raise HTTPException(status_code=404, detail="Резюме не найдено.")

    if is_founder(current_user.get("telegram_id")):
        return {
            "status": "founder_unlimited",
            "provider": "founder",
            "invoice_link": None,
        }

    stars, _rub = _prepare_resume_promo(db, resume_id, current_user["telegram_id"])
    use_bonus = bool((body or {}).get("use_bonus"))
    stars, bonus_applied = apply_bonus_stars(
        db, int(current_user["telegram_id"]), stars, use_bonus
    )

    try:
        invoice_link = await create_stars_invoice_link(
            resume_id,
            current_user["id"],
            stars_amount=stars,
            bonus_stars_applied=bonus_applied,
        )
    except Exception as exc:
        logger.exception("create_stars_invoice_link failed resume_id=%s", resume_id)
        detail = "Не удалось создать счёт Stars. Попробуйте ещё раз."
        err_text = str(exc).lower()
        if "invoice_payload" in err_text:
            detail = "Ошибка счёта Stars (payload). Обновите приложение и попробуйте снова."
        raise HTTPException(status_code=502, detail=detail) from exc

    return {
        "status": "ready",
        "provider": "telegram_stars",
        "invoice_link": invoice_link,
        "stars_amount": stars,
        "bonus_stars_applied": bonus_applied,
    }


@router.post("/create-adapt-invoice/{resume_id}")
async def create_adapt_invoice(
    resume_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    resume = db.find_resume(resume_id, current_user["id"])
    if not resume:
        raise HTTPException(status_code=404, detail="Резюме не найдено.")

    stars = settings.STARS_PRICE_ADAPT
    try:
        invoice_link = await create_stars_invoice_link(
            resume_id,
            current_user["id"],
            stars_amount=stars,
            payment_type="adapt",
            title="Адаптация резюме",
            description="Резюме под конкретную вакансию с hh.ru",
        )
    except Exception as exc:
        logger.exception("create_adapt_invoice failed resume_id=%s", resume_id)
        raise HTTPException(status_code=502, detail="Не удалось создать счёт.") from exc

    return {
        "status": "ready",
        "provider": "telegram_stars",
        "invoice_link": invoice_link,
        "stars_amount": stars,
    }


@router.post("/create-yookassa/{resume_id}")
async def create_yookassa_invoice(
    resume_id: str,
    body: dict | None = None,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    resume = db.find_resume(resume_id, current_user["id"])
    if not resume:
        raise HTTPException(status_code=404, detail="Резюме не найдено.")
    if is_founder(current_user.get("telegram_id")):
        raise HTTPException(
            status_code=400,
            detail="Для founder PDF бесплатный — скачайте из предпросмотра.",
        )
    _stars, rub = _prepare_resume_promo(db, resume_id, current_user["telegram_id"])
    use_bonus = bool((body or {}).get("use_bonus"))
    rub, bonus_applied = apply_bonus_rub(
        db, int(current_user["telegram_id"]), rub, use_bonus
    )
    try:
        payment = create_yookassa_payment(
            resume_id=resume_id,
            user_id=current_user["id"],
            amount_rub=rub,
            bonus_stars_applied=bonus_applied,
        )
        url = payment.get("confirmation_url")
        if not url:
            logger.error("yookassa: empty confirmation_url resume_id=%s", resume_id)
            raise HTTPException(status_code=502, detail="ЮKassa не вернула ссылку на оплату.")
        return {
            "status": "created",
            "provider": "yookassa",
            "amount_rub": rub,
            "bonus_stars_applied": bonus_applied,
            **payment,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("create_yookassa_payment failed resume_id=%s", resume_id)
        raise HTTPException(
            status_code=502,
            detail="Не удалось создать платёж. Попробуйте ещё раз или оплатите Stars.",
        ) from exc


@router.post("/yookassa-webhook")
async def yookassa_webhook(request: Request, db=Depends(get_db)):
    payload = await request.json()
    result = await handle_yookassa_webhook(db, payload)
    if result.get("ok") is False and result.get("error") == "not_configured":
        raise HTTPException(status_code=503, detail="YooKassa is not configured.")
    if result.get("ok") is False:
        raise HTTPException(status_code=502, detail="Webhook processing failed.")
    return result


@router.post("/telegram-webhook")
async def telegram_payment_webhook(
    request: Request,
    db=Depends(get_db),
    x_telegram_bot_api_secret_token: str | None = Header(
        default=None, alias="X-Telegram-Bot-Api-Secret-Token"
    ),
):
    """Optional HTTP webhook; primary path is bot polling + successful_payment handler."""
    if not verify_telegram_webhook_secret(x_telegram_bot_api_secret_token):
        raise HTTPException(status_code=403, detail="Forbidden")
    data = await request.json()
    update = Update.de_json(data, Bot(token=settings.BOT_TOKEN))

    if update.message and update.message.successful_payment:
        payment = update.message.successful_payment
        try:
            from services.invoice_payload import parse_invoice_payload

            from services.payment_validation import expected_stars_amount

            payload = parse_invoice_payload(payment.invoice_payload)
            resume_id = str(payload.get("resume_id") or "")
            from_user = update.message.from_user
            telegram_id = from_user.id
            expected = expected_stars_amount(
                db,
                resume_id=resume_id,
                telegram_id=telegram_id,
                payment_type=str(payload.get("type") or "single_pdf"),
                bonus_stars_applied=int(payload.get("bonus_stars_applied") or 0),
            )
            if expected is None or int(payment.total_amount) != expected:
                logger.warning(
                    "telegram-webhook payment amount mismatch resume_id=%s expected=%s paid=%s",
                    resume_id,
                    expected,
                    payment.total_amount,
                )
                return {"ok": True}
            pay_info = PaymentNotifyInfo(
                provider="telegram_stars",
                amount=str(payment.total_amount),
                currency="⭐" if payment.currency == "XTR" else payment.currency,
                resume_id=str(payload.get("resume_id") or ""),
                telegram_id=telegram_id,
                username=from_user.username or "",
                first_name=from_user.first_name or "",
            )
            await fulfill_from_invoice_payload(db, payload, telegram_id, payment=pay_info)
        except Exception:
            logger.exception("telegram-webhook fulfill failed")

    return {"ok": True}


@router.post("/validate-promo")
async def validate_promo(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    code = str(body.get("code", "")).strip()
    if not code:
        raise HTTPException(status_code=400, detail="Укажите промокод.")
    try:
        result = activate_promo(db, code, current_user["telegram_id"])
    except ValueError:
        raise HTTPException(status_code=404, detail="Промокод не найден или недействителен.")
    return {
        "valid": True,
        "discount_percent": result["discount_percent"],
        "code": result["code"],
        "already_active": bool(result.get("already_active")),
    }
