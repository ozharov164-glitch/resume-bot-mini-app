from fastapi import APIRouter

from database import get_db

router = APIRouter(prefix="/api/stats", tags=["stats"])

_FALLBACK_COUNT = 1200


@router.get("/count")
async def stats_count():
    try:
        db = get_db()
        count = db.count_resumes()
        if count < 1:
            return {"count": _FALLBACK_COUNT}
        return {"count": count + _FALLBACK_COUNT}
    except Exception:
        return {"count": _FALLBACK_COUNT}
