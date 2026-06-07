import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from storage.backends import SQLiteBackend
from services.admin_stats import get_admin_funnel_stats, stats_exclude_telegram_ids


class AdminFunnelStatsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.db = SQLiteBackend(Path(self.tmp.name) / "test.db")

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def _user(self, telegram_id: int) -> str:
        user = self.db.create_user(telegram_id=telegram_id, first_name="T")
        return str(user["id"])

    def _event(self, event: str, telegram_id: int, *, minutes_ago: int = 0, suffix: str = "") -> None:
        created = (datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)).isoformat()
        self.db.insert_analytics_event(
            {
                "id": f"ev-{event}-{telegram_id}-{minutes_ago}-{suffix}",
                "event": event,
                "telegram_id": telegram_id,
                "step": None,
                "metadata": None,
                "created_at": created,
            }
        )

    def test_excludes_founder_and_counts_unique_users(self) -> None:
        founder = stats_exclude_telegram_ids()[0]
        real = 900101

        for i in range(5):
            self._event("preview_viewed", founder, suffix=str(i))
        self._event("onboarding_started", real)
        self._event("generate_started", real)
        self._event("preview_viewed", real, suffix="a")
        self._event("preview_viewed", real, suffix="b")
        self._event("pay_clicked", real)

        stats = get_admin_funnel_stats(self.db, days=7, include_template=True)
        self.assertEqual(stats["onboarding_started"], 1)
        self.assertEqual(stats["preview_viewed"], 1)
        self.assertEqual(stats["pay_clicked"], 1)
        self.assertEqual(stats["payments_real"], 0)

    def test_payments_real_from_db_not_analytics(self) -> None:
        real = 900202
        uid = self._user(real)
        paid_at = datetime.now(timezone.utc).isoformat()
        self.db.create_resume(
            {
                "id": "resume-paid-1",
                "user_id": uid,
                "data": "{}",
                "user_answers": "{}",
                "is_paid": True,
                "paid_at": paid_at,
                "created_at": paid_at,
                "template_id": "classic",
            }
        )
        self._event("onboarding_started", real)

        stats = get_admin_funnel_stats(self.db, days=7, include_template=False)
        self.assertEqual(stats["payments_real"], 1)
        self.assertEqual(stats["conversion_rate"], "100.0%")

    def test_old_events_outside_window_excluded(self) -> None:
        real = 900303
        self._user(real)
        old = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
        self.db.insert_analytics_event(
            {
                "id": "ev-old",
                "event": "onboarding_started",
                "telegram_id": real,
                "step": None,
                "metadata": None,
                "created_at": old,
            }
        )

        stats = get_admin_funnel_stats(self.db, days=7, include_template=False)
        self.assertEqual(stats["onboarding_started"], 0)

    def test_bot_users_excludes_founder_and_respects_window(self) -> None:
        founder = stats_exclude_telegram_ids()[0]
        recent = 900404
        old_user = 900405

        self.db.create_user(telegram_id=founder, first_name="Founder")
        self.db.create_user(telegram_id=recent, first_name="Recent")
        old_created = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
        with self.db._connect() as conn:
            conn.execute(
                """
                INSERT INTO users (id, telegram_id, first_name, last_name, username, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                ("uid-old", old_user, "Old", "", "", old_created),
            )
            conn.commit()

        self._event("mini_app_opened", recent)
        self._event("onboarding_started", recent)

        stats = get_admin_funnel_stats(self.db, days=7, include_template=False)
        self.assertEqual(stats["bot_users"], 1)
        self.assertEqual(stats["bot_users_new"], 1)
        self.assertEqual(stats["users_total"], 1)
        self.assertEqual(stats["bot_starts"], 0)
        self.assertEqual(stats["mini_app_opened"], 1)
        self.assertEqual(stats["onboarding_started"], 1)

    def test_count_users_clean_excludes_founder(self) -> None:
        from services.admin_stats import count_users_clean

        founder = stats_exclude_telegram_ids()[0]
        self.db.create_user(telegram_id=founder, first_name="Founder")
        self.db.create_user(telegram_id=900501, first_name="Real")

        self.assertEqual(count_users_clean(self.db), 1)


if __name__ == "__main__":
    unittest.main()
