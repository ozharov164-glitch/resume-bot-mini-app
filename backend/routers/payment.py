import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from telegram import Bot, Update

from config import settings
from database import get_db
from dependencies import get_current_user
from services.payment_service import create_yookassa_payment, send_stars_invoice
from services.pdf_service import generate_pdf
from services.telegram_service import send_document_to_user

router = APIRouter(prefix="/api/payment", tags=["payment"])


@router.post("/create-invoice/{resume_id}")
async def create_invoice(resume_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    resume = (
        db.table("resumes")
        .select("*")
        .eq("id", resume_id)
        .eq("user_id", current_user["id"])
        .limit(1)
        .execute()
    )
    if not resume.data:
        raise HTTPException(status_code=404, detail="Резюме не найдено.")

    await send_stars_invoice(current_user["telegram_id"], resume_id, current_user["id"])
    return {"status": "invoice_sent", "provider": "telegram_stars"}


@router.post("/create-yookassa/{resume_id}")
async def create_yookassa_invoice(resume_id: str, current_user: dict = Depends(get_current_user)):
    try:
        payment = create_yookassa_payment(resume_id=resume_id, user_id=current_user["id"])
        return {"status": "created", "provider": "yookassa", **payment}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/telegram-webhook")
async def telegram_payment_webhook(request: Request, db=Depends(get_db)):
    data = await request.json()
    update = Update.de_json(data, Bot(token=settings.BOT_TOKEN))

    if update.message and update.message.successful_payment:
        payment = update.message.successful_payment
        payload = json.loads(payment.invoice_payload)
        resume_id = payload["resume_id"]

        db.table("resumes").update({"is_paid": True, "paid_at": datetime.utcnow().isoformat()}).eq("id", resume_id).execute()
        resume_result = db.table("resumes").select("data").eq("id", resume_id).limit(1).execute()
        if not resume_result.data:
            return {"ok": True}

        resume_data = resume_result.data[0]["data"]
        pdf_bytes = generate_pdf(resume_data)
        filename = f"resume_{resume_data.get('full_name', 'resume').replace(' ', '_')}.pdf"
        await send_document_to_user(
            user_telegram_id=update.message.from_user.id,
            document=pdf_bytes,
            filename=filename,
            caption="Оплата прошла успешно. Ваше резюме уже готово и отправлено в чат.",
        )

    return {"ok": True}
