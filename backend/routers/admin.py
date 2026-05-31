from fastapi import APIRouter, Depends, Header, HTTPException

from config import settings
from database import get_db
from services.stats_display import public_resume_count

router = APIRouter(prefix="/api/admin", tags=["admin"])


def verify_admin_key(x_admin_key: str = Header(..., alias="X-Admin-Key")) -> None:
    if x_admin_key != settings.ADMIN_SECRET_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")


@router.get("/promos", dependencies=[Depends(verify_admin_key)])
async def list_promos(db=Depends(get_db)):
    return {"promos": db.list_promo_codes()}


@router.post("/promos", dependencies=[Depends(verify_admin_key)])
async def create_promo(body: dict, db=Depends(get_db)):
    code = str(body.get("code", "")).strip()
    if not code:
        raise HTTPException(status_code=400, detail="code is required")
    discount = int(body.get("discount", 10))
    max_uses = int(body.get("max_uses", 100))
    owner_tg_id = body.get("owner_tg_id")
    if owner_tg_id is not None:
        owner_tg_id = int(owner_tg_id)
    promo = db.create_promo_code(
        code,
        owner_tg_id=owner_tg_id,
        discount=discount,
        max_uses=max_uses,
    )
    return {"ok": True, "promo": promo}


@router.get("/stats", dependencies=[Depends(verify_admin_key)])
async def admin_stats(db=Depends(get_db)):
    try:
        count = public_resume_count(db)
        paid_count = db.count_paid_resumes()
        today_count = db.count_resumes_today()
    except Exception:
        count = paid_count = today_count = 0
    return {
        "count": count,
        "paid_count": paid_count,
        "today_count": today_count,
        "users": db.count_users(),
    }
