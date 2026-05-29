from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException
from jose import JWTError, jwt

from config import settings
from database import get_db


def get_current_user(authorization: str = Header(default=""), db=Depends(get_db)) -> dict:
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

    result = db.table("users").select("*").eq("telegram_id", int(telegram_id)).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Пользователь не найден.")
    return result.data[0]
