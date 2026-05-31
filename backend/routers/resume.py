import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from database import get_db
from dependencies import get_current_user
from models.schemas import GenerateResumeRequest, ResumeGenerationResponse, SetTemplateRequest
from services.ai_service import generate_resume
from services.founder import is_founder
from services.payment_fulfillment import parse_resume_data
from services.pdf_service import generate_pdf, generate_preview_png
from services.telegram_service import send_document_to_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/resume", tags=["resume"])


def _as_str(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_resume_fields(resume_data: dict) -> dict:
    """AI JSON may return salary/year as numbers — normalize for PDF and storage."""
    if "salary" in resume_data:
        resume_data["salary"] = _as_str(resume_data.get("salary"))
    for edu in resume_data.get("education") or []:
        if isinstance(edu, dict) and "year" in edu:
            edu["year"] = _as_str(edu.get("year"))
    return resume_data


@router.post("/generate", response_model=ResumeGenerationResponse)
async def create_resume(
    user_data: GenerateResumeRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    try:
        resume_data = await generate_resume(user_data.model_dump())
        resume_data = _normalize_resume_fields(resume_data)
        salary_user = _as_str(user_data.salary)
        if salary_user and not _as_str(resume_data.get("salary")):
            resume_data["salary"] = salary_user
        certs_user = _as_str(user_data.certificates)
        if certs_user and not resume_data.get("certificates"):
            resume_data["certificates"] = [
                c.strip() for c in certs_user.replace("\n", ",").split(",") if c.strip()
            ]
        resume_id = str(uuid.uuid4())
        founder = is_founder(current_user.get("telegram_id"))
        bonus = db.get_referral_bonus(current_user["telegram_id"])
        is_paid_by_bonus = bonus > 0 and db.use_referral_bonus(current_user["telegram_id"])
        is_paid = founder or is_paid_by_bonus
        db.create_resume(
            {
                "id": resume_id,
                "user_id": current_user["id"],
                "data": resume_data,
                "user_answers": user_data.model_dump(),
                "is_paid": is_paid,
                "created_at": datetime.utcnow().isoformat(),
            }
        )
        if founder:
            logger.info(
                "founder resume generated telegram_id=%s resume_id=%s",
                current_user.get("telegram_id"),
                resume_id,
            )
        if is_paid_by_bonus:
            tmpl = "classic"
            pdf_bytes = generate_pdf(resume_data, tmpl)
            safe_name = resume_data.get("full_name", "resume").replace(" ", "_")[:80]
            filename = f"resume_{safe_name}.pdf"
            name = (resume_data.get("full_name") or "").strip()
            caption = f"Готово! Ваше резюме в PDF уже в чате. Удачи в поиске работы{f', {name}' if name else ''}!"
            await send_document_to_user(
                user_telegram_id=current_user["telegram_id"],
                document=pdf_bytes,
                filename=filename,
                caption=caption.strip(),
            )
            db.update_resume(
                resume_id,
                {"is_paid": True, "paid_at": datetime.utcnow().isoformat()},
            )
        return ResumeGenerationResponse(resume_id=resume_id, resume=resume_data, paid=is_paid)
    except Exception as exc:
        logger.exception("resume generate failed user_id=%s", current_user.get("id"))
        raise HTTPException(status_code=500, detail="Не удалось сгенерировать резюме. Попробуйте еще раз.") from exc


@router.get("/list")
async def list_resumes(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    limit: int = 30,
):
    items = db.list_resumes_for_user(current_user["id"], min(limit, 50))
    return {"items": items}


@router.get("/{resume_id}")
async def get_resume(resume_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    resume = db.find_resume(resume_id, current_user["id"])
    if not resume:
        raise HTTPException(status_code=404, detail="Резюме не найдено.")
    return resume


@router.get("/{resume_id}/preview-image")
async def preview_resume_image(
    resume_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Watermarked PNG preview — not the final PDF file."""
    resume = db.find_resume(resume_id, current_user["id"])
    if not resume:
        raise HTTPException(status_code=404, detail="Резюме не найдено.")

    founder = is_founder(current_user.get("telegram_id"))
    paid = bool(resume.get("is_paid") or founder)
    resume_data = parse_resume_data(resume["data"])
    tmpl = resume.get("template_id") or "classic"
    try:
        png_bytes = generate_preview_png(
            resume_data,
            tmpl,
            watermark=not paid,
            resolution=130 if paid else 72,
        )
    except Exception as exc:
        logger.exception("preview image failed resume_id=%s", resume_id)
        raise HTTPException(
            status_code=500,
            detail="Не удалось сформировать предпросмотр.",
        ) from exc

    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={
            "Content-Disposition": "inline; filename=preview.png",
            "Cache-Control": "private, no-store",
        },
    )


@router.get("/{resume_id}/preview-pdf")
async def preview_resume_pdf(
    resume_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """PDF до оплаты недоступен — только PNG-превью или доставка в Telegram."""
    resume = db.find_resume(resume_id, current_user["id"])
    if not resume:
        raise HTTPException(status_code=404, detail="Резюме не найдено.")

    founder = is_founder(current_user.get("telegram_id"))
    if not resume.get("is_paid") and not founder:
        raise HTTPException(
            status_code=403,
            detail="PDF доступен после оплаты. Используйте предпросмотр на экране оплаты.",
        )

    resume_data = parse_resume_data(resume["data"])
    tmpl = resume.get("template_id") or "classic"
    try:
        pdf_bytes = generate_pdf(resume_data, tmpl)
    except Exception as exc:
        logger.exception("pdf preview failed resume_id=%s", resume_id)
        raise HTTPException(
            status_code=500,
            detail="Не удалось сформировать PDF для предпросмотра.",
        ) from exc

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": "inline; filename=preview.pdf",
            "Cache-Control": "private, no-store",
        },
    )


@router.get("/{resume_id}/download")
async def download_pdf(resume_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    resume = db.find_resume(resume_id, current_user["id"])
    if not resume:
        raise HTTPException(status_code=404, detail="Резюме не найдено.")

    founder = is_founder(current_user.get("telegram_id"))
    if not resume.get("is_paid") and not founder:
        raise HTTPException(status_code=403, detail="Для скачивания PDF требуется оплата.")
    if founder and not resume.get("is_paid"):
        db.update_resume(
            resume_id,
            {"is_paid": True, "paid_at": datetime.utcnow().isoformat()},
        )

    resume_data = parse_resume_data(resume["data"])
    tmpl = resume.get("template_id") or "classic"
    try:
        pdf_bytes = generate_pdf(resume_data, tmpl)
    except Exception as exc:
        logger.exception("pdf generation failed resume_id=%s", resume_id)
        raise HTTPException(
            status_code=500,
            detail="Не удалось сформировать PDF. Попробуйте ещё раз через минуту.",
        ) from exc

    filename = f"resume_{resume_data.get('full_name', 'resume').replace(' ', '_')}.pdf"

    try:
        await send_document_to_user(
            user_telegram_id=current_user["telegram_id"],
            document=pdf_bytes,
            filename=filename,
            caption=f"Готово! Ваше резюме в PDF уже в чате. Удачи в поиске работы, {resume_data.get('full_name', '')}.",
        )
    except Exception as exc:
        logger.exception("telegram send failed resume_id=%s telegram_id=%s", resume_id, current_user.get("telegram_id"))
        raise HTTPException(
            status_code=502,
            detail="PDF готов, но не удалось отправить в Telegram. Напиши боту /start и попробуй снова.",
        ) from exc
    return {"status": "sent", "filename": filename}


VALID_TEMPLATES = frozenset({"classic", "modern", "compact"})


@router.patch("/{resume_id}/template")
async def set_resume_template(
    resume_id: str,
    body: SetTemplateRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    resume = db.find_resume(resume_id, current_user["id"])
    if not resume:
        raise HTTPException(status_code=404, detail="Резюме не найдено.")
    template_id = body.template_id.strip().lower()
    if template_id not in VALID_TEMPLATES:
        raise HTTPException(status_code=400, detail="Недопустимый шаблон.")
    db.update_resume(resume_id, {"template_id": template_id})
    return {"ok": True, "template_id": template_id}
