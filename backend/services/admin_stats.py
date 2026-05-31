"""Admin-facing metrics with founder test traffic excluded."""

from __future__ import annotations

from typing import Any

from services.founder import founder_telegram_ids


def stats_exclude_telegram_ids() -> list[int]:
    """Telegram IDs whose resumes/payments are test data, not real conversions."""
    return sorted(founder_telegram_ids())


def count_paid_resumes_clean(db: Any) -> int:
    return db.count_paid_resumes(exclude_telegram_ids=stats_exclude_telegram_ids())


def count_resumes_today_clean(db: Any) -> int:
    return db.count_resumes_today(exclude_telegram_ids=stats_exclude_telegram_ids())


def get_promo_analytics_clean(db: Any) -> list[dict]:
    return db.get_promo_analytics(exclude_telegram_ids=stats_exclude_telegram_ids())
