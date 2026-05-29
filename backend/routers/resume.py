import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from database import get_db
from dependencies import get_current_user
from models.schemas import GenerateResumeRequest, ResumeGenerationResponse
from services.ai_service import generate_resume
from services.pdf_service import generate_pdf
from services.telegram_service import send_document_to_user

router = APIRouter(prefix="/api/resume", tags=["resume"])


@router.post("/generate", response_model=ResumeGenerationResponse)
async def create_resume(user_data: GenerateResumeRequest, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    try:
        resume_data = await generate_resume(user_data.model_dump())
        resume_id = str(uuid.uuid4())
        db.table("resumes").insert(
            {
                "id": resume_id,
                "user_id": current_user["id"],
                "data": resume_data,
                "user_answers": user_data.model_dump(),
                "is_paid": False,
                "created_at": datetime.utcnow().isoformat(),
            }
        ).execute()
        return ResumeGenerationResponse(resume_id=resume_id, resume=resume_data, paid=False)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Не удалось сгенерировать резюме. Попробуйте еще раз.") from exc


@router.get("/{resume_id}")
async def get_resume(resume_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    result = (
        db.table("resumes")
        .select("*")
        .eq("id", resume_id)
        .eq("user_id", current_user["id"])
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Резюме не найдено.")
    return result.data[0]


@router.get("/{resume_id}/download")
async def download_pdf(resume_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    result = (
        db.table("resumes")
        .select("*")
        .eq("id", resume_id)
        .eq("user_id", current_user["id"])
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Резюме не найдено.")

    resume = result.data[0]
    if not resume.get("is_paid"):
        raise HTTPException(status_code=403, detail="Для скачивания PDF требуется оплата.")

    resume_data = resume["data"] if isinstance(resume["data"], dict) else json.loads(resume["data"])
    pdf_bytes = generate_pdf(resume_data)
    filename = f"resume_{resume_data.get('full_name', 'resume').replace(' ', '_')}.pdf"

    await send_document_to_user(
        user_telegram_id=current_user["telegram_id"],
        document=pdf_bytes,
        filename=filename,
        caption=f"Готово! Ваше резюме в PDF уже в чате. Удачи в поиске работы, {resume_data.get('full_name', '')}.",
    )
    return {"status": "sent", "filename": filename}
