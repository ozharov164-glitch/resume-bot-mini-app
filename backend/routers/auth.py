from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from jose import JWTError, jwt

from config import settings
from database import get_db
from models.schemas import TelegramAuthRequest, TokenResponse
from services.founder import is_founder
from services.telegram_service import verify_telegram_init_data

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me")
async def auth_me(authorization: str = Header(default="")):
    """Founder status from JWT — no DB round-trip (works even under load)."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Требуется авторизация.")
    token = authorization.replace("Bearer ", "", 1)
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Недействительный токен.") from exc

    if payload.get("exp") and datetime.now(timezone.utc).timestamp() > payload["exp"]:
        raise HTTPException(status_code=401, detail="Срок действия токена истек.")

    telegram_id = payload.get("sub")
    if not telegram_id:
        raise HTTPException(status_code=401, detail="Некорректный токен.")

    tid = int(telegram_id)
    founder = bool(payload.get("founder")) or is_founder(tid)
    return {"telegram_id": tid, "is_founder": founder, "unlimited": founder}


@router.post("/telegram", response_model=TokenResponse)
async def auth_with_telegram(payload: TelegramAuthRequest, db=Depends(get_db)):
    user_data = verify_telegram_init_data(payload.init_data, settings.BOT_TOKEN)
    if not user_data:
        raise HTTPException(status_code=401, detail="Неверная подпись Telegram.")

    telegram_id = user_data["id"]
    user = db.find_user_by_telegram_id(telegram_id)
    if not user:
        user = db.create_user(
            telegram_id=telegram_id,
            first_name=user_data.get("first_name", ""),
            last_name=user_data.get("last_name", ""),
            username=user_data.get("username", ""),
        )

    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=settings.JWT_EXPIRE_HOURS)
    founder = is_founder(telegram_id)
    access_token = jwt.encode(
        {"sub": str(telegram_id), "exp": int(expire.timestamp()), "founder": founder},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    return TokenResponse(access_token=access_token, is_founder=founder, unlimited=founder)
