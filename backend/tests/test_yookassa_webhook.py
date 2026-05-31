import os
import sys
import types
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
    result = await handle_yookassa_webhook(
        db,
        {"type": "notification", "event": "payment.canceled", "object": {"id": "pay-1"}},
    )
    assert result["ok"] is True
    assert result["status"] == "ignored"


@pytest.mark.asyncio
async def test_webhook_fulfills_on_payment_succeeded():
    db = MagicMock()
    db.find_resume.return_value = {"id": "resume-1", "is_paid": False, "data": "{}"}
    db.find_user_by_id.return_value = {
        "id": "user-1",
        "telegram_id": 12345,
        "username": "tester",
        "first_name": "Test",
    }

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
    fake_fulfillment = types.ModuleType("services.payment_fulfillment")
    fake_fulfillment.fulfill_paid_resume = fulfill

    with patch("services.yookassa_webhook.Payment.find_one", return_value=verified):
        with patch.dict(sys.modules, {"services.payment_fulfillment": fake_fulfillment}):
            result = await handle_yookassa_webhook(db, payload)

    assert result["ok"] is True
    assert result["status"] == "fulfilled"
    fulfill.assert_awaited_once()
    assert fulfill.await_args.args[1] == "resume-1"
    assert fulfill.await_args.args[2] == 12345
