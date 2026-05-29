import json
import logging
from datetime import datetime
from typing import Any

from services.pdf_service import generate_pdf
from services.telegram_service import send_document_to_user

logger = logging.getLogger(__name__)


def parse_resume_data(raw: Any) -> dict:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        return json.loads(raw)
    raise ValueError("resume data must be dict or json string")


async def fulfill_paid_resume(db: Any, resume_id: str, telegram_id: int) -> bool:
    """Mark resume paid and send PDF to user's Telegram chat. Idempotent."""
    resume = db.find_resume(resume_id)
    if not resume:
        logger.warning("fulfill: resume %s not found", resume_id)
        return False

    if resume.get("is_paid"):
        logger.info("fulfill: resume %s already paid, resending PDF", resume_id)
    else:
        db.update_resume(
            resume_id,
            {"is_paid": True, "paid_at": datetime.utcnow().isoformat()},
        )

    try:
        resume_data = parse_resume_data(resume["data"])
    except (json.JSONDecodeError, ValueError) as exc:
        logger.exception("fulfill: invalid resume data for %s", resume_id)
        raise exc

    try:
        pdf_bytes = generate_pdf(resume_data)
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
    return True
