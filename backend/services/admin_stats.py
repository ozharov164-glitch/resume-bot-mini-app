"""Admin-facing metrics with founder test traffic excluded."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from services.founder import founder_telegram_ids

FUNNEL_STEP_EVENTS: tuple[str, ...] = (
    "mini_app_opened",
    "onboarding_started",
    "generate_started",
    "template_selected",
    "preview_viewed",
    "teaser_viewed",
    "pay_clicked",
    "share_clicked",
    "adapt_clicked",
    "docx_downloaded",
)


def stats_exclude_telegram_ids() -> list[int]:
    """Telegram IDs whose resumes/payments are test data, not real conversions."""
    return sorted(founder_telegram_ids())


def _pct(numerator: int, denominator: int) -> str:
    if not denominator:
        return "0%"
    return f"{round(100 * numerator / denominator, 1)}%"


def get_admin_funnel_stats(
    db: Any,
    *,
    days: int = 7,
    include_template: bool = True,
) -> dict[str, Any]:
    """Funnel for founder admin: unique users per step, founder traffic excluded."""
    since = (datetime.utcnow() - timedelta(days=days)).isoformat()
    exclude = stats_exclude_telegram_ids()

    events = list(FUNNEL_STEP_EVENTS)
    if not include_template:
        events = [e for e in events if e != "template_selected"]

    steps: dict[str, int] = {}
    for event in events:
        steps[event] = db.count_analytics_unique_users_since(event, since, exclude)

    bot_users = db.count_users_since(since, exclude)
    payments_real = db.count_paid_resumes_since(since, exclude)
    mini_app = steps.get("mini_app_opened", 0)
    started = steps.get("onboarding_started", 0)
    previews = steps.get("preview_viewed", 0)
    pay_clicks = steps.get("pay_clicked", 0)
    shares = steps.get("share_clicked", 0)

    return {
        "period_days": days,
        "since": since,
        "bot_users": bot_users,
        **steps,
        "payments_real": payments_real,
        "payment_completed": payments_real,
        "conversion_rate": _pct(payments_real, started),
        "bot_to_mini_app_rate": _pct(mini_app, bot_users),
        "mini_app_to_onboarding_rate": _pct(started, mini_app),
        "preview_to_pay_rate": _pct(payments_real, previews),
        "pay_click_to_paid_rate": _pct(payments_real, pay_clicks),
        "share_rate": _pct(shares, previews),
        "share_clicked": shares,
        "exclude_telegram_ids": exclude,
        "metric": "unique_users",
    }


def count_users_clean(db: Any) -> int:
    """Users who pressed /start in bot, founder test accounts excluded."""
    return db.count_users(exclude_telegram_ids=stats_exclude_telegram_ids())


def count_paid_resumes_clean(db: Any) -> int:
    return db.count_paid_resumes(exclude_telegram_ids=stats_exclude_telegram_ids())


def count_resumes_today_clean(db: Any) -> int:
    return db.count_resumes_today(exclude_telegram_ids=stats_exclude_telegram_ids())


def get_promo_analytics_clean(db: Any) -> list[dict]:
    return db.get_promo_analytics(exclude_telegram_ids=stats_exclude_telegram_ids())
