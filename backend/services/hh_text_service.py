"""Plain-text resume export for hh.ru (shared by text-export and hh-text preview)."""

from __future__ import annotations

from services.pdf_service import _split_bullets


def format_hh_text(resume_data: dict) -> str:
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

    schedule = resume_data.get("work_schedule")
    if schedule:
        if isinstance(schedule, list):
            sched = ", ".join(str(s).strip() for s in schedule if str(s).strip())
        else:
            sched = str(schedule).strip()
        if sched:
            lines.append(f"График: {sched}")
    relocation = str(resume_data.get("relocation") or "").strip()
    if relocation:
        lines.append(f"Переезд: {relocation}")

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


def hh_text_preview_lines(full_text: str, *, max_lines: int = 8) -> str:
    lines = full_text.splitlines()
    return "\n".join(lines[:max_lines]).strip()
