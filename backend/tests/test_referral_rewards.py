"""Friend referral vs affiliate promo rewards on first payment."""

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

os.environ.setdefault("BOT_TOKEN", "0:test")
os.environ.setdefault("BOT_USERNAME", "testbot")
os.environ.setdefault("OPENROUTER_API_KEY", "test")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("APP_URL", "https://example.test")
os.environ.setdefault("FRONTEND_URL", "https://example.test/app")

from storage.backends import SQLiteBackend  # noqa: E402
from services.affiliate_service import grant_affiliate  # noqa: E402
from services.referral_rewards import (  # noqa: E402
    REFERRAL_FRIEND_BONUS_STARS,
    affiliate_commission_stars,
    process_first_payment_attribution,
)
from services.admin_notify import PaymentNotifyInfo  # noqa: E402


class ReferralRewardsTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = SQLiteBackend(Path(self.tmp.name) / "test.db")
        self.db.create_user(telegram_id=1001, first_name="Buyer")
        self.db.create_user(telegram_id=2002, first_name="Friend")
        grant_affiliate(self.db, telegram_id=5001, code="TRAFF10", discount=10)

    def tearDown(self):
        self.tmp.cleanup()

    def test_affiliate_promo_does_not_set_referred_by(self):
        self.db.activate_promo_for_user("TRAFF10", 1001)
        user = self.db.find_user_by_telegram_id(1001)
        assert user is not None
        self.assertIsNone(user.get("referred_by"))

    def test_commission_math(self):
        self.assertEqual(affiliate_commission_stars(149, 20), 30)

    @patch("services.referral_rewards.send_admin_message", new_callable=AsyncMock)
    @patch("telegram.Bot.send_message", new_callable=AsyncMock)
    async def test_affiliate_payment_no_bonus_stars(self, send_msg, admin_msg):
        self.db.activate_promo_for_user("TRAFF10", 1001)
        buyer = self.db.find_user_by_telegram_id(1001)
        resume = {"id": "r1", "promo_code": None}

        await process_first_payment_attribution(
            self.db,
            buyer=buyer,
            buyer_telegram_id=1001,
            resume_id="r1",
            resume=resume,
            payment=PaymentNotifyInfo(
                provider="telegram_stars",
                amount="149",
                currency="XTR",
                resume_id="r1",
                telegram_id=1001,
            ),
        )

        self.assertEqual(self.db.get_bonus_stars(5001), 0)
        send_msg.assert_awaited()
        text = send_msg.await_args.kwargs.get("text") or send_msg.await_args.args[1]
        self.assertIn("комиссия", text.lower())
        self.assertNotIn("Ваш друг", text)
        admin_msg.assert_awaited()

    @patch("services.referral_rewards._notify_friend_referral_bonus", new_callable=AsyncMock)
    async def test_friend_referral_gets_30_stars(self, notify_friend):
        self.db.save_referral(2002, 1001)
        buyer = self.db.find_user_by_telegram_id(1001)
        resume = {"id": "r2", "promo_code": None}

        await process_first_payment_attribution(
            self.db,
            buyer=buyer,
            buyer_telegram_id=1001,
            resume_id="r2",
            resume=resume,
            payment=None,
        )

        self.assertEqual(self.db.get_bonus_stars(2002), REFERRAL_FRIEND_BONUS_STARS)
        notify_friend.assert_awaited_once_with(2002)


if __name__ == "__main__":
    unittest.main()
