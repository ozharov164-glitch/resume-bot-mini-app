import json
import uuid
from datetime import datetime

from telegram import Bot, LabeledPrice
from yookassa import Configuration, Payment

from config import settings
from services.payment_return import yookassa_return_url

_STARS_TITLE = "Резюме в PDF"
_STARS_DESCRIPTION = "Профессионально оформленное резюме в формате PDF для отклика на вакансии."


def _invoice_payload(resume_id: str, user_id: str) -> str:
    return json.dumps({"resume_id": resume_id, "user_id": user_id, "type": "single_pdf"})


def _stars_prices(amount: int | None = None) -> list[LabeledPrice]:
    stars = amount if amount is not None else settings.STARS_PRICE_SINGLE_PDF
    return [LabeledPrice(label="PDF-резюме", amount=stars)]


def create_yookassa_payment(
    resume_id: str,
    user_id: str,
    amount_rub: str | None = None,
) -> dict:
    if not settings.YOKASSA_SHOP_ID or not settings.YOKASSA_SECRET_KEY:
        raise ValueError("YooKassa credentials are not configured.")
    Configuration.account_id = settings.YOKASSA_SHOP_ID
    Configuration.secret_key = settings.YOKASSA_SECRET_KEY

    rub = amount_rub or "149.00"
    payment = Payment.create(
        {
            "amount": {"value": rub, "currency": "RUB"},
            "confirmation": {
                "type": "redirect",
                "return_url": yookassa_return_url(resume_id),
            },
            "capture": True,
            "description": "ResumeBot: PDF-резюме",
            "metadata": {"resume_id": resume_id, "user_id": user_id},
        },
        str(uuid.uuid4()),
    )
    return {"payment_id": payment.id, "confirmation_url": payment.confirmation.confirmation_url}


async def create_stars_invoice_link(
    resume_id: str,
    user_id: str,
    *,
    stars_amount: int | None = None,
) -> str:
    """Invoice link for Telegram Mini App WebApp.openInvoice (in-app Stars payment)."""
    bot = Bot(token=settings.BOT_TOKEN)
    link = await bot.create_invoice_link(
        title=_STARS_TITLE,
        description=_STARS_DESCRIPTION,
        payload=_invoice_payload(resume_id, user_id),
        currency="XTR",
        prices=_stars_prices(stars_amount),
        provider_token="",
    )
    return link


def paid_timestamp() -> str:
    return datetime.utcnow().isoformat()
