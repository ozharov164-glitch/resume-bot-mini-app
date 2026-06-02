import os
import sys
import types
from unittest.mock import AsyncMock

import pytest

os.environ.setdefault("BOT_TOKEN", "0:test")
os.environ.setdefault("OPENROUTER_API_KEY", "test")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test")
os.environ.setdefault("JWT_SECRET", "test")
os.environ.setdefault("APP_URL", "https://example.test")
os.environ.setdefault("FRONTEND_URL", "https://example.test/app")
os.environ.setdefault("BOT_USERNAME", "resumeez_bot")

# Avoid importing heavy WeasyPrint stack during unit tests.
fake_pdf_async = types.ModuleType("services.pdf_async")
fake_pdf_async.generate_pdf_async = AsyncMock()
sys.modules["services.pdf_async"] = fake_pdf_async

from services.payment_fulfillment import fulfill_paid_resume  # noqa: E402
from services.admin_notify import PaymentNotifyInfo  # noqa: E402


class DummyDB:
    def __init__(self, *, is_paid: bool = False, template_id: str = "classic") -> None:
        self.resume = {
            "id": "rid-1",
            "user_id": "uid-1",
            "is_paid": is_paid,
            "template_id": template_id,
            "data": {"full_name": "Иван Петров", "target_position": "Backend Developer"},
        }
        self.update_calls: list[tuple[str, dict]] = []
        self.used_bonus: list[tuple[int, int]] = []

    def find_resume(self, resume_id: str):
        if resume_id != self.resume["id"]:
            return None
        return dict(self.resume)

    def update_resume(self, resume_id: str, fields: dict):
        self.update_calls.append((resume_id, dict(fields)))
        if resume_id == self.resume["id"]:
            self.resume.update(fields)

    def use_bonus_stars(self, telegram_id: int, amount: int):
        self.used_bonus.append((telegram_id, amount))
        return amount

    def find_user_by_telegram_id(self, telegram_id: int):
        if int(telegram_id) == 123:
            return {"id": "uid-1", "telegram_id": 123}
        return None


@pytest.mark.asyncio
async def test_fulfill_without_document_does_not_generate_pdf(monkeypatch):
    db = DummyDB(is_paid=False, template_id="classic")
    pdf_mock = AsyncMock()
    send_mock = AsyncMock()
    notify_mock = AsyncMock()

    monkeypatch.setattr("services.payment_fulfillment.generate_pdf_async", pdf_mock)
    monkeypatch.setattr("services.payment_fulfillment.send_document_to_user", send_mock)
    monkeypatch.setattr("services.payment_fulfillment.notify_payment", notify_mock)

    ok = await fulfill_paid_resume(
        db,
        "rid-1",
        telegram_id=123,
        payment=PaymentNotifyInfo(
            provider="telegram_stars",
            amount="149",
            currency="⭐",
            resume_id="rid-1",
            telegram_id=123,
        ),
        send_document=False,
        bonus_stars_applied=3,
    )

    assert ok is True
    assert any(fields.get("is_paid") for _, fields in db.update_calls)
    pdf_mock.assert_not_awaited()
    send_mock.assert_not_awaited()
    notify_mock.assert_awaited_once()
    assert db.used_bonus == [(123, 3)]


@pytest.mark.asyncio
async def test_fulfill_uses_template_override_without_ai_regeneration(monkeypatch):
    db = DummyDB(is_paid=True, template_id="classic")
    pdf_mock = AsyncMock(return_value=b"pdf")
    send_mock = AsyncMock()

    monkeypatch.setattr("services.payment_fulfillment.generate_pdf_async", pdf_mock)
    monkeypatch.setattr("services.payment_fulfillment.send_document_to_user", send_mock)
    monkeypatch.setattr("services.payment_fulfillment.notify_payment", AsyncMock())

    ok = await fulfill_paid_resume(
        db,
        "rid-1",
        telegram_id=123,
        template_name="modern",
    )

    assert ok is True
    assert ("rid-1", {"template_id": "modern"}) in db.update_calls
    pdf_mock.assert_awaited_once()
    called_template = pdf_mock.await_args.args[1]
    assert called_template == "modern"
    send_mock.assert_awaited_once()
