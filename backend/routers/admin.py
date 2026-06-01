from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException

from config import settings
from database import get_db
from dependencies import get_current_user
from services.founder import is_founder
from services.admin_stats import (
    count_paid_resumes_clean,
    count_resumes_today_clean,
    get_promo_analytics_clean,
)
from services.affiliate_service import (
    get_affiliate_stats_for_owner,
    grant_affiliate,
    list_affiliates_with_stats,
    revoke_affiliate,
)
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

    since = (datetime.utcnow() - timedelta(days=7)).isoformat()
    steps = {
        "onboarding_started": db.count_analytics_events_since("onboarding_started", since),
        "generate_started": db.count_analytics_events_since("generate_started", since),
        "preview_viewed": db.count_analytics_events_since("preview_viewed", since),
        "pay_clicked": db.count_analytics_events_since("pay_clicked", since),
        "payment_completed": db.count_analytics_events_since("payment_completed", since),
    }
    started = steps["onboarding_started"] or 0
    completed = steps["payment_completed"] or 0
    conversion = f"{round(100 * completed / started, 1)}%" if started else "0%"
    return {**steps, "conversion_rate": conversion}


@router.get("/funnel-key", dependencies=[Depends(verify_admin_key)])
async def admin_funnel_by_key(db=Depends(get_db)):
    since = (datetime.utcnow() - timedelta(days=7)).isoformat()
    steps = {
        "onboarding_started": db.count_analytics_events_since("onboarding_started", since),
        "generate_started": db.count_analytics_events_since("generate_started", since),
        "preview_viewed": db.count_analytics_events_since("preview_viewed", since),
        "pay_clicked": db.count_analytics_events_since("pay_clicked", since),
        "payment_completed": db.count_analytics_events_since("payment_completed", since),
    }
    started = steps["onboarding_started"] or 1
    completed = steps["payment_completed"] or 0
    conversion = round(100 * completed / started, 1)
    return {**steps, "conversion_rate": f"{conversion}%"}


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
