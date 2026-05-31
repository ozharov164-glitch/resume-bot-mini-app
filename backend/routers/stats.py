from fastapi import APIRouter

from database import get_db
from services.stats_display import public_resume_count

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/count")
async def stats_count():
    from services.stats_display import DISPLAY_COUNT_FLOOR

    try:
        db = get_db()
        count = public_resume_count(db)
        paid_count = db.count_paid_resumes()
        today_count = db.count_resumes_today()
        return {"count": count, "paid_count": paid_count, "today_count": today_count}
    except Exception:
        return {"count": DISPLAY_COUNT_FLOOR, "paid_count": 0, "today_count": 0}
