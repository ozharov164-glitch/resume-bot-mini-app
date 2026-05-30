#!/usr/bin/env python3
"""Send test admin notifications to ADMIN_GROUP_CHAT_ID (requires backend/.env)."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from database import get_db  # noqa: E402
from services.admin_notify import PaymentNotifyInfo, notify_new_user, notify_payment  # noqa: E402


async def main() -> None:
    db = get_db()
    await notify_new_user(
        db,
        telegram_id=0,
        first_name="Тест",
        username="admin_notify_check",
    )
    await notify_payment(
        db,
        PaymentNotifyInfo(
            provider="telegram_stars",
            amount="99",
            currency="⭐",
            resume_id="test-resume-id",
            telegram_id=0,
            username="admin_notify_check",
            first_name="Тест",
        ),
        first_payment=True,
    )
    print("OK: test messages sent to admin group")


if __name__ == "__main__":
    asyncio.run(main())
