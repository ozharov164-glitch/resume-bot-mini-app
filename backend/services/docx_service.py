"""ATS-friendly DOCX export (single column, system fonts)."""

from __future__ import annotations

import io
import re
from typing import Any

from docx import Document
from docx.shared import Pt

from services.resume_text_utils import split_bullets


def _add_heading(doc: Document, text: str) -> None:
    p = doc.add_paragraph()
    run = p.add_run(text.upper())
    run.bold = True
    run.font.size = Pt(11)
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(4)


def _add_bullets(doc: Document, items: list[str]) -> None:
    for item in items:
        text = str(item).strip()
        if text:
            doc.add_paragraph(text, style="List Bullet")


def generate_docx_bytes(resume_data: dict[str, Any]) -> bytes:
    """Build a plain DOCX matching resume_data (no tables/columns)."""
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(11)

    name = str(resume_data.get("full_name") or "").strip()
    if name:
        title = doc.add_paragraph()
        run = title.add_run(name)
        run.bold = True
        run.font.size = Pt(16)

    position = str(resume_data.get("target_position") or "").strip()
    if position:
        sub = doc.add_paragraph(position)
        sub.runs[0].bold = True

    meta_parts: list[str] = []
    for label, key in (
        ("Город", "city"),
        ("Телефон", "phone"),
        ("Email", "email"),
        ("Зарплата", "salary"),
    ):
        val = str(resume_data.get(key) or "").strip()
        if val:
            if key == "salary" and not re.search(r"₽|руб", val, re.I):
                val = f"{val} ₽/мес"
            meta_parts.append(f"{label}: {val}")
    schedule = resume_data.get("work_schedule")
    if schedule:
        if isinstance(schedule, list):
            sched = ", ".join(str(s).strip() for s in schedule if str(s).strip())
        else:
            sched = str(schedule).strip()
        if sched:
            meta_parts.append(f"График: {sched}")
    relocation = str(resume_data.get("relocation") or "").strip()
    if relocation:
        meta_parts.append(f"Переезд: {relocation}")
    if meta_parts:
        doc.add_paragraph(" · ".join(meta_parts))

    summary = str(resume_data.get("summary") or "").strip()
    if summary:
        _add_heading(doc, "О себе")
        doc.add_paragraph(summary)

    achievements = resume_data.get("key_achievements") or []
    if isinstance(achievements, list) and achievements:
        _add_heading(doc, "Ключевые достижения")
        _add_bullets(doc, [str(a) for a in achievements])

    skills = resume_data.get("skills") or []
    if skills:
        _add_heading(doc, "Навыки")
        doc.add_paragraph(", ".join(str(s).strip() for s in skills if str(s).strip()))

    experience = resume_data.get("experience") or []
    if experience:
        _add_heading(doc, "Опыт работы")
        for job in experience:
            if not isinstance(job, dict):
                continue
            company = str(job.get("company") or "").strip()
            position_j = str(job.get("position") or "").strip()
            period = str(job.get("period") or "").strip()
            header = " — ".join(p for p in (company, position_j) if p)
            if period:
                header = f"{header} ({period})" if header else period
            if header:
                p = doc.add_paragraph()
                p.add_run(header).bold = True
            desc = str(job.get("description") or "").strip()
            if desc:
                _add_bullets(doc, split_bullets(desc))

    education = resume_data.get("education") or []
    if education:
        _add_heading(doc, "Образование")
        for edu in education:
            if not isinstance(edu, dict):
                continue
            chunk = ", ".join(
                p
                for p in (
                    str(edu.get("institution") or "").strip(),
                    str(edu.get("degree") or "").strip(),
                    str(edu.get("year") or "").strip(),
                )
                if p and p != "0"
            )
            if chunk:
                doc.add_paragraph(chunk)

    languages = resume_data.get("languages") or []
    if languages:
        _add_heading(doc, "Языки")
        doc.add_paragraph(", ".join(str(lang).strip() for lang in languages if str(lang).strip()))

    docs = resume_data.get("documents_and_permits") or []
    if isinstance(docs, list) and docs:
        _add_heading(doc, "Сертификаты и документы")
        _add_bullets(doc, [str(d) for d in docs])

    buffer = io.BytesIO()
    doc.save(buffer)
    return buffer.getvalue()
