import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse

from dependencies import get_current_user
from database import get_db
from services.payment_fulfillment import parse_resume_data

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/resume", tags=["export"])


def _format_text_export(resume_data: dict) -> str:
    lines: list[str] = []

    full_name = str(resume_data.get("full_name") or "").strip()
    lines.append(f"=== {full_name or 'ФИО'} ===")
    if resume_data.get("target_position"):
        lines.append(f"Должность: {resume_data['target_position']}")
    city = str(resume_data.get("city") or "").strip()
    salary = str(resume_data.get("salary") or "").strip()
    if city or salary:
        parts = []
        if city:
            parts.append(f"Город: {city}")
        if salary:
            parts.append(f"Зарплата: {salary}")
        lines.append(" | ".join(parts))
    phone = str(resume_data.get("phone") or "").strip()
    email = str(resume_data.get("email") or "").strip()
    if phone or email:
        contact = []
        if phone:
            contact.append(f"Телефон: {phone}")
        if email:
            contact.append(f"Email: {email}")
        lines.append(" | ".join(contact))

    lines.append("")
    lines.append("=== О СЕБЕ ===")
    lines.append(str(resume_data.get("summary") or "").strip() or "—")

    experience = resume_data.get("experience") or []
    if experience:
        lines.append("")
        lines.append("=== ОПЫТ РАБОТЫ ===")
        for job in experience:
            if not isinstance(job, dict):
                continue
            company = str(job.get("company") or "").strip()
            position = str(job.get("position") or "").strip()
            period = str(job.get("period") or "").strip()
            header = " — ".join(p for p in (company, position) if p)
            if period:
                header = f"{header} ({period})" if header else f"({period})"
            if header:
                lines.append(header)
            desc = str(job.get("description") or "").strip()
            if desc:
                from services.pdf_service import _split_bullets

                for bullet in _split_bullets(desc):
                    lines.append(f"• {bullet}")

    education = resume_data.get("education") or []
    if education:
        lines.append("")
        lines.append("=== ОБРАЗОВАНИЕ ===")
        for edu in education:
            if not isinstance(edu, dict):
                continue
            inst = str(edu.get("institution") or "").strip()
            degree = str(edu.get("degree") or "").strip()
            year = str(edu.get("year") or "").strip()
            chunk = ", ".join(p for p in (inst, degree, year) if p)
            if chunk:
                lines.append(chunk)

    skills = resume_data.get("skills") or []
    if skills:
        lines.append("")
        lines.append("=== НАВЫКИ ===")
        lines.append(", ".join(str(s).strip() for s in skills if str(s).strip()))

    languages = resume_data.get("languages") or []
    if languages:
        lines.append("")
        lines.append("=== ЯЗЫКИ ===")
        lines.append(", ".join(str(lang).strip() for lang in languages if str(lang).strip()))

    return "\n".join(lines).strip() + "\n"


@router.get("/{resume_id}/text-export", response_class=PlainTextResponse)
async def text_export(
    resume_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    resume = db.find_resume(resume_id, current_user["id"])
    if not resume:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": "Резюме не найдено."},
        )
    try:
        resume_data = parse_resume_data(resume["data"])
    except (ValueError, TypeError) as exc:
        logger.exception("text export parse failed resume_id=%s", resume_id)
        raise HTTPException(
            status_code=500,
            detail={"error": "invalid_data", "message": "Не удалось прочитать резюме."},
        ) from exc

    return PlainTextResponse(
        _format_text_export(resume_data),
        media_type="text/plain; charset=utf-8",
    )
