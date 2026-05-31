"""Affiliate grant, revoke, and stats."""

import os
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("BOT_TOKEN", "0:test")
os.environ.setdefault("BOT_USERNAME", "testbot")
os.environ.setdefault("OPENROUTER_API_KEY", "test")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("APP_URL", "https://example.test")
os.environ.setdefault("FRONTEND_URL", "https://example.test/app")

from services.affiliate_service import (
    get_affiliate_stats_for_owner,
    grant_affiliate,
    list_affiliates_with_stats,
    revoke_affiliate,
)
from storage.backends import SQLiteBackend


class AffiliateServiceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = SQLiteBackend(Path(self.tmp.name) / "test.db")
        self.db.create_user(telegram_id=5001, first_name="Traffer", username="traffer")
        self.db.create_user(telegram_id=6001, first_name="Buyer", username="buyer")

    def tearDown(self):
        self.tmp.cleanup()

    def test_grant_sets_affiliate_flag_and_promo(self):
        result = grant_affiliate(self.db, telegram_id=5001, code="TRAFF10")
        self.assertEqual(result["promo"]["code"], "TRAFF10")
        self.assertTrue(self.db.is_user_affiliate(5001))

        stats = get_affiliate_stats_for_owner(self.db, 5001)
        assert stats is not None
        self.assertEqual(stats["code"], "TRAFF10")
        self.assertEqual(stats["activations"], 0)
        self.assertEqual(stats["paid_count"], 0)

    def test_grant_rejects_duplicate_active_promo(self):
        grant_affiliate(self.db, telegram_id=5001, code="ONE")
        with self.assertRaises(ValueError):
            grant_affiliate(self.db, telegram_id=5001, code="TWO")

    def test_stats_track_activation_and_payment(self):
        grant_affiliate(self.db, telegram_id=5001, code="TRAFF10")
        self.db.activate_promo_for_user("TRAFF10", 6001)
        self.db.mark_promo_activation_paid(6001, "resume-1")

        stats = get_affiliate_stats_for_owner(self.db, 5001)
        assert stats is not None
        self.assertEqual(stats["activations"], 1)
        self.assertEqual(stats["paid_count"], 1)

        listed = list_affiliates_with_stats(self.db)
        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0]["paid_count"], 1)

    def test_revoke_deactivates_promo_and_flag(self):
        grant_affiliate(self.db, telegram_id=5001, code="TRAFF10")
        result = revoke_affiliate(self.db, 5001)
        self.assertTrue(result["revoked"])
        self.assertEqual(result["codes_deactivated"], ["TRAFF10"])
        self.assertFalse(self.db.is_user_affiliate(5001))
        self.assertIsNone(get_affiliate_stats_for_owner(self.db, 5001))

        with self.assertRaises(ValueError):
            self.db.activate_promo_for_user("TRAFF10", 6001)


if __name__ == "__main__":
    unittest.main()
