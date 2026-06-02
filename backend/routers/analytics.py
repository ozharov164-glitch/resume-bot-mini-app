import json
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import get_db
from dependencies import get_current_user
from services.rate_limiter import RateLimitExceeded, check_rate_limit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/analytics", tags=["analytics"])

_ALLOWED_EVENTS = frozenset(
    {
        "onboarding_started",
        "step_completed",
        "generate_started",
        "skills_confirmed",
        "template_selected",
        "preview_viewed",
        "pay_clicked",
        "payment_completed",
        "share_clicked",
        "share_banner_downloaded",
        "text_exported",
        "bonus_applied",
        "adapt_purchased",
        "pdf_resent",
    }
)


class AnalyticsEventBody(BaseModel):
    event: str = Field(min_length=1, max_length=80)
    telegram_id: int | str
    step: int | str | None = None
    metadata: dict | None = None


@router.post("/event")
async def track_event(
    body: AnalyticsEventBody,
    db=Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    event_name = body.event.strip()
    if event_name not in _ALLOWED_EVENTS:
        raise HTTPException(status_code=400, detail="Unknown event.")

    try:
        claimed_tid = int(body.telegram_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid telegram_id.")

    if int(current_user.get("telegram_id")) != claimed_tid:
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        await check_rate_limit("analytics_event", claimed_tid)
    except RateLimitExceeded as exc:
        return {
            "ok": False,
            "error": "rate_limit",
            "retry_after_hours": exc.retry_after_hours,
        }

    meta = dict(body.metadata or {})
    if body.step is not None and "step" not in meta:
        meta["step"] = body.step
    meta_json = json.dumps(meta, ensure_ascii=False)
    step_value = body.step
    step_db: int | None = None
    if isinstance(step_value, int):
        step_db = step_value
    elif isinstance(step_value, str) and step_value.isdigit():
        step_db = int(step_value)
    db.insert_analytics_event(
        {
            "id": str(uuid.uuid4()),
            "event": event_name,
            "telegram_id": claimed_tid,
            "step": step_db,
            "metadata": meta_json,
            "created_at": datetime.utcnow().isoformat(),
        }
    )
    return {"ok": True}
