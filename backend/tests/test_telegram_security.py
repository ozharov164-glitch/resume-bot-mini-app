import os
import time

import pytest

os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("BOT_TOKEN", "0123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-at-least-32-characters-long")

from services.telegram_service import (  # noqa: E402
    verify_telegram_init_data,
    verify_telegram_webhook_secret,
)


def test_verify_webhook_secret_requires_token_when_configured(monkeypatch):
    monkeypatch.setattr(
        "services.telegram_service.settings.DEBUG",
        False,
    )
    monkeypatch.setattr(
        "services.telegram_service.settings.TELEGRAM_WEBHOOK_SECRET",
        "super-secret",
    )
    assert verify_telegram_webhook_secret("super-secret") is True
    assert verify_telegram_webhook_secret("wrong") is False
    assert verify_telegram_webhook_secret(None) is False


def _signed_init_data(bot_token: str, *, age_seconds: int) -> str:
    import hashlib
    import hmac
    import json

    user_json = json.dumps({"id": 1}, separators=(",", ":"))
    auth_date = int(time.time()) - age_seconds
    pairs = {"auth_date": str(auth_date), "user": user_json}
    data_check_string = "\n".join(f"{k}={pairs[k]}" for k in sorted(pairs))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    digest = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    return f"auth_date={auth_date}&user={user_json}&hash={digest}"


def test_init_data_rejects_stale_auth_date(monkeypatch):
    monkeypatch.setattr(
        "services.telegram_service.settings.INIT_DATA_MAX_AGE_SECONDS",
        60,
    )
    token = os.environ["BOT_TOKEN"]
    stale = _signed_init_data(token, age_seconds=120)
    assert verify_telegram_init_data(stale, token) is None
    fresh = _signed_init_data(token, age_seconds=0)
    assert verify_telegram_init_data(fresh, token) == {"id": 1}
