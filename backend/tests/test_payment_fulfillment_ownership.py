import os
import types
from unittest.mock import AsyncMock

import pytest

os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-at-least-32-characters-long")

fake_pdf_async = types.ModuleType("services.pdf_async")
fake_pdf_async.generate_pdf_async = AsyncMock()
import sys  # noqa: E402

sys.modules["services.pdf_async"] = fake_pdf_async

from services.payment_fulfillment import fulfill_paid_resume  # noqa: E402


class _DB:
    def __init__(self) -> None:
        self.resume = {
            "id": "rid-1",
            "user_id": "other-user",
            "is_paid": False,
            "template_id": "classic",
            "data": {"full_name": "Test"},
        }

    def find_resume(self, resume_id: str, user_id: str | None = None):
        if resume_id != "rid-1":
            return None
        return dict(self.resume)

    def find_user_by_telegram_id(self, telegram_id: int):
        if int(telegram_id) == 999:
            return {"id": "uid-attacker", "telegram_id": 999}
        return None


@pytest.mark.asyncio
async def test_fulfill_rejects_wrong_owner():
    db = _DB()
    ok = await fulfill_paid_resume(db, "rid-1", telegram_id=999, send_document=False)
    assert ok is False
