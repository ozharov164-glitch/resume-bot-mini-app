"""Computed resume fields for PDF/hh export (documents, achievements) — facts only."""

from __future__ import annotations

import re
from typing import Any

_SKIP_VALUES = frozenset(
    {
        "",
        "нет",
        "пропустить",
        "не указывать",
        "не указано",
        "другое",
    }
)

_PROFESSION_EXTRA_LABELS: dict[str, str] = {
    "driver_license": "Права кат.",
    "driver_experience": "Стаж за рулём",
    "guard_license": "Лицензия охранника",
    "courier_vehicle": "Транспорт",
    "painter_surfaces": "Поверхности",
    "seller_goods": "Товар",
    "seller_systems": "ПО/оборудование",
    "loader_equipment": "Складское оборудование",
    "loader_marketplace": "Маркетплейс",
    "catering_systems": "Системы общепита",
    "catering_cuisine": "Тип кухни",
    "tech_admission": "Допуски и разряды",
    "medical_spec": "Специализация",
    "edu_subject": "Предмет/направление",
}


def _norm_line(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        parts = [str(v).strip() for v in value if str(v).strip()]
        return ", ".join(parts)
    return str(value).strip()


def _should_skip_value(text: str) -> bool:
    lowered = text.strip().lower()
    return lowered in _SKIP_VALUES


def format_profession_extra_lines(profession_extra: object) -> list[str]:
    """Human-readable lines from onboarding profession_extra dict."""
    if not isinstance(profession_extra, dict):
        return []
    lines: list[str] = []
    for key, label in _PROFESSION_EXTRA_LABELS.items():
        raw = profession_extra.get(key)
        if raw is None:
            continue
        text = _norm_line(raw)
        if not text or _should_skip_value(text):
            continue
        if key == "driver_license":
            cats = text.replace(" ", "").upper()
            if cats:
                lines.append(f"{label} {cats}")
            continue
        if key == "guard_license" and "нет" in text.lower():
            continue
        lines.append(f"{label}: {text}")
    return lines


def _split_achievement_lines(raw: str) -> list[str]:
    if not raw.strip():
        return []
    parts = re.split(r"[\n•·;]+", raw)
    lines = [p.strip() for p in parts if p.strip()]
    if len(lines) == 1 and len(lines[0]) > 120:
        sentences = [s.strip() for s in re.split(r"\.\s+", lines[0]) if s.strip()]
        lines = [f"{s}." if not s.endswith(".") else s for s in sentences[:4]]
    return lines[:4]


def derive_key_achievements(resume_data: dict, user_data: dict | None = None) -> list[str]:
    """Prefer AI key_achievements; fallback to user achievements text (digits when possible)."""
    existing = resume_data.get("key_achievements")
    if isinstance(existing, list):
        cleaned = [str(x).strip() for x in existing if str(x).strip()]
        if cleaned:
            return cleaned[:4]

    user = user_data or {}
    from_user = _split_achievement_lines(str(user.get("achievements") or ""))
    if from_user:
        with_digits = [line for line in from_user if re.search(r"\d", line)]
        if with_digits:
            return with_digits[:4]
        return from_user[:4]
    return []


def build_documents_and_permits(resume_data: dict) -> list[str]:
    """Merge certificates + profession_extra; dedupe preserving order."""
    seen: set[str] = set()
    out: list[str] = []

    def add(item: str) -> None:
        key = item.strip().lower()
        if not key or key in seen:
            return
        seen.add(key)
        out.append(item.strip())

    for line in format_profession_extra_lines(resume_data.get("profession_extra")):
        add(line)

    certs = resume_data.get("certificates")
    if isinstance(certs, list):
        for cert in certs:
            add(str(cert))
    elif isinstance(certs, str) and certs.strip():
        for part in re.split(r"[\n,;]+", certs):
            add(part)

    return out


def enrich_resume_data(resume_data: dict[str, Any], user_data: dict | None = None) -> dict[str, Any]:
    """Attach display fields used by PDF templates and hh paste."""
    data = dict(resume_data)
    data["key_achievements"] = derive_key_achievements(data, user_data)
    data["documents_and_permits"] = build_documents_and_permits(data)
    return data
