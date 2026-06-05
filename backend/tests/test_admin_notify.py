import os
import tempfile
from pathlib import Path
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

from services.admin_notify import (  # noqa: E402
    PaymentNotifyInfo,
    notify_new_user,
    notify_payment,
    parse_admin_group_chat_id,
)
from storage.backends import SQLiteBackend  # noqa: E402


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("1003959501619", -1003959501619),
        ("-1003959501619", -1003959501619),
        ("", None),
        (None, None),
    ],
)
def test_parse_admin_group_chat_id(raw, expected):
    assert parse_admin_group_chat_id(raw) == expected


@pytest.mark.asyncio
async def test_notify_new_user_sends_message():
    with tempfile.TemporaryDirectory() as tmp:
        db = SQLiteBackend(Path(tmp) / "t.db")
        db.create_user(telegram_id=1, first_name="A", username="alice")

        with patch("services.admin_notify.admin_group_chat_id", return_value=-1003959501619):
            with patch("services.admin_notify.send_admin_message", new_callable=AsyncMock) as send:
                db.create_user(telegram_id=2, first_name="Bob", username="bob")
                await notify_new_user(db, telegram_id=2, first_name="Bob", username="bob")

                send.assert_awaited_once()
                text = send.await_args.args[0]
                assert "Новый пользователь" in text
                assert "Всего пользователей: <b>2</b>" in text
                assert "@bob" in text


@pytest.mark.asyncio
async def test_notify_payment_only_on_first_payment_flag():
    with tempfile.TemporaryDirectory() as tmp:
        db = SQLiteBackend(Path(tmp) / "t.db")
        info = PaymentNotifyInfo(
            provider="telegram_stars",
            amount="99",
            currency="⭐",
            resume_id="r1",
            telegram_id=42,
            username="u",
            first_name="U",
        )

        with patch("services.admin_notify.send_admin_message", new_callable=AsyncMock) as send:
            await notify_payment(db, info, first_payment=False)
            send.assert_not_awaited()

            await notify_payment(db, info, first_payment=True)
            send.assert_awaited_once()
            assert "Оплата получена" in send.await_args.args[0]
            assert "99" in send.await_args.args[0]
