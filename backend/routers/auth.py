from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from jose import jwt

from config import settings
from database import get_db
from dependencies import get_current_user
from models.schemas import TelegramAuthRequest, TokenResponse
from services.founder import is_founder
from services.telegram_service import verify_telegram_init_data

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me")
async def auth_me(current_user: dict = Depends(get_current_user)):
    founder = is_founder(current_user.get("telegram_id"))
    return {
        "telegram_id": current_user.get("telegram_id"),
        "is_founder": founder,
        "unlimited": founder,
    }


@router.post("/telegram", response_model=TokenResponse)
async def auth_with_telegram(payload: TelegramAuthRequest, db=Depends(get_db)):
    user_data = verify_telegram_init_data(payload.init_data, settings.BOT_TOKEN)
    if not user_data:
        raise HTTPException(status_code=401, detail="Неверная подпись Telegram.")

    telegram_id = user_data["id"]
    existing = db.table("users").select("*").eq("telegram_id", telegram_id).limit(1).execute()

    if not existing.data:
        db.table("users").insert(
            {
                "telegram_id": telegram_id,
                "first_name": user_data.get("first_name", ""),
                "last_name": user_data.get("last_name", ""),
                "username": user_data.get("username", ""),
                "created_at": datetime.utcnow().isoformat(),
            }
        ).execute()

    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=settings.JWT_EXPIRE_HOURS)
    founder = is_founder(telegram_id)
    access_token = jwt.encode(
        {"sub": str(telegram_id), "exp": int(expire.timestamp()), "founder": founder},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    return TokenResponse(access_token=access_token, is_founder=founder, unlimited=founder)
