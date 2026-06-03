import tempfile
import unittest
from datetime import datetime, timedelta
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
        created = (datetime.utcnow() - timedelta(minutes=minutes_ago)).isoformat()
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
        paid_at = datetime.utcnow().isoformat()
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
        old = (datetime.utcnow() - timedelta(days=10)).isoformat()
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


if __name__ == "__main__":
    unittest.main()
