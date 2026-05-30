#!/usr/bin/env python3
"""Smoke-test bot handlers and referral storage without Telegram polling."""

from __future__ import annotations

import asyncio
import sys
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "bot"))

# Minimal env so bot module can import settings (real .env may be gitignored).
import os  # noqa: E402

os.environ.setdefault("BOT_TOKEN", "0:test")
os.environ.setdefault("BOT_USERNAME", "testbot")
os.environ.setdefault("OPENROUTER_API_KEY", "test")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("APP_URL", "https://62-217-182-239.nip.io")
os.environ.setdefault("FRONTEND_URL", "https://example.github.io/app")
os.environ.setdefault("ADMIN_GROUP_CHAT_ID", "")

from storage.backends import SQLiteBackend  # noqa: E402

import types  # noqa: E402

sys.modules["services.payment_fulfillment"] = types.ModuleType("services.payment_fulfillment")
sys.modules["services.payment_fulfillment"].fulfill_paid_resume = AsyncMock()

import bot as bot_module  # noqa: E402


def test_referral_columns_and_save() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "test.db"
        backend = SQLiteBackend(db_path)
        backend.create_user(telegram_id=111, first_name="Ref")
        backend.create_user(telegram_id=222, first_name="New")
        backend.save_referral(111, 222)
        user = backend.find_user_by_telegram_id(222)
        assert user is not None, "referee must exist"
        assert user.get("referred_by") == 111, f"expected referred_by=111, got {user}"


async def test_start_referral_flow() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "test.db"
        backend = SQLiteBackend(db_path)

        update = MagicMock()
        update.message.from_user.id = 999
        update.message.from_user.first_name = "Test<User>"
        update.message.from_user.last_name = ""
        update.message.from_user.username = ""
        update.message.reply_text = AsyncMock()

        context = MagicMock()
        context.args = ["ref_555"]

        with patch.object(bot_module, "get_db", return_value=backend):
            with patch.object(bot_module, "_get_resume_count", AsyncMock(return_value=1200)):
                backend.create_user(telegram_id=555, first_name="Referrer")
                await bot_module.start(update, context)
                await asyncio.sleep(0.2)

        user = backend.find_user_by_telegram_id(999)
        assert user is not None
        assert user["referred_by"] == 555
        text = update.message.reply_text.call_args[0][0]
        assert "Test&lt;User&gt;" in text or "Test<User>" not in text
        assert "5 000" in text or "5000" in text
        markup = update.message.reply_text.call_args[1]["reply_markup"]
        rows = markup.inline_keyboard
        assert len(rows) == 5


async def test_support_hub_callback() -> None:
    update = MagicMock()
    update.effective_user.first_name = "Test"
    update.effective_user.username = ""
    update.callback_query = MagicMock()
    update.callback_query.answer = AsyncMock()
    update.callback_query.edit_message_text = AsyncMock()
    update.get_bot = MagicMock()

    with patch.object(bot_module, "ensure_founder_username", AsyncMock(return_value="founder_test")):
        await bot_module.support_hub_callback(update, MagicMock())

    update.callback_query.answer.assert_awaited_once()
    update.callback_query.edit_message_text.assert_awaited_once()
    text = update.callback_query.edit_message_text.await_args.args[0]
    assert "Поддержка ResumeBot" in text
    markup = update.callback_query.edit_message_text.await_args.kwargs["reply_markup"]
    assert markup.inline_keyboard[0][0].url == "https://t.me/founder_test"


async def test_fallback_and_help() -> None:
    update = MagicMock()
    update.message.reply_text = AsyncMock()
    context = MagicMock()
    context.args = []

    with patch.object(bot_module, "_get_resume_count", AsyncMock(return_value=500)):
        await bot_module.fallback_text(update, context)
        await bot_module.help_command(update, context)

    assert update.message.reply_text.await_count == 2


def test_main_registers_handlers() -> None:
    builder = MagicMock()
    app = MagicMock()
    builder.token.return_value.post_init.return_value.build.return_value = app
    with patch.object(bot_module.Application, "builder", return_value=builder):
        with patch.object(bot_module.settings, "BOT_TOKEN", "test:token"):
            bot_module.main()
    assert app.add_handler.call_count >= 12
    assert app.run_polling.called


def main() -> None:
    test_referral_columns_and_save()
    asyncio.run(test_start_referral_flow())
    asyncio.run(test_support_hub_callback())
    asyncio.run(test_fallback_and_help())
    test_main_registers_handlers()
    print("OK: all bot verification checks passed")


if __name__ == "__main__":
    main()
