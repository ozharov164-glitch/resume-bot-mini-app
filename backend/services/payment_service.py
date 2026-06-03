import uuid
from datetime import datetime

from telegram import Bot, LabeledPrice
from yookassa import Configuration, Payment

from config import settings
from services.invoice_payload import encode_invoice_payload
from services.payment_return import yookassa_return_url

_STARS_TITLE = "Резюме: PDF и DOCX"
_STARS_DESCRIPTION = "PDF, DOCX в выбранном шаблоне и текст для отклика на hh.ru."


def _stars_prices(amount: int | None = None) -> list[LabeledPrice]:
    stars = amount if amount is not None else settings.STARS_PRICE_SINGLE_PDF
    return [LabeledPrice(label="PDF и DOCX", amount=stars)]


def create_yookassa_payment(
    resume_id: str,
    user_id: str,
    amount_rub: str | None = None,
    *,
    bonus_stars_applied: int = 0,
) -> dict:
    if not settings.YOKASSA_SHOP_ID or not settings.YOKASSA_SECRET_KEY:
        raise ValueError("YooKassa credentials are not configured.")
    Configuration.account_id = settings.YOKASSA_SHOP_ID
    Configuration.secret_key = settings.YOKASSA_SECRET_KEY

    rub = amount_rub or f"{settings.RUB_PRICE_SINGLE_PDF:.2f}"
    payment = Payment.create(
        {
            "amount": {"value": rub, "currency": "RUB"},
            "confirmation": {
                "type": "redirect",
                "return_url": yookassa_return_url(resume_id),
            },
            "capture": True,
            "description": "ResumeBot: PDF и DOCX",
            "metadata": {
                "resume_id": resume_id,
                "user_id": user_id,
                "type": "single_pdf",
                "bonus_stars_applied": str(bonus_stars_applied),
            },
        },
        str(uuid.uuid4()),
    )
    return {"payment_id": payment.id, "confirmation_url": payment.confirmation.confirmation_url}


async def create_stars_invoice_link(
    resume_id: str,
    user_id: str,
    *,
    stars_amount: int | None = None,
    payment_type: str = "single_pdf",
    bonus_stars_applied: int = 0,
    title: str | None = None,
    description: str | None = None,
) -> str:
    """Invoice link for Telegram Mini App WebApp.openInvoice (in-app Stars payment)."""
    bot = Bot(token=settings.BOT_TOKEN)
    link = await bot.create_invoice_link(
        title=title or _STARS_TITLE,
        description=description or _STARS_DESCRIPTION,
        payload=encode_invoice_payload(
            resume_id,
            payment_type=payment_type,
            bonus_stars_applied=bonus_stars_applied,
        ),
        currency="XTR",
        prices=_stars_prices(stars_amount),
        provider_token="",
    )
    return link


def paid_timestamp() -> str:
    return datetime.utcnow().isoformat()
