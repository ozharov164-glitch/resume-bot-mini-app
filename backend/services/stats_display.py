"""Public resume count for bot and API."""

from __future__ import annotations

from typing import Any

DISPLAY_COUNT_FLOOR = 5000
_COUNT_OFFSET = 1200
_COUNT_FALLBACK = DISPLAY_COUNT_FLOOR


def public_resume_count(db: Any | None = None) -> int:
    """Resume count for marketing: DB + offset, never below floor."""
    if db is None:
        from database import get_db

        db = get_db()
    try:
        raw = db.count_resumes()
        if raw < 1:
            return _COUNT_FALLBACK
        return max(raw + _COUNT_OFFSET, DISPLAY_COUNT_FLOOR)
    except Exception:
        return _COUNT_FALLBACK


def format_count(count: int) -> str:
    return f"{count:,}".replace(",", " ")
