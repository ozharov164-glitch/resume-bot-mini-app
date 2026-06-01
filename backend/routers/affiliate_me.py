"""Affiliate self-service stats for traffickers (/cabinet in bot)."""

from fastapi import APIRouter, Depends, HTTPException

from database import get_db
from dependencies import get_current_user
from services.affiliate_service import get_affiliate_stats_for_owner
from services.admin_stats import stats_exclude_telegram_ids

router = APIRouter(prefix="/api/affiliate", tags=["affiliate"])


@router.get("/me")
async def affiliate_me(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    tid = int(current_user["telegram_id"])
    if not db.is_user_affiliate(tid):
        raise HTTPException(status_code=403, detail="Доступ только для трафферов.")
    stats = get_affiliate_stats_for_owner(
        db, tid, exclude_telegram_ids=stats_exclude_telegram_ids()
    )
    if not stats:
        raise HTTPException(status_code=404, detail="Статистика недоступна.")
    return {"affiliate": stats}
