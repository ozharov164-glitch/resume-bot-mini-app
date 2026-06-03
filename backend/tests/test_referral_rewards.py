"""Friend referral vs affiliate promo rewards on first payment."""

import os
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, patch

os.environ.setdefault("BOT_TOKEN", "0:test")
os.environ.setdefault("BOT_USERNAME", "testbot")
os.environ.setdefault("OPENROUTER_API_KEY", "test")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("APP_URL", "https://example.test")
os.environ.setdefault("FRONTEND_URL", "https://example.test/app")

from storage.backends import SQLiteBackend  # noqa: E402
from services.affiliate_service import (  # noqa: E402
    affiliate_commission_rub,
    grant_affiliate,
    sum_affiliate_commission_owed_rub,
)
from services.referral_rewards import (  # noqa: E402
    REFERRAL_FRIEND_BONUS_STARS,
    process_first_payment_attribution,
)


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

    def test_commission_rub_math(self):
        self.assertEqual(affiliate_commission_rub(149, 20), 30)
        self.assertEqual(affiliate_commission_rub(134, 20), 27)

    def test_commission_owed_sums_paid_activations(self):
        self.db.activate_promo_for_user("TRAFF10", 1001)
        user = self.db.find_user_by_telegram_id(1001)
        assert user is not None
        resume_id = "resume-1"
        self.db.create_resume(
            {
                "id": resume_id,
                "user_id": user["id"],
                "data": {"full_name": "Test"},
                "is_paid": True,
                "paid_at": datetime.utcnow().isoformat(),
                "created_at": datetime.utcnow().isoformat(),
            }
        )
        self.db.update_resume(
            resume_id,
            {"final_price_rub": 134, "promo_code": "TRAFF10"},
        )
        self.db.mark_promo_activation_paid(1001, resume_id)
        self.assertEqual(sum_affiliate_commission_owed_rub(self.db, 5001), 27)

    @patch("telegram.Bot.send_message", new_callable=AsyncMock)
    async def test_affiliate_payment_no_bonus_stars(self, send_msg):
        self.db.activate_promo_for_user("TRAFF10", 1001)
        buyer = self.db.find_user_by_telegram_id(1001)
        resume = {"id": "r1", "promo_code": None, "final_price_rub": 149}

        await process_first_payment_attribution(
            self.db,
            buyer=buyer,
            buyer_telegram_id=1001,
            resume_id="r1",
            resume=resume,
            payment=None,
        )

        self.assertEqual(self.db.get_bonus_stars(5001), 0)
        send_msg.assert_awaited()
        text = send_msg.await_args.kwargs.get("text") or send_msg.await_args.args[1]
        self.assertIn("купили резюме", text.lower())
        self.assertNotIn("Stars", text)
        self.assertNotIn("Ваш друг", text)

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
