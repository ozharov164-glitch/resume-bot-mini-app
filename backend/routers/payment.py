import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from telegram import Bot, Update

from config import settings
from database import get_db
from dependencies import get_current_user
from services.founder import is_founder
from services.admin_notify import PaymentNotifyInfo
from services.payment_fulfillment import fulfill_paid_resume
from services.payment_service import create_stars_invoice_link, create_yookassa_payment
from services.yookassa_webhook import handle_yookassa_webhook

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/payment", tags=["payment"])


@router.post("/create-invoice/{resume_id}")
async def create_invoice(resume_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    resume = db.find_resume(resume_id, current_user["id"])
    if not resume:
        raise HTTPException(status_code=404, detail="Резюме не найдено.")

    if is_founder(current_user.get("telegram_id")):
        return {
            "status": "founder_unlimited",
            "provider": "founder",
            "invoice_link": None,
        }

    try:
        invoice_link = await create_stars_invoice_link(resume_id, current_user["id"])
    except Exception as exc:
        logger.exception("create_stars_invoice_link failed resume_id=%s", resume_id)
        raise HTTPException(
            status_code=502,
            detail="Не удалось создать счёт Stars. Попробуйте ещё раз.",
        ) from exc

    return {
        "status": "ready",
        "provider": "telegram_stars",
        "invoice_link": invoice_link,
    }


@router.post("/create-yookassa/{resume_id}")
async def create_yookassa_invoice(
    resume_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    resume = db.find_resume(resume_id, current_user["id"])
    if not resume:
        raise HTTPException(status_code=404, detail="Резюме не найдено.")
    if is_founder(current_user.get("telegram_id")):
        raise HTTPException(
            status_code=400,
            detail="Для founder PDF бесплатный — скачай из превью.",
        )
    try:
        payment = create_yookassa_payment(resume_id=resume_id, user_id=current_user["id"])
        url = payment.get("confirmation_url")
        if not url:
            logger.error("yookassa: empty confirmation_url resume_id=%s", resume_id)
            raise HTTPException(status_code=502, detail="ЮKassa не вернула ссылку на оплату.")
        return {"status": "created", "provider": "yookassa", **payment}
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
async def telegram_payment_webhook(request: Request, db=Depends(get_db)):
    """Optional HTTP webhook; primary path is bot polling + successful_payment handler."""
    data = await request.json()
    update = Update.de_json(data, Bot(token=settings.BOT_TOKEN))

    if update.message and update.message.successful_payment:
        payment = update.message.successful_payment
        try:
            payload = json.loads(payment.invoice_payload)
            resume_id = payload["resume_id"]
            from_user = update.message.from_user
            telegram_id = from_user.id
            pay_info = PaymentNotifyInfo(
                provider="telegram_stars",
                amount=str(payment.total_amount),
                currency="⭐" if payment.currency == "XTR" else payment.currency,
                resume_id=resume_id,
                telegram_id=telegram_id,
                username=from_user.username or "",
                first_name=from_user.first_name or "",
            )
            await fulfill_paid_resume(db, resume_id, telegram_id, payment=pay_info)
        except Exception:
            logger.exception("telegram-webhook fulfill failed")

    return {"ok": True}
