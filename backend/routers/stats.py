from fastapi import APIRouter, Depends

from database import get_db

router = APIRouter(prefix="/api/stats", tags=["stats"])

_FALLBACK_COUNT = 1200


@router.get("/count")
async def stats_count(db=Depends(get_db)):
    try:
        result = db.table("resumes").select("id", count="exact").execute()
        count = result.count if result.count is not None else len(result.data or [])
        if count < 1:
            return {"count": _FALLBACK_COUNT}
        return {"count": count + _FALLBACK_COUNT}
    except Exception:
        return {"count": _FALLBACK_COUNT}
