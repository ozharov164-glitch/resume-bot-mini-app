import hmac
from fastapi import APIRouter, Depends, Header, HTTPException

from config import settings
from database import get_db
from dependencies import get_current_user
from services.founder import is_founder
from services.admin_stats import (
    count_paid_resumes_clean,
    count_resumes_today_clean,
    get_admin_funnel_stats,
    get_promo_analytics_clean,
)
from services.affiliate_service import (
    get_affiliate_stats_for_owner,
    grant_affiliate,
    list_affiliates_with_stats,
    revoke_affiliate,
)
from services.ops_metrics import snapshot as ops_snapshot
from services.redis_client import ping_redis
from services.stats_display import public_resume_count

router = APIRouter(prefix="/api/admin", tags=["admin"])


def verify_admin_key(x_admin_key: str = Header(..., alias="X-Admin-Key")) -> None:
    expected = settings.ADMIN_SECRET_KEY
    provided = x_admin_key or ""
    if len(provided) != len(expected) or not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=403, detail="Forbidden")


@router.get("/metrics", dependencies=[Depends(verify_admin_key)])
async def admin_metrics():
    """Operational counters: 429/5xx, resume_generate latency, YooKassa errors."""
    data = ops_snapshot()
    if (settings.REDIS_URL or "").strip():
        data["redis_ok"] = await ping_redis()
    return data


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
    if owner_tg_id is not None:
        db.set_user_affiliate(owner_tg_id, is_affiliate=True)
    return {"ok": True, "promo": promo}


@router.get("/promos/analytics", dependencies=[Depends(verify_admin_key)])
async def promo_analytics(db=Depends(get_db)):
    try:
        return {"promos": get_promo_analytics_clean(db)}
    except Exception:
        return {"promos": []}


@router.get("/promos/activations", dependencies=[Depends(verify_admin_key)])
async def promo_activations(db=Depends(get_db), limit: int = 20):
    try:
        return {"activations": db.list_recent_promo_activations(min(limit, 50))}
    except Exception:
        return {"activations": []}


@router.get("/funnel")
async def admin_funnel(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    if not is_founder(current_user.get("telegram_id")):
        raise HTTPException(status_code=403, detail="Доступ только для founder.")
    return get_admin_funnel_stats(db, days=7, include_template=False)


@router.get("/funnel-key", dependencies=[Depends(verify_admin_key)])
async def admin_funnel_by_key(db=Depends(get_db)):
    return get_admin_funnel_stats(db, days=7, include_template=True)


@router.get("/stats", dependencies=[Depends(verify_admin_key)])
async def admin_stats(db=Depends(get_db)):
    try:
        count = public_resume_count(db)
        paid_count = count_paid_resumes_clean(db)
        today_count = count_resumes_today_clean(db)
    except Exception:
        count = paid_count = today_count = 0
    try:
        referred = db.count_referred_users()
    except Exception:
        referred = 0
    return {
        "count": count,
        "paid_count": paid_count,
        "today_count": today_count,
        "users": db.count_users(),
        "referred": referred,
    }


@router.get("/referrers", dependencies=[Depends(verify_admin_key)])
async def admin_referrers(db=Depends(get_db), limit: int = 10):
    try:
        return {"referrers": db.top_referrers(min(limit, 50))}
    except Exception:
        return {"referrers": []}


@router.get("/affiliates", dependencies=[Depends(verify_admin_key)])
async def admin_affiliates(db=Depends(get_db)):
    try:
        return {"affiliates": list_affiliates_with_stats(db)}
    except Exception:
        return {"affiliates": []}


@router.get("/affiliates/{telegram_id}", dependencies=[Depends(verify_admin_key)])
async def admin_affiliate_detail(telegram_id: int, db=Depends(get_db)):
    from services.admin_stats import stats_exclude_telegram_ids

    stats = get_affiliate_stats_for_owner(
        db, telegram_id, exclude_telegram_ids=stats_exclude_telegram_ids()
    )
    if not stats:
        raise HTTPException(status_code=404, detail="Affiliate not found")
    return {"affiliate": stats}


@router.post("/affiliates", dependencies=[Depends(verify_admin_key)])
async def create_affiliate(body: dict, db=Depends(get_db)):
    telegram_id = body.get("telegram_id")
    code = str(body.get("code", "")).strip()
    if telegram_id is None:
        raise HTTPException(status_code=400, detail="telegram_id is required")
    if not code:
        raise HTTPException(status_code=400, detail="code is required")
    discount = int(body.get("discount", 10))
    max_uses = int(body.get("max_uses", 100))
    try:
        result = grant_affiliate(
            db,
            telegram_id=int(telegram_id),
            code=code,
            discount=discount,
            max_uses=max_uses,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"ok": True, **result}


@router.post("/affiliates/revoke", dependencies=[Depends(verify_admin_key)])
async def revoke_affiliate_admin(body: dict, db=Depends(get_db)):
    telegram_id = body.get("telegram_id")
    if telegram_id is None:
        raise HTTPException(status_code=400, detail="telegram_id is required")
    try:
        result = revoke_affiliate(db, int(telegram_id))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, **result}
