"""Telegram Stars invoice payload — compact, ≤128 bytes, safe charset."""

from __future__ import annotations

import json
import re

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
_MAX_BYTES = 128


def encode_invoice_payload(
    resume_id: str,
    *,
    payment_type: str = "single_pdf",
    bonus_stars_applied: int = 0,
) -> str:
    """Format: r=<uuid>&t=s|a&b=<bonus>. Telegram rejects long JSON payloads."""
    rid = resume_id.strip()
    if not _UUID_RE.match(rid):
        raise ValueError(f"invalid resume_id: {resume_id!r}")
    type_code = "a" if payment_type == "adapt" else "s"
    bonus = max(0, int(bonus_stars_applied))
    payload = f"r={rid}&t={type_code}&b={bonus}"
    if len(payload.encode("utf-8")) > _MAX_BYTES:
        raise ValueError("invoice payload exceeds Telegram 128-byte limit")
    return payload


def parse_invoice_payload(raw: str) -> dict:
    """Parse compact or legacy JSON invoice payloads from successful_payment."""
    text = (raw or "").strip()
    if not text:
        return {}

    if text.startswith("{"):
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return {}
        resume_id = str(data.get("resume_id") or "").strip()
        if resume_id and not _UUID_RE.match(resume_id):
            return {}
        return {
            "resume_id": resume_id,
            "type": str(data.get("type") or "single_pdf"),
            "bonus_stars_applied": int(data.get("bonus_stars_applied") or 0),
        }

    parts: dict[str, str] = {}
    for segment in text.split("&"):
        if "=" not in segment:
            continue
        key, value = segment.split("=", 1)
        parts[key.strip()] = value.strip()

    resume_id = parts.get("r", "").strip()
    if resume_id and not _UUID_RE.match(resume_id):
        return {}
    type_code = parts.get("t", "s").lower()
    try:
        bonus = int(parts.get("b", "0") or 0)
    except ValueError:
        bonus = 0

    return {
        "resume_id": resume_id,
        "type": "adapt" if type_code == "a" else "single_pdf",
        "bonus_stars_applied": max(0, bonus),
    }
