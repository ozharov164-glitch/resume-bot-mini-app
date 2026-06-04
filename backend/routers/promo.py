from fastapi import APIRouter, Depends, HTTPException

from database import get_db
from dependencies import get_current_user
from services.promo_errors import is_promo_activation_blocked_error
from services.promo_service import activate_promo

router = APIRouter(prefix="/api/promo", tags=["promo"])


@router.get("/active")
async def get_active_promo(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    promo = db.get_user_active_promo(current_user["telegram_id"])
    if not promo:
        return {"active": False}
    return {
        "active": True,
        "code": promo["code"],
        "discount_percent": promo["discount_percent"],
    }


@router.post("/activate")
async def activate_promo_code(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    code = str(body.get("code", "")).strip()
    if not code:
        raise HTTPException(status_code=400, detail="Укажите промокод.")
    try:
        result = activate_promo(db, code, current_user["telegram_id"])
    except ValueError as exc:
        detail = str(exc)
        status = 409 if is_promo_activation_blocked_error(detail) else 404
        raise HTTPException(status_code=status, detail=detail) from exc
    return {
        "ok": True,
        "already_active": bool(result.get("already_active")),
        "code": result.get("code"),
        "discount_percent": result.get("discount_percent"),
    }
