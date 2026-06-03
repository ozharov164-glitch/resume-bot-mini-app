"""Normalize AI/user resume JSON to stable shapes for API, PDF, and Mini App."""

from __future__ import annotations

from typing import Any

from services.name_format import capitalize_person_name
from services.resume_enrichment import enrich_resume_data


def _as_str(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _as_str_list(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [s for item in value if (s := _as_str(item))]
    if isinstance(value, str):
        parts = [p.strip() for p in value.replace("\n", ",").split(",")]
        return [p for p in parts if p]
    return []


def _normalize_experience(value: object) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    out: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        out.append(
            {
                "company": _as_str(item.get("company")),
                "position": _as_str(item.get("position")),
                "period": _as_str(item.get("period")),
                "description": _as_str(item.get("description")),
            }
        )
    return out


def _normalize_education(value: object) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    out: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        out.append(
            {
                "institution": _as_str(item.get("institution")),
                "degree": _as_str(item.get("degree")),
                "year": _as_str(item.get("year")),
            }
        )
    return out


def normalize_resume_data(resume_data: dict[str, Any]) -> dict[str, Any]:
    """Coerce lists/scalars so PDF renderer and Mini App never crash on bad AI shapes."""
    data = dict(resume_data)
    data["full_name"] = capitalize_person_name(_as_str(data.get("full_name")))
    data["target_position"] = _as_str(data.get("target_position"))
    data["city"] = _as_str(data.get("city"))
    data["phone"] = _as_str(data.get("phone"))
    data["email"] = _as_str(data.get("email"))
    data["summary"] = _as_str(data.get("summary"))
    data["salary"] = _as_str(data.get("salary"))
    data["skills"] = _as_str_list(data.get("skills"))
    data["languages"] = _as_str_list(data.get("languages")) or ["Русский — родной"]
    data["certificates"] = _as_str_list(data.get("certificates"))
    data["experience"] = _normalize_experience(data.get("experience"))
    data["education"] = _normalize_education(data.get("education"))
    if data.get("work_schedule") is not None:
        data["work_schedule"] = _as_str_list(data.get("work_schedule"))
    if data.get("relocation") is not None:
        data["relocation"] = _as_str(data.get("relocation"))
    if isinstance(data.get("key_achievements"), list):
        data["key_achievements"] = _as_str_list(data.get("key_achievements"))
    else:
        data["key_achievements"] = []
    if isinstance(data.get("documents_and_permits"), list):
        data["documents_and_permits"] = _as_str_list(data.get("documents_and_permits"))
    else:
        data["documents_and_permits"] = []
    if data.get("profession_extra") is not None and isinstance(data.get("profession_extra"), dict):
        data["profession_extra"] = dict(data["profession_extra"])
    return enrich_resume_data(data)
