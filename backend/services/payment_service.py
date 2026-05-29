import json
import uuid
from datetime import datetime

from telegram import Bot
from yookassa import Configuration, Payment

from config import settings


def create_yookassa_payment(resume_id: str, user_id: str, amount_rub: str = "149.00") -> dict:
    if not settings.YOKASSA_SHOP_ID or not settings.YOKASSA_SECRET_KEY:
        raise ValueError("YooKassa credentials are not configured.")
    Configuration.account_id = settings.YOKASSA_SHOP_ID
    Configuration.secret_key = settings.YOKASSA_SECRET_KEY

    payment = Payment.create(
        {
            "amount": {"value": amount_rub, "currency": "RUB"},
            "confirmation": {
                "type": "redirect",
                "return_url": settings.YOKASSA_RETURN_URL or settings.FRONTEND_URL,
            },
            "capture": True,
            "description": "ResumeBot: PDF-резюме",
            "metadata": {"resume_id": resume_id, "user_id": user_id},
        },
        str(uuid.uuid4()),
    )
    return {"payment_id": payment.id, "confirmation_url": payment.confirmation.confirmation_url}


async def send_stars_invoice(telegram_id: int, resume_id: str, user_id: str) -> None:
    bot = Bot(token=settings.BOT_TOKEN)
    await bot.send_invoice(
        chat_id=telegram_id,
        title="Резюме в PDF",
        description="Профессионально оформленное резюме в формате PDF для отклика на вакансии.",
        payload=json.dumps({"resume_id": resume_id, "user_id": user_id, "type": "single_pdf"}),
        currency="XTR",
        prices=[{"label": "PDF-резюме", "amount": settings.STARS_PRICE_SINGLE_PDF}],
    )


def paid_timestamp() -> str:
    return datetime.utcnow().isoformat()
