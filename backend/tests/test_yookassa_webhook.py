import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

os.environ.setdefault("BOT_TOKEN", "0:test")
os.environ.setdefault("BOT_USERNAME", "testbot")
os.environ.setdefault("OPENROUTER_API_KEY", "test")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("APP_URL", "https://example.test")
os.environ.setdefault("FRONTEND_URL", "https://example.test/app")
os.environ["YOKASSA_SHOP_ID"] = "1371148"
os.environ["YOKASSA_SECRET_KEY"] = "live_test_key"

from services.yookassa_webhook import handle_yookassa_webhook  # noqa: E402


@pytest.mark.asyncio
async def test_webhook_ignores_non_payment_succeeded():
    db = MagicMock()
    with patch("services.yookassa_webhook.settings") as mock_settings:
        mock_settings.YOKASSA_SHOP_ID = "1371148"
        mock_settings.YOKASSA_SECRET_KEY = "live_test_key"
        result = await handle_yookassa_webhook(
            db,
            {"type": "notification", "event": "payment.canceled", "object": {"id": "pay-1"}},
        )
    assert result["ok"] is True
    assert result["status"] == "ignored"


@pytest.mark.asyncio
async def test_webhook_ignores_amount_mismatch():
    db = MagicMock()
    user = {
        "id": "user-1",
        "telegram_id": 12345,
        "username": "tester",
        "first_name": "Test",
    }
    db.find_resume.return_value = {
        "id": "resume-1",
        "user_id": "user-1",
        "is_paid": False,
        "data": "{}",
        "final_price_rub": 149,
    }
    db.find_user_by_id.return_value = user
    db.find_user_by_telegram_id.return_value = user

    verified = MagicMock()
    verified.status = "succeeded"
    verified.metadata = {"resume_id": "resume-1", "user_id": "user-1"}
    verified.amount.value = "1.00"
    verified.amount.currency = "RUB"

    payload = {
        "type": "notification",
        "event": "payment.succeeded",
        "object": {"id": "pay-cheap", "status": "succeeded"},
    }

    fulfill = AsyncMock()
    fake_dispatch = MagicMock()
    fake_dispatch.fulfill_from_invoice_payload = fulfill

    with patch("services.yookassa_webhook.settings") as mock_settings:
        mock_settings.YOKASSA_SHOP_ID = "1371148"
        mock_settings.YOKASSA_SECRET_KEY = "live_test_key"
        with patch("services.yookassa_webhook.Payment.find_one", return_value=verified):
            with patch.dict(sys.modules, {"services.payment_dispatch": fake_dispatch}):
                result = await handle_yookassa_webhook(db, payload)

    assert result["ok"] is True
    assert result["status"] == "ignored"
    fulfill.assert_not_awaited()


@pytest.mark.asyncio
async def test_webhook_fulfills_on_payment_succeeded():
    db = MagicMock()
    user = {
        "id": "user-1",
        "telegram_id": 12345,
        "username": "tester",
        "first_name": "Test",
    }
    db.find_resume.return_value = {
        "id": "resume-1",
        "user_id": "user-1",
        "is_paid": False,
        "data": "{}",
        "final_price_rub": 149,
    }
    db.find_user_by_id.return_value = user
    db.find_user_by_telegram_id.return_value = user

    verified = MagicMock()
    verified.status = "succeeded"
    verified.metadata = {"resume_id": "resume-1", "user_id": "user-1"}
    verified.amount.value = "149.00"
    verified.amount.currency = "RUB"

    payload = {
        "type": "notification",
        "event": "payment.succeeded",
        "object": {"id": "pay-abc", "status": "succeeded"},
    }

    fulfill = AsyncMock()
    fake_dispatch = MagicMock()
    fake_dispatch.fulfill_from_invoice_payload = fulfill

    with patch("services.yookassa_webhook.settings") as mock_settings:
        mock_settings.YOKASSA_SHOP_ID = "1371148"
        mock_settings.YOKASSA_SECRET_KEY = "live_test_key"
        with patch("services.yookassa_webhook.Payment.find_one", return_value=verified):
            with patch.dict(sys.modules, {"services.payment_dispatch": fake_dispatch}):
                result = await handle_yookassa_webhook(db, payload)

    assert result["ok"] is True
    assert result["status"] == "fulfilled"
    fulfill.assert_awaited_once()
    assert fulfill.await_args.args[1]["resume_id"] == "resume-1"
    assert fulfill.await_args.args[2] == 12345
