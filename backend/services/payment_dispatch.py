"""Route successful payments to PDF or adapt fulfillment."""

from __future__ import annotations

import logging
from typing import Any

from services.admin_notify import PaymentNotifyInfo
from services.adapt_fulfillment import fulfill_adapt_resume
from services.payment_fulfillment import fulfill_paid_resume

logger = logging.getLogger(__name__)


async def fulfill_from_invoice_payload(
    db: Any,
    payload: dict,
    telegram_id: int,
    *,
    payment: PaymentNotifyInfo | None = None,
) -> bool:
    resume_id = str(payload.get("resume_id") or "")
    if not resume_id:
        logger.warning("payment payload missing resume_id")
        return False

    payment_type = str(payload.get("type") or "single_pdf")
    bonus_applied = int(payload.get("bonus_stars_applied") or 0)

    if payment_type == "adapt":
        new_id = await fulfill_adapt_resume(db, resume_id, telegram_id)
        return new_id is not None

    return await fulfill_paid_resume(
        db,
        resume_id,
        telegram_id,
        payment=payment,
        bonus_stars_applied=bonus_applied,
    )
