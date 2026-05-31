"""Promo activation and discounted payment pricing."""

import tempfile
import unittest
from pathlib import Path

from storage.backends import SQLiteBackend


class PromoActivationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = SQLiteBackend(Path(self.tmp.name) / "test.db")
        self.db.create_user(telegram_id=1001, first_name="Buyer", username="buyer")
        self.db.create_promo_code("BLOG10", owner_tg_id=9001, discount=10, max_uses=50)

    def tearDown(self):
        self.tmp.cleanup()

    def test_activate_promo_sets_user_and_attribution(self):
        result = self.db.activate_promo_for_user("blog10", 1001)
        self.assertFalse(result["already_active"])
        self.assertEqual(result["code"], "BLOG10")

        user = self.db.find_user_by_telegram_id(1001)
        assert user is not None
        self.assertEqual(user["active_promo_code"], "BLOG10")
        self.assertEqual(user["referred_by"], 9001)

        active = self.db.get_user_active_promo(1001)
        assert active is not None
        self.assertEqual(active["discount_percent"], 10)

    def test_activate_same_promo_twice_is_idempotent(self):
        self.db.activate_promo_for_user("BLOG10", 1001)
        result = self.db.activate_promo_for_user("BLOG10", 1001)
        self.assertTrue(result["already_active"])

    def test_mark_promo_activation_paid(self):
        self.db.activate_promo_for_user("BLOG10", 1001)
        self.db.mark_promo_activation_paid(1001, "resume-1")
        acts = self.db.list_recent_promo_activations(limit=5)
        self.assertEqual(len(acts), 1)
        self.assertIsNotNone(acts[0]["paid_at"])
        self.assertEqual(acts[0]["resume_id"], "resume-1")

    def test_promo_analytics_counts(self):
        self.db.activate_promo_for_user("BLOG10", 1001)
        analytics = self.db.get_promo_analytics()
        self.assertEqual(len(analytics), 1)
        self.assertEqual(analytics[0]["activations"], 1)
        self.assertEqual(analytics[0]["paid_count"], 0)


class PromoPricingTests(unittest.TestCase):
    def test_discounted_prices(self):
        def apply_discount(price: int, discount_percent: int) -> int:
            if discount_percent <= 0:
                return price
            return max(1, round(price * (1 - discount_percent / 100)))

        self.assertEqual(apply_discount(99, 10), 89)
        self.assertEqual(apply_discount(149, 10), 134)


if __name__ == "__main__":
    unittest.main()
