"""Fulfill paid vacancy adaptation — new resume in history."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from services.ai_service import adapt_resume_for_vacancy, finalize_resume_data
from services.payment_fulfillment import parse_resume_data
from services.payment_validation import resume_belongs_to_telegram
from services.pdf_async import generate_pdf_async
from services.telegram_service import send_document_to_user

logger = logging.getLogger(__name__)


async def fulfill_adapt_resume(
    db: Any,
    source_resume_id: str,
    telegram_id: int,
) -> str | None:
    if not resume_belongs_to_telegram(db, source_resume_id, telegram_id):
        logger.warning(
            "adapt: resume %s not owned by telegram_id=%s",
            source_resume_id,
            telegram_id,
        )
        return None

    resume = db.find_resume(source_resume_id)
    if not resume:
        logger.warning("adapt: source resume %s not found", source_resume_id)
        return None

    answers = resume.get("user_answers") or {}
    if isinstance(answers, str):
        try:
            answers = json.loads(answers)
        except json.JSONDecodeError:
            answers = {}
    if not isinstance(answers, dict):
        answers = {}

    vacancy = str(answers.get("_pending_adapt_vacancy") or "").strip()
    if not vacancy:
        logger.warning("adapt: no pending vacancy resume_id=%s", source_resume_id)
        return None

    try:
        resume_data = parse_resume_data(resume["data"])
    except (ValueError, json.JSONDecodeError):
        logger.exception("adapt: invalid resume data %s", source_resume_id)
        return None

    adapted = await adapt_resume_for_vacancy(resume_data, vacancy)
    adapted = finalize_resume_data(adapted, answers)

    user = db.find_user_by_telegram_id(telegram_id)
    if not user:
        return None

    new_id = str(uuid.uuid4())
    template_id = resume.get("template_id") or "classic"
    clean_answers = {k: v for k, v in answers.items() if not str(k).startswith("_")}
    paid_at = datetime.now(timezone.utc).isoformat()
    db.create_resume(
        {
            "id": new_id,
            "user_id": user["id"],
            "data": adapted,
            "user_answers": clean_answers,
            "is_paid": True,
            "template_id": template_id,
            "created_at": paid_at,
        }
    )
    db.update_resume(new_id, {"is_paid": True, "paid_at": paid_at})

    answers.pop("_pending_adapt_vacancy", None)
    db.update_resume(source_resume_id, {"user_answers": answers})

    pdf_bytes = await generate_pdf_async(adapted, template_id)
    safe_name = adapted.get("full_name", "resume").replace(" ", "_")[:80]
    filename = f"resume_adapted_{safe_name}.pdf"
    name = (adapted.get("full_name") or "").strip()
    caption = (
        f"Адаптированное резюме готово{f', {name}' if name else ''}! "
        "PDF отправлен в чат."
    )
    await send_document_to_user(
        user_telegram_id=telegram_id,
        document=pdf_bytes,
        filename=filename,
        caption=caption.strip(),
    )
    logger.info("adapt fulfilled source=%s new=%s telegram_id=%s", source_resume_id, new_id, telegram_id)
    return new_id
