import json
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/analytics", tags=["analytics"])


class AnalyticsEventBody(BaseModel):
    event: str = Field(min_length=1, max_length=80)
    telegram_id: int | str
    step: int | None = None
    metadata: dict | None = None


@router.post("/event")
async def track_event(body: AnalyticsEventBody, db=Depends(get_db)):
    try:
        tid = int(body.telegram_id)
    except (TypeError, ValueError):
        return {"ok": False}

    meta_json = json.dumps(body.metadata or {}, ensure_ascii=False)
    db.insert_analytics_event(
        {
            "id": str(uuid.uuid4()),
            "event": body.event.strip(),
            "telegram_id": tid,
            "step": body.step,
            "metadata": meta_json,
            "created_at": datetime.utcnow().isoformat(),
        }
    )
    return {"ok": True}
