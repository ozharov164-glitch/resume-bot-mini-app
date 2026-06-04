import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from jose import JWTError, jwt

from config import settings
from database import get_db
from models.schemas import TelegramAuthRequest, TokenResponse
from services.rate_limiter import RateLimitExceeded, check_rate_limit
from services.user_registration import register_telegram_user
from services.founder import is_founder
from services.telegram_service import verify_telegram_init_data

logger = logging.getLogger(__name__)
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
    founder = is_founder(tid)
    bonus_stars = 0
    try:
        db = get_db()
        bonus_stars = db.get_bonus_stars(tid)
    except Exception:
        logger.debug("bonus_stars lookup failed telegram_id=%s", tid)
    return {
        "telegram_id": tid,
        "is_founder": founder,
        "unlimited": founder,
        "bonus_stars": bonus_stars,
    }


def _client_ip(request: Request) -> str:
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if forwarded:
        return forwarded
    if request.client:
        return request.client.host
    return "unknown"


@router.post("/telegram", response_model=TokenResponse)
async def auth_with_telegram(
    payload: TelegramAuthRequest,
    request: Request,
    db=Depends(get_db),
):
    try:
        await check_rate_limit("auth_telegram", _client_ip(request))
    except RateLimitExceeded as exc:
        raise HTTPException(
            status_code=429,
            detail=f"Слишком много попыток входа. Повторите через {exc.retry_after_hours} ч.",
        ) from exc
    user_data = verify_telegram_init_data(payload.init_data, settings.BOT_TOKEN)
    if not user_data:
        raise HTTPException(status_code=401, detail="Неверная подпись Telegram.")

    telegram_id = user_data["id"]
    user = db.find_user_by_telegram_id(telegram_id)
    if not user:
        try:
            await register_telegram_user(
                db,
                telegram_id=telegram_id,
                first_name=user_data.get("first_name", ""),
                last_name=user_data.get("last_name", ""),
                username=user_data.get("username", ""),
            )
        except Exception as exc:
            logger.exception("auth registration failed telegram_id=%s", telegram_id)
            user = db.find_user_by_telegram_id(telegram_id)
            if not user:
                raise HTTPException(
                    status_code=503,
                    detail="Сервис временно недоступен. Попробуйте через минуту.",
                ) from exc
        else:
            user = db.find_user_by_telegram_id(telegram_id)

    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=settings.JWT_EXPIRE_HOURS)
    founder = is_founder(telegram_id)
    access_token = jwt.encode(
        {"sub": str(telegram_id), "exp": int(expire.timestamp()), "founder": founder},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    return TokenResponse(access_token=access_token, is_founder=founder, unlimited=founder)
