"""User-facing stats (referral program)."""

from fastapi import APIRouter, Depends

from database import get_db
from dependencies import get_current_user

router = APIRouter(prefix="/api/user", tags=["user"])


@router.get("/referral-stats")
async def referral_stats(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    tid = int(current_user["telegram_id"])
    stats = db.get_referral_stats(tid)
    return stats
