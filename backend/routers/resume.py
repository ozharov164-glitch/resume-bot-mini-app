import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from database import get_db
from dependencies import get_current_user
from models.schemas import GenerateResumeRequest, ResumeGenerationResponse
from services.ai_service import generate_resume
from services.founder import is_founder
from services.payment_fulfillment import parse_resume_data
from services.pdf_service import generate_pdf
from services.telegram_service import send_document_to_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/resume", tags=["resume"])


@router.post("/generate", response_model=ResumeGenerationResponse)
async def create_resume(
    user_data: GenerateResumeRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    try:
        resume_data = await generate_resume(user_data.model_dump())
        salary_user = (user_data.salary or "").strip()
        if salary_user and not (resume_data.get("salary") or "").strip():
            resume_data["salary"] = salary_user
        certs_user = (user_data.certificates or "").strip()
        if certs_user and not resume_data.get("certificates"):
            resume_data["certificates"] = [
                c.strip() for c in certs_user.replace("\n", ",").split(",") if c.strip()
            ]
        resume_id = str(uuid.uuid4())
        founder = is_founder(current_user.get("telegram_id"))
        db.create_resume(
            {
                "id": resume_id,
                "user_id": current_user["id"],
                "data": resume_data,
                "user_answers": user_data.model_dump(),
                "is_paid": founder,
                "created_at": datetime.utcnow().isoformat(),
            }
        )
        if founder:
            logger.info(
                "founder resume generated telegram_id=%s resume_id=%s",
                current_user.get("telegram_id"),
                resume_id,
            )
        return ResumeGenerationResponse(resume_id=resume_id, resume=resume_data, paid=founder)
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
    try:
        pdf_bytes = generate_pdf(resume_data)
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
