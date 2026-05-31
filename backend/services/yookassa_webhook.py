import logging
from typing import Any

from yookassa import Configuration, Payment
from yookassa.domain.notification import WebhookNotificationEventType, WebhookNotificationFactory

from config import settings
from services.admin_notify import PaymentNotifyInfo

logger = logging.getLogger(__name__)


def _configure_yookassa() -> None:
    Configuration.account_id = settings.YOKASSA_SHOP_ID
    Configuration.secret_key = settings.YOKASSA_SECRET_KEY


def _metadata_value(metadata: Any, key: str) -> str | None:
    if not metadata:
        return None
    if isinstance(metadata, dict):
        value = metadata.get(key)
    else:
        value = getattr(metadata, key, None)
    if value is None:
        return None
    text = str(value).strip()
    return text or None


async def handle_yookassa_webhook(db: Any, payload: dict) -> dict:
    """Process YooKassa HTTP notification. Always returns ok-shaped dict for HTTP 200."""
    if not settings.YOKASSA_SHOP_ID or not settings.YOKASSA_SECRET_KEY:
        logger.error("yookassa webhook: credentials not configured")
        return {"ok": False, "error": "not_configured"}

    try:
        notification = WebhookNotificationFactory().create(payload)
    except (ValueError, TypeError):
        logger.warning("yookassa webhook: invalid payload keys=%s", list(payload.keys()))
        return {"ok": True, "status": "ignored"}

    if notification.event != WebhookNotificationEventType.PAYMENT_SUCCEEDED:
        return {"ok": True, "status": "ignored", "event": notification.event}

    payment_obj = notification.object
    payment_id = getattr(payment_obj, "id", None)
    if not payment_id:
        logger.warning("yookassa webhook: missing payment id")
        return {"ok": True, "status": "ignored"}

    _configure_yookassa()
    try:
        verified = Payment.find_one(payment_id)
    except Exception:
        logger.exception("yookassa webhook: Payment.find_one failed id=%s", payment_id)
        return {"ok": False, "error": "verify_failed"}

    if verified.status != "succeeded":
        logger.info("yookassa webhook: payment %s status=%s", payment_id, verified.status)
        return {"ok": True, "status": "ignored", "payment_status": verified.status}

    resume_id = _metadata_value(verified.metadata, "resume_id")
    user_id = _metadata_value(verified.metadata, "user_id")
    if not resume_id or not user_id:
        logger.warning("yookassa webhook: missing metadata payment_id=%s", payment_id)
        return {"ok": True, "status": "ignored"}

    resume = db.find_resume(resume_id, user_id)
    if not resume:
        logger.warning("yookassa webhook: resume not found resume_id=%s user_id=%s", resume_id, user_id)
        return {"ok": True, "status": "ignored"}

    user = db.find_user_by_id(user_id)
    if not user or not user.get("telegram_id"):
        logger.warning("yookassa webhook: user not found user_id=%s", user_id)
        return {"ok": True, "status": "ignored"}

    telegram_id = int(user["telegram_id"])
    amount = verified.amount
    amount_str = amount.value if amount else "?"
    currency = amount.currency if amount else "RUB"

    pay_info = PaymentNotifyInfo(
        provider="yookassa",
        amount=amount_str,
        currency=currency,
        resume_id=resume_id,
        telegram_id=telegram_id,
        username=user.get("username") or "",
        first_name=user.get("first_name") or "",
        external_id=payment_id,
    )
    from services.payment_fulfillment import fulfill_paid_resume

    await fulfill_paid_resume(db, resume_id, telegram_id, payment=pay_info)
    logger.info("yookassa webhook: fulfilled resume_id=%s payment_id=%s", resume_id, payment_id)
    return {"ok": True, "status": "fulfilled", "resume_id": resume_id}
