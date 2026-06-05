import hashlib
import hmac
import io
import json
import logging
import time
from urllib.parse import parse_qs

from telegram import Bot

from config import settings

logger = logging.getLogger(__name__)


def verify_telegram_init_data(init_data: str, bot_token: str) -> dict | None:
    parsed = parse_qs(init_data, keep_blank_values=True)
    hash_value = parsed.pop("hash", [None])[0]
    if not hash_value:
        return None

    auth_date_raw = parsed.get("auth_date", [None])[0]
    if not auth_date_raw:
        logger.warning("init_data rejected: missing auth_date")
        return None
    try:
        auth_ts = int(auth_date_raw)
    except ValueError:
        return None
    age = time.time() - auth_ts
    max_age = settings.INIT_DATA_MAX_AGE_SECONDS
    if age > max_age or age < -120:
        logger.warning("init_data rejected: auth_date age=%.0fs max=%s", age, max_age)
        return None

    data_check_string = "\n".join(sorted([f"{k}={v[0]}" for k, v in parsed.items()]))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(hash_value, expected_hash):
        return None
    user_json = parsed.get("user", [None])[0]
    if not user_json:
        return None
    try:
        return json.loads(user_json)
    except json.JSONDecodeError:
        return None


def verify_telegram_webhook_secret(header_value: str | None) -> bool:
    """When TELEGRAM_WEBHOOK_SECRET is set, require X-Telegram-Bot-Api-Secret-Token."""
    expected = (settings.TELEGRAM_WEBHOOK_SECRET or "").strip()
    if not expected:
        logger.error("TELEGRAM_WEBHOOK_SECRET is not set — rejecting webhook")
        return False
    if not header_value:
        return False
    return hmac.compare_digest(header_value.strip(), expected)


async def send_document_to_user(user_telegram_id: int, document: bytes, filename: str, caption: str) -> None:
    from services.telegram_bot import get_bot
    payload = io.BytesIO(document)
    payload.name = filename
    await get_bot().send_document(chat_id=user_telegram_id, document=payload, filename=filename, caption=caption)
