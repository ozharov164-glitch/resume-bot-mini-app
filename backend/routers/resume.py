import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from database import get_db
from dependencies import get_current_user
from models.schemas import GenerateResumeRequest, ResumeGenerationResponse, SetTemplateRequest
from services.ai_service import generate_resume
from services.name_format import build_full_name
from services.resume_schema import normalize_resume_data
from services.founder import is_founder
from services.hh_text_service import format_hh_text, hh_text_preview_lines
from services.payment_fulfillment import parse_resume_data
from services.share_image_service import generate_share_banner
from services.pdf_async import PdfGenerationTimeoutError, generate_pdf_async
from services.pdf_service import generate_preview_png
from services.rate_limiter import RateLimitExceeded, check_rate_limit
from services.telegram_service import send_document_to_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/resume", tags=["resume"])

VALID_TEMPLATES = frozenset({"classic", "modern", "compact"})


class AdaptVacancyRequest(BaseModel):
    vacancy_text: str = Field(min_length=20, max_length=4000)


def _as_str(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _build_full_name(name: str, patronymic: str = "") -> str:
    return build_full_name(_as_str(name), _as_str(patronymic))


def _apply_user_meta_to_resume(resume_data: dict, user_data: GenerateResumeRequest | dict) -> None:
    raw = user_data.model_dump() if hasattr(user_data, "model_dump") else dict(user_data)
    for key in ("work_schedule", "relocation"):
        value = raw.get(key)
        if value:
            resume_data[key] = value
    profession_extra = raw.get("profession_extra")
    if profession_extra:
        resume_data["profession_extra"] = profession_extra


def _normalize_resume_fields(resume_data: dict) -> dict:
    """AI JSON may return numbers/strings — normalize for PDF, API, and Mini App."""
    return normalize_resume_data(resume_data)


@router.post("/generate", response_model=ResumeGenerationResponse)
async def create_resume(
    user_data: GenerateResumeRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    try:
        check_rate_limit("resume_generate", current_user.get("telegram_id"))
    except RateLimitExceeded as exc:
        return JSONResponse(
            status_code=429,
            content={
                "error": "rate_limit",
                "retry_after_hours": exc.retry_after_hours,
                "message": "Лимит запросов исчерпан",
            },
        )
    try:
        resume_data = await generate_resume(user_data.model_dump())
        resume_data = _normalize_resume_fields(resume_data)
        user_full_name = _build_full_name(user_data.name, user_data.patronymic)
        if user_full_name:
            resume_data["full_name"] = user_full_name
        salary_user = _as_str(user_data.salary)
        if salary_user and not _as_str(resume_data.get("salary")):
            resume_data["salary"] = salary_user
        certs_user = _as_str(user_data.certificates)
        if certs_user and not resume_data.get("certificates"):
            resume_data["certificates"] = [
                c.strip() for c in certs_user.replace("\n", ",").split(",") if c.strip()
            ]
        _apply_user_meta_to_resume(resume_data, user_data)
        hh_text = format_hh_text(resume_data)
        resume_id = str(uuid.uuid4())
        founder = is_founder(current_user.get("telegram_id"))
        bonus = db.get_referral_bonus(current_user["telegram_id"])
        is_paid_by_bonus = bonus > 0 and db.use_referral_bonus(current_user["telegram_id"])
        is_paid = founder or is_paid_by_bonus
        template_id = (user_data.template_id or "classic").strip().lower()
        if template_id not in VALID_TEMPLATES:
            template_id = "classic"
        db.create_resume(
            {
                "id": resume_id,
                "user_id": current_user["id"],
                "data": resume_data,
                "user_answers": user_data.model_dump(),
                "is_paid": is_paid,
                "template_id": template_id,
                "hh_text": hh_text,
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
            pdf_bytes = await generate_pdf_async(resume_data, template_id)
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
        raise HTTPException(status_code=500, detail="Не удалось сгенерировать резюме. Попробуйте ещё раз.") from exc


@router.get("/list")
async def list_resumes(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
    limit: int = 30,
):
    items = db.list_resumes_for_user(current_user["id"], min(limit, 50))
    return {"items": items}


@router.delete("/history")
async def clear_resume_history(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    deleted = db.delete_all_resumes_for_user(current_user["id"])
    logger.info(
        "resume history cleared user_id=%s deleted=%s",
        current_user.get("id"),
        deleted,
    )
    return {"ok": True, "deleted": deleted}


@router.get("/{resume_id}")
async def get_resume(resume_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    resume = db.find_resume(resume_id, current_user["id"])
    if not resume:
        raise HTTPException(status_code=404, detail="Резюме не найдено.")
    return resume


@router.get("/{resume_id}/hh-text")
async def resume_hh_text(
    resume_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    resume = db.find_resume(resume_id, current_user["id"])
    if not resume:
        raise HTTPException(status_code=404, detail="Резюме не найдено.")

    founder = is_founder(current_user.get("telegram_id"))
    paid = bool(resume.get("is_paid") or founder)
    full_text = (resume.get("hh_text") or "").strip()
    if not full_text:
        resume_data = parse_resume_data(resume["data"])
        full_text = format_hh_text(resume_data)

    if paid:
        return {"text": full_text, "is_paid": True}

    preview = hh_text_preview_lines(full_text, max_lines=8)
    return {"preview": preview, "is_paid": False}


@router.get("/{resume_id}/share-image")
async def resume_share_image(
    resume_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    resume = db.find_resume(resume_id, current_user["id"])
    if not resume:
        raise HTTPException(status_code=404, detail="Резюме не найдено.")
    if not resume.get("is_paid") and not is_founder(current_user.get("telegram_id")):
        raise HTTPException(status_code=403, detail="Доступно после оплаты.")

    resume_data = parse_resume_data(resume["data"])
    try:
        png_bytes = generate_share_banner(
            full_name=str(resume_data.get("full_name") or ""),
            target_position=str(resume_data.get("target_position") or ""),
        )
    except Exception as exc:
        logger.exception("share image failed resume_id=%s", resume_id)
        raise HTTPException(status_code=500, detail="Не удалось сформировать баннер.") from exc

    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={
            "Content-Disposition": "inline; filename=share.png",
            "Cache-Control": "private, no-store",
        },
    )


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
            watermark=False,
            resolution=130 if paid else 96,
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
        pdf_bytes = await generate_pdf_async(resume_data, tmpl)
    except PdfGenerationTimeoutError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "pdf_timeout",
                "message": "Генерация PDF заняла слишком много времени. Попробуйте ещё раз.",
            },
        ) from exc
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


@router.post("/{resume_id}/adapt")
async def adapt_resume(
    resume_id: str,
    body: AdaptVacancyRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    """Store vacancy text for paid adaptation (invoice via /api/payment/create-adapt-invoice)."""
    resume = db.find_resume(resume_id, current_user["id"])
    if not resume:
        raise HTTPException(status_code=404, detail="Резюме не найдено.")
    if not resume.get("is_paid") and not is_founder(current_user.get("telegram_id")):
        raise HTTPException(status_code=403, detail="Адаптация доступна после оплаты резюме.")

    answers = resume.get("user_answers") or {}
    if isinstance(answers, str):
        import json as _json

        try:
            answers = _json.loads(answers)
        except _json.JSONDecodeError:
            answers = {}
    if not isinstance(answers, dict):
        answers = {}
    answers["_pending_adapt_vacancy"] = body.vacancy_text.strip()
    db.update_resume(resume_id, {"user_answers": answers})
    return {"ok": True, "resume_id": resume_id}


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
        pdf_bytes = await generate_pdf_async(resume_data, tmpl)
    except PdfGenerationTimeoutError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "pdf_timeout",
                "message": "Генерация PDF заняла слишком много времени. Попробуйте ещё раз.",
            },
        ) from exc
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
            detail="PDF готов, но не удалось отправить в Telegram. Напишите боту /start и попробуйте снова.",
        ) from exc
    return {"status": "sent", "filename": filename}



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
