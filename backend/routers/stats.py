from fastapi import APIRouter

from database import get_db
from services.stats_display import public_resume_count

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/count")
async def stats_count():
    try:
        return {"count": public_resume_count(get_db())}
    except Exception:
        from services.stats_display import DISPLAY_COUNT_FLOOR

        return {"count": DISPLAY_COUNT_FLOOR}
