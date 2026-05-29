import hashlib
import hmac
import io
import json
from urllib.parse import parse_qs

from telegram import Bot

from config import settings


def verify_telegram_init_data(init_data: str, bot_token: str) -> dict | None:
    parsed = parse_qs(init_data, keep_blank_values=True)
    hash_value = parsed.pop("hash", [None])[0]
    if not hash_value:
        return None

    data_check_string = "\n".join(sorted([f"{k}={v[0]}" for k, v in parsed.items()]))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(hash_value, expected_hash):
        return None
    user_json = parsed.get("user", [None])[0]
    return json.loads(user_json) if user_json else None


async def send_document_to_user(user_telegram_id: int, document: bytes, filename: str, caption: str) -> None:
    bot = Bot(token=settings.BOT_TOKEN)
    payload = io.BytesIO(document)
    payload.name = filename
    await bot.send_document(chat_id=user_telegram_id, document=payload, filename=filename, caption=caption)
