from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from jose import jwt

from config import settings
from database import get_db
from models.schemas import TelegramAuthRequest, TokenResponse
from services.telegram_service import verify_telegram_init_data

router = APIRouter(prefix="/api/auth", tags=["auth"])


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
    access_token = jwt.encode(
        {"sub": str(telegram_id), "exp": int(expire.timestamp())},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    return TokenResponse(access_token=access_token)
