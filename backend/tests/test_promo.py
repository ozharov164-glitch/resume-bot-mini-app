"""Promo activation and discounted payment pricing."""

import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from services.promo_service import activate_promo
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
        result = activate_promo(self.db, "blog10", 1001)
        self.assertEqual(result["code"], "BLOG10")

        user = self.db.find_user_by_telegram_id(1001)
        assert user is not None
        self.assertEqual(user["active_promo_code"], "BLOG10")
        self.assertEqual(user["referred_by"], 9001)

        active = self.db.get_user_active_promo(1001)
        assert active is not None
        self.assertEqual(active["discount_percent"], 10)

    def test_same_promo_cannot_be_reactivated(self):
        activate_promo(self.db, "BLOG10", 1001)
        with self.assertRaises(ValueError) as ctx:
            activate_promo(self.db, "BLOG10", 1001)
        self.assertIn("уже использовали", str(ctx.exception).lower())

    def test_cannot_activate_different_promo_within_month(self):
        self.db.create_promo_code("SALE20", owner_tg_id=9002, discount=15, max_uses=50)
        activate_promo(self.db, "BLOG10", 1001)
        with self.assertRaises(ValueError) as ctx:
            activate_promo(self.db, "SALE20", 1001)
        self.assertIn("можно активировать через", str(ctx.exception).lower())
        user = self.db.find_user_by_telegram_id(1001)
        assert user is not None
        self.assertEqual(user["active_promo_code"], "BLOG10")

    def test_can_activate_different_promo_after_cooldown(self):
        self.db.create_promo_code("SALE20", owner_tg_id=9002, discount=15, max_uses=50)
        old = (datetime.now(timezone.utc) - timedelta(days=31)).isoformat()
        with self.db._connect() as conn:
            conn.execute(
                """
                INSERT INTO promo_activations
                (id, promo_code, owner_tg_id, user_tg_id, activated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                ("act-old", "BLOG10", 9001, 1001, old),
            )
            conn.execute(
                "UPDATE users SET active_promo_code = ?, promo_activated_at = ? WHERE telegram_id = ?",
                ("BLOG10", old, 1001),
            )
            conn.commit()

        result = activate_promo(self.db, "SALE20", 1001)
        self.assertEqual(result["code"], "SALE20")
        user = self.db.find_user_by_telegram_id(1001)
        assert user is not None
        self.assertEqual(user["active_promo_code"], "SALE20")

    def test_same_promo_still_blocked_after_cooldown(self):
        old = (datetime.now(timezone.utc) - timedelta(days=31)).isoformat()
        with self.db._connect() as conn:
            conn.execute(
                """
                INSERT INTO promo_activations
                (id, promo_code, owner_tg_id, user_tg_id, activated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                ("act-old", "BLOG10", 9001, 1001, old),
            )
            conn.commit()

        with self.assertRaises(ValueError) as ctx:
            activate_promo(self.db, "BLOG10", 1001)
        self.assertIn("уже использовали", str(ctx.exception).lower())

    def test_mark_promo_activation_paid(self):
        activate_promo(self.db, "BLOG10", 1001)
        self.db.mark_promo_activation_paid(1001, "resume-1")
        acts = self.db.list_recent_promo_activations(limit=5)
        self.assertEqual(len(acts), 1)
        self.assertIsNotNone(acts[0]["paid_at"])
        self.assertEqual(acts[0]["resume_id"], "resume-1")

    def test_promo_analytics_counts(self):
        activate_promo(self.db, "BLOG10", 1001)
        analytics = self.db.get_promo_analytics()
        self.assertEqual(len(analytics), 1)
        self.assertEqual(analytics[0]["activations"], 1)
        self.assertEqual(analytics[0]["paid_count"], 0)

    def test_count_paid_excludes_founder(self):
        founder = self.db.create_user(telegram_id=9001, first_name="Founder")
        buyer = self.db.find_user_by_telegram_id(1001)
        assert buyer is not None
        now = "2026-01-01T12:00:00"
        self.db.create_resume(
            {
                "id": "founder-paid",
                "user_id": founder["id"],
                "data": {"full_name": "Test"},
                "created_at": now,
                "is_paid": True,
                "paid_at": now,
            }
        )
        self.db.create_resume(
            {
                "id": "buyer-paid",
                "user_id": buyer["id"],
                "data": {"full_name": "Real"},
                "created_at": now,
                "is_paid": True,
                "paid_at": now,
            }
        )
        self.assertEqual(self.db.count_paid_resumes(), 2)
        self.assertEqual(self.db.count_paid_resumes(exclude_telegram_ids=[9001]), 1)


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
