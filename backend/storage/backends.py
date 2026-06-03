import json
import logging
import sqlite3
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class SQLiteBackend:
    """Local persistence when Supabase is unavailable."""

    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    telegram_id INTEGER UNIQUE NOT NULL,
                    first_name TEXT DEFAULT '',
                    last_name TEXT DEFAULT '',
                    username TEXT DEFAULT '',
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS resumes (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    data TEXT NOT NULL,
                    user_answers TEXT DEFAULT '{}',
                    is_paid INTEGER NOT NULL DEFAULT 0,
                    paid_at TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );
                CREATE TABLE IF NOT EXISTS promo_codes (
                    id TEXT PRIMARY KEY,
                    code TEXT UNIQUE NOT NULL,
                    owner_tg_id INTEGER DEFAULT NULL,
                    discount_percent INTEGER DEFAULT 10,
                    commission_percent INTEGER DEFAULT 20,
                    max_uses INTEGER DEFAULT 100,
                    uses_count INTEGER DEFAULT 0,
                    is_active INTEGER DEFAULT 1,
                    created_at TEXT NOT NULL,
                    expires_at TEXT DEFAULT NULL
                );
                CREATE TABLE IF NOT EXISTS promo_activations (
                    id TEXT PRIMARY KEY,
                    promo_code TEXT NOT NULL,
                    owner_tg_id INTEGER DEFAULT NULL,
                    user_tg_id INTEGER NOT NULL,
                    activated_at TEXT NOT NULL,
                    paid_at TEXT DEFAULT NULL,
                    resume_id TEXT DEFAULT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_promo_act_user ON promo_activations(user_tg_id);
                CREATE INDEX IF NOT EXISTS idx_promo_act_code ON promo_activations(promo_code);
                CREATE TABLE IF NOT EXISTS analytics_events (
                    id TEXT PRIMARY KEY,
                    event TEXT NOT NULL,
                    telegram_id INTEGER NOT NULL,
                    step INTEGER,
                    metadata TEXT,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_analytics_events_event ON analytics_events(event);
                CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at);
                """
            )
            for col_sql in [
                "ALTER TABLE users ADD COLUMN referred_by INTEGER DEFAULT NULL",
                "ALTER TABLE users ADD COLUMN referral_bonus INTEGER DEFAULT 0",
                "ALTER TABLE users ADD COLUMN bonus_stars INTEGER DEFAULT 0",
                "ALTER TABLE users ADD COLUMN active_promo_code TEXT DEFAULT NULL",
                "ALTER TABLE users ADD COLUMN promo_activated_at TEXT DEFAULT NULL",
                "ALTER TABLE resumes ADD COLUMN promo_code TEXT DEFAULT NULL",
                "ALTER TABLE resumes ADD COLUMN discount_applied INTEGER DEFAULT 0",
                "ALTER TABLE resumes ADD COLUMN final_price_stars INTEGER DEFAULT NULL",
                "ALTER TABLE resumes ADD COLUMN final_price_rub INTEGER DEFAULT NULL",
                "ALTER TABLE resumes ADD COLUMN template_id TEXT DEFAULT 'classic'",
                "ALTER TABLE users ADD COLUMN is_affiliate INTEGER DEFAULT 0",
                "ALTER TABLE resumes ADD COLUMN hh_text TEXT DEFAULT NULL",
                "ALTER TABLE resumes ADD COLUMN re_engagement_sent INTEGER DEFAULT 0",
            ]:
                try:
                    conn.execute(col_sql)
                except Exception:
                    pass

    def save_referral(self, referrer_tg_id: int, referee_tg_id: int) -> None:
        try:
            with self._connect() as conn:
                conn.execute(
                    "UPDATE users SET referred_by = ? WHERE telegram_id = ?",
                    (referrer_tg_id, referee_tg_id),
                )
                conn.commit()
        except Exception as e:
            logger.warning("save_referral failed: %s", e)

    @staticmethod
    def _row_to_dict(row: sqlite3.Row | None) -> dict | None:
        if row is None:
            return None
        data = dict(row)
        if "data" in data and isinstance(data["data"], str):
            try:
                data["data"] = json.loads(data["data"])
            except json.JSONDecodeError:
                pass
        if "user_answers" in data and isinstance(data["user_answers"], str):
            try:
                data["user_answers"] = json.loads(data["user_answers"])
            except json.JSONDecodeError:
                pass
        if "is_paid" in data:
            data["is_paid"] = bool(data["is_paid"])
        return data

    def find_user_by_telegram_id(self, telegram_id: int) -> dict | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE telegram_id = ? LIMIT 1",
                (telegram_id,),
            ).fetchone()
        return self._row_to_dict(row)

    def find_user_by_id(self, user_id: str) -> dict | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE id = ? LIMIT 1",
                (user_id,),
            ).fetchone()
        return self._row_to_dict(row)

    def create_user(
        self,
        *,
        telegram_id: int,
        first_name: str = "",
        last_name: str = "",
        username: str = "",
    ) -> dict:
        user_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO users (id, telegram_id, first_name, last_name, username, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (user_id, telegram_id, first_name, last_name, username, now),
            )
        user = self.find_user_by_telegram_id(telegram_id)
        if not user:
            raise RuntimeError("Failed to create user in SQLite")
        return user

    def find_resume(self, resume_id: str, user_id: str | None = None) -> dict | None:
        with self._connect() as conn:
            if user_id:
                row = conn.execute(
                    "SELECT * FROM resumes WHERE id = ? AND user_id = ? LIMIT 1",
                    (resume_id, user_id),
                ).fetchone()
            else:
                row = conn.execute(
                    "SELECT * FROM resumes WHERE id = ? LIMIT 1",
                    (resume_id,),
                ).fetchone()
        return self._row_to_dict(row)

    def create_resume(self, record: dict[str, Any]) -> None:
        data = record["data"]
        answers = record.get("user_answers", {})
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO resumes (id, user_id, data, user_answers, is_paid, paid_at, created_at, template_id, hh_text)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record["id"],
                    record["user_id"],
                    json.dumps(data, ensure_ascii=False),
                    json.dumps(answers, ensure_ascii=False),
                    1 if record.get("is_paid") else 0,
                    record.get("paid_at"),
                    record["created_at"],
                    record.get("template_id") or "classic",
                    record.get("hh_text"),
                ),
            )

    def update_resume(self, resume_id: str, fields: dict[str, Any]) -> None:
        allowed = {
            k: v
            for k, v in fields.items()
            if k
            in {
                "is_paid",
                "paid_at",
                "data",
                "user_answers",
                "promo_code",
                "discount_applied",
                "final_price_stars",
                "final_price_rub",
                "template_id",
                "hh_text",
            }
        }
        if not allowed:
            return
        if "data" in allowed and not isinstance(allowed["data"], str):
            allowed["data"] = json.dumps(allowed["data"], ensure_ascii=False)
        if "user_answers" in allowed and not isinstance(allowed["user_answers"], str):
            allowed["user_answers"] = json.dumps(allowed["user_answers"], ensure_ascii=False)
        if "is_paid" in allowed:
            allowed["is_paid"] = 1 if allowed["is_paid"] else 0
        cols = ", ".join(f"{k} = ?" for k in allowed)
        values = list(allowed.values()) + [resume_id]
        with self._connect() as conn:
            conn.execute(f"UPDATE resumes SET {cols} WHERE id = ?", values)

    def count_resumes(self) -> int:
        with self._connect() as conn:
            row = conn.execute("SELECT COUNT(*) AS c FROM resumes").fetchone()
        return int(row["c"]) if row else 0

    def count_users(self) -> int:
        with self._connect() as conn:
            row = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()
        return int(row["c"]) if row else 0

    def list_user_telegram_ids(self) -> list[int]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT telegram_id FROM users ORDER BY created_at ASC"
            ).fetchall()
        return [int(row["telegram_id"]) for row in rows]

    def count_paid_resumes(self, exclude_telegram_ids: list[int] | None = None) -> int:
        with self._connect() as conn:
            if exclude_telegram_ids:
                placeholders = ",".join("?" * len(exclude_telegram_ids))
                row = conn.execute(
                    f"""
                    SELECT COUNT(*) AS c FROM resumes r
                    INNER JOIN users u ON u.id = r.user_id
                    WHERE r.is_paid = 1 AND u.telegram_id NOT IN ({placeholders})
                    """,
                    exclude_telegram_ids,
                ).fetchone()
            else:
                row = conn.execute("SELECT COUNT(*) AS c FROM resumes WHERE is_paid = 1").fetchone()
        return int(row["c"]) if row else 0

    def count_resumes_today(self, exclude_telegram_ids: list[int] | None = None) -> int:
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        try:
            with self._connect() as conn:
                if exclude_telegram_ids:
                    placeholders = ",".join("?" * len(exclude_telegram_ids))
                    row = conn.execute(
                        f"""
                        SELECT COUNT(*) AS c FROM resumes r
                        INNER JOIN users u ON u.id = r.user_id
                        WHERE r.created_at >= ? AND u.telegram_id NOT IN ({placeholders})
                        """,
                        (today_start, *exclude_telegram_ids),
                    ).fetchone()
                else:
                    row = conn.execute(
                        "SELECT COUNT(*) AS c FROM resumes WHERE created_at >= ?",
                        (today_start,),
                    ).fetchone()
            return int(row["c"]) if row else 0
        except Exception as e:
            logger.warning("count_resumes_today failed: %s", e)
            return 0

    def validate_promo_code(self, code: str, user_tg_id: int) -> dict | None:
        del user_tg_id  # reserved for future per-user limits
        try:
            with self._connect() as conn:
                row = conn.execute(
                    "SELECT * FROM promo_codes WHERE UPPER(code) = UPPER(?) AND is_active = 1 LIMIT 1",
                    (code.strip(),),
                ).fetchone()
            if not row:
                return None
            promo = dict(row)
            max_uses = promo.get("max_uses")
            uses_count = promo.get("uses_count") or 0
            if max_uses and uses_count >= max_uses:
                return None
            expires_at = promo.get("expires_at")
            if expires_at and expires_at < datetime.utcnow().isoformat():
                return None
            return promo
        except Exception as e:
            logger.warning("validate_promo_code failed: %s", e)
            return None

    def use_promo_code(self, code: str, resume_id: str) -> None:
        upper = code.strip().upper()
        with self._connect() as conn:
            conn.execute(
                "UPDATE promo_codes SET uses_count = uses_count + 1 WHERE UPPER(code) = ?",
                (upper,),
            )
            conn.execute(
                "UPDATE resumes SET promo_code = ? WHERE id = ?",
                (upper, resume_id),
            )
            conn.commit()

    def create_promo_code(
        self,
        code: str,
        owner_tg_id: int | None = None,
        discount: int = 10,
        commission: int = 20,
        max_uses: int = 100,
    ) -> dict:
        promo_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO promo_codes
                (id, code, owner_tg_id, discount_percent, commission_percent, max_uses, uses_count, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?)
                """,
                (promo_id, code.strip().upper(), owner_tg_id, discount, commission, max_uses, now),
            )
            conn.commit()
        return {"id": promo_id, "code": code.strip().upper(), "discount_percent": discount}

    def list_promo_codes(self) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM promo_codes ORDER BY created_at DESC"
            ).fetchall()
        return [dict(r) for r in rows]

    def activate_promo_for_user(self, code: str, user_tg_id: int) -> dict:
        promo = self.validate_promo_code(code, user_tg_id)
        if not promo:
            raise ValueError("Промокод не найден или недействителен.")
        upper_code = str(promo["code"]).strip().upper()
        user = self.find_user_by_telegram_id(user_tg_id)
        if user and user.get("active_promo_code") == upper_code:
            return {"already_active": True, **promo}

        now = datetime.utcnow().isoformat()
        owner = promo.get("owner_tg_id")
        with self._connect() as conn:
            conn.execute(
                "UPDATE users SET active_promo_code = ?, promo_activated_at = ? WHERE telegram_id = ?",
                (upper_code, now, user_tg_id),
            )
            if owner and not self.is_user_affiliate(int(owner)):
                conn.execute(
                    "UPDATE users SET referred_by = ? WHERE telegram_id = ? AND referred_by IS NULL",
                    (int(owner), user_tg_id),
                )
            conn.execute(
                """
                INSERT INTO promo_activations (id, promo_code, owner_tg_id, user_tg_id, activated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (str(uuid.uuid4()), upper_code, owner, user_tg_id, now),
            )
            conn.commit()
        return {"already_active": False, **promo}

    def get_user_active_promo(self, user_tg_id: int) -> dict | None:
        user = self.find_user_by_telegram_id(user_tg_id)
        if not user or not user.get("active_promo_code"):
            return None
        return self.validate_promo_code(user["active_promo_code"], user_tg_id)

    def mark_promo_activation_paid(self, user_tg_id: int, resume_id: str) -> None:
        user = self.find_user_by_telegram_id(user_tg_id)
        if not user or not user.get("active_promo_code"):
            return
        code = user["active_promo_code"]
        now = datetime.utcnow().isoformat()
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE promo_activations
                SET paid_at = ?, resume_id = ?
                WHERE id = (
                    SELECT id FROM promo_activations
                    WHERE user_tg_id = ? AND promo_code = ? AND paid_at IS NULL
                    ORDER BY activated_at DESC
                    LIMIT 1
                )
                """,
                (now, resume_id, user_tg_id, code),
            )
            conn.commit()

    def get_promo_analytics(self, exclude_telegram_ids: list[int] | None = None) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM promo_codes ORDER BY created_at DESC").fetchall()
            out: list[dict] = []
            for row in rows:
                promo = dict(row)
                code = promo["code"]
                if exclude_telegram_ids:
                    placeholders = ",".join("?" * len(exclude_telegram_ids))
                    act = conn.execute(
                        f"""
                        SELECT COUNT(*) AS c FROM promo_activations
                        WHERE promo_code = ? AND user_tg_id NOT IN ({placeholders})
                        """,
                        (code, *exclude_telegram_ids),
                    ).fetchone()
                    paid = conn.execute(
                        f"""
                        SELECT COUNT(*) AS c FROM promo_activations
                        WHERE promo_code = ? AND paid_at IS NOT NULL
                          AND user_tg_id NOT IN ({placeholders})
                        """,
                        (code, *exclude_telegram_ids),
                    ).fetchone()
                else:
                    act = conn.execute(
                        "SELECT COUNT(*) AS c FROM promo_activations WHERE promo_code = ?",
                        (code,),
                    ).fetchone()
                    paid = conn.execute(
                        """
                        SELECT COUNT(*) AS c FROM promo_activations
                        WHERE promo_code = ? AND paid_at IS NOT NULL
                        """,
                        (code,),
                    ).fetchone()
                promo["activations"] = int(act["c"]) if act else 0
                promo["paid_count"] = int(paid["c"]) if paid else 0
                out.append(promo)
            return out

    def is_user_affiliate(self, telegram_id: int) -> bool:
        user = self.find_user_by_telegram_id(telegram_id)
        if not user:
            return False
        return bool(user.get("is_affiliate"))

    def set_user_affiliate(self, telegram_id: int, *, is_affiliate: bool) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE users SET is_affiliate = ? WHERE telegram_id = ?",
                (1 if is_affiliate else 0, telegram_id),
            )
            conn.commit()

    def deactivate_promos_by_owner(self, owner_tg_id: int) -> list[str]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT code FROM promo_codes WHERE owner_tg_id = ? AND is_active = 1",
                (owner_tg_id,),
            ).fetchall()
            codes = [str(r["code"]) for r in rows]
            if codes:
                conn.execute(
                    "UPDATE promo_codes SET is_active = 0 WHERE owner_tg_id = ?",
                    (owner_tg_id,),
                )
                conn.commit()
            return codes

    def list_promo_codes_by_owner(self, owner_tg_id: int) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM promo_codes WHERE owner_tg_id = ? ORDER BY created_at DESC",
                (owner_tg_id,),
            ).fetchall()
        return [dict(r) for r in rows]

    def list_affiliate_users(self) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM users WHERE is_affiliate = 1 ORDER BY created_at DESC"
            ).fetchall()
        return [dict(r) for r in rows]

    def list_recent_promo_activations(self, limit: int = 20) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT pa.*, u.first_name, u.username
                FROM promo_activations pa
                LEFT JOIN users u ON u.telegram_id = pa.user_tg_id
                ORDER BY pa.activated_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]

    def increment_referral_bonus(self, telegram_id: int) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE users SET referral_bonus = referral_bonus + 1 WHERE telegram_id = ?",
                (telegram_id,),
            )
            conn.commit()

    def get_referral_bonus(self, telegram_id: int) -> int:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT referral_bonus FROM users WHERE telegram_id = ? LIMIT 1",
                (telegram_id,),
            ).fetchone()
        if not row:
            return 0
        return int(row["referral_bonus"] or 0)

    def use_referral_bonus(self, telegram_id: int) -> bool:
        if self.get_referral_bonus(telegram_id) <= 0:
            return False
        with self._connect() as conn:
            conn.execute(
                "UPDATE users SET referral_bonus = referral_bonus - 1 WHERE telegram_id = ?",
                (telegram_id,),
            )
            conn.commit()
        return True

    def count_referred_users(self) -> int:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT COUNT(*) AS c FROM users WHERE referred_by IS NOT NULL"
            ).fetchone()
        return int(row["c"]) if row else 0

    def top_referrers(self, limit: int = 10) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT u.referred_by AS referrer_id,
                       COUNT(*) AS invited,
                       COALESCE(ref.first_name, '') AS first_name,
                       COALESCE(ref.username, '') AS username
                FROM users u
                LEFT JOIN users ref ON ref.telegram_id = u.referred_by
                WHERE u.referred_by IS NOT NULL
                GROUP BY u.referred_by
                ORDER BY invited DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]

    def list_resumes_for_user(self, user_id: str, limit: int = 30) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, data, user_answers, is_paid, created_at, template_id
                FROM resumes
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (user_id, limit),
            ).fetchall()
        items: list[dict[str, Any]] = []
        for row in rows:
            record = self._row_to_dict(row)
            if not record:
                continue
            data = record.get("data") or {}
            if isinstance(data, str):
                try:
                    data = json.loads(data)
                except json.JSONDecodeError:
                    data = {}
            items.append(
                {
                    "id": record["id"],
                    "full_name": data.get("full_name", ""),
                    "target_position": data.get("target_position", ""),
                    "is_paid": bool(record.get("is_paid")),
                    "created_at": record.get("created_at"),
                    "template_id": record.get("template_id") or "classic",
                }
            )
        return items

    def insert_analytics_event(self, record: dict[str, Any]) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO analytics_events (id, event, telegram_id, step, metadata, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    record["id"],
                    record["event"],
                    int(record["telegram_id"]),
                    record.get("step"),
                    record.get("metadata"),
                    record["created_at"],
                ),
            )
            conn.commit()

    def count_analytics_events_since(self, event: str, since_iso: str) -> int:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT COUNT(*) AS c FROM analytics_events
                WHERE event = ? AND created_at >= ?
                """,
                (event, since_iso),
            ).fetchone()
        return int(row["c"]) if row else 0

    def count_analytics_unique_users_since(
        self,
        event: str,
        since_iso: str,
        exclude_telegram_ids: list[int] | None = None,
    ) -> int:
        with self._connect() as conn:
            if exclude_telegram_ids:
                placeholders = ",".join("?" * len(exclude_telegram_ids))
                row = conn.execute(
                    f"""
                    SELECT COUNT(DISTINCT telegram_id) AS c FROM analytics_events
                    WHERE event = ? AND created_at >= ?
                      AND telegram_id NOT IN ({placeholders})
                    """,
                    (event, since_iso, *exclude_telegram_ids),
                ).fetchone()
            else:
                row = conn.execute(
                    """
                    SELECT COUNT(DISTINCT telegram_id) AS c FROM analytics_events
                    WHERE event = ? AND created_at >= ?
                    """,
                    (event, since_iso),
                ).fetchone()
        return int(row["c"]) if row else 0

    def count_paid_resumes_since(
        self,
        since_iso: str,
        exclude_telegram_ids: list[int] | None = None,
    ) -> int:
        with self._connect() as conn:
            if exclude_telegram_ids:
                placeholders = ",".join("?" * len(exclude_telegram_ids))
                row = conn.execute(
                    f"""
                    SELECT COUNT(*) AS c FROM resumes r
                    INNER JOIN users u ON u.id = r.user_id
                    WHERE r.is_paid = 1
                      AND r.paid_at IS NOT NULL
                      AND r.paid_at >= ?
                      AND u.telegram_id NOT IN ({placeholders})
                    """,
                    (since_iso, *exclude_telegram_ids),
                ).fetchone()
            else:
                row = conn.execute(
                    """
                    SELECT COUNT(*) AS c FROM resumes
                    WHERE is_paid = 1 AND paid_at IS NOT NULL AND paid_at >= ?
                    """,
                    (since_iso,),
                ).fetchone()
        return int(row["c"]) if row else 0

    def get_referral_stats(self, telegram_id: int) -> dict[str, int]:
        with self._connect() as conn:
            invited_row = conn.execute(
                "SELECT COUNT(*) AS c FROM users WHERE referred_by = ?",
                (telegram_id,),
            ).fetchone()
            paid_row = conn.execute(
                """
                SELECT COUNT(DISTINCT u.telegram_id) AS c
                FROM users u
                INNER JOIN resumes r ON r.user_id = u.id AND r.is_paid = 1
                WHERE u.referred_by = ?
                """,
                (telegram_id,),
            ).fetchone()
        return {
            "invited": int(invited_row["c"] if invited_row else 0),
            "paid_referrals": int(paid_row["c"] if paid_row else 0),
            "bonus_stars": self.get_bonus_stars(telegram_id),
        }

    def get_bonus_stars(self, telegram_id: int) -> int:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT bonus_stars FROM users WHERE telegram_id = ? LIMIT 1",
                (telegram_id,),
            ).fetchone()
        if not row:
            return 0
        return int(row["bonus_stars"] or 0)

    def add_bonus_stars(self, telegram_id: int, amount: int) -> None:
        if amount <= 0:
            return
        with self._connect() as conn:
            conn.execute(
                "UPDATE users SET bonus_stars = COALESCE(bonus_stars, 0) + ? WHERE telegram_id = ?",
                (amount, telegram_id),
            )
            conn.commit()

    def use_bonus_stars(self, telegram_id: int, amount: int) -> int:
        """Deduct up to `amount` bonus stars; returns stars actually applied."""
        available = self.get_bonus_stars(telegram_id)
        applied = min(available, max(0, amount))
        if applied <= 0:
            return 0
        with self._connect() as conn:
            conn.execute(
                "UPDATE users SET bonus_stars = bonus_stars - ? WHERE telegram_id = ?",
                (applied, telegram_id),
            )
            conn.commit()
        return applied

    def delete_all_resumes_for_user(self, user_id: str) -> int:
        with self._connect() as conn:
            cur = conn.execute("DELETE FROM resumes WHERE user_id = ?", (user_id,))
            conn.commit()
            return int(cur.rowcount or 0)

    def list_unpaid_for_reengagement(
        self, min_age_hours: int = 3, max_age_hours: int = 24
    ) -> list[dict]:
        created_after = (datetime.utcnow() - timedelta(hours=max_age_hours)).isoformat()
        created_before = (datetime.utcnow() - timedelta(hours=min_age_hours)).isoformat()
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT r.id AS resume_id,
                       u.telegram_id AS telegram_id,
                       json_extract(r.data, '$.target_position') AS target_position,
                       r.created_at AS created_at
                FROM resumes r
                JOIN users u ON r.user_id = u.id
                WHERE r.is_paid = 0
                  AND COALESCE(r.re_engagement_sent, 0) = 0
                  AND r.created_at >= ?
                  AND r.created_at <= ?
                ORDER BY r.created_at ASC
                LIMIT 50
                """,
                (created_after, created_before),
            ).fetchall()
        out: list[dict] = []
        for row in rows:
            rec = dict(row)
            position = rec.get("target_position")
            if position is not None and not isinstance(position, str):
                position = str(position)
            rec["target_position"] = position or ""
            out.append(rec)
        return out

    def mark_reengagement_sent(self, resume_id: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE resumes SET re_engagement_sent = 1 WHERE id = ?",
                (resume_id,),
            )
            conn.commit()


class SupabaseBackend:
    def __init__(self, client: Any) -> None:
        self.client = client

    def find_user_by_telegram_id(self, telegram_id: int) -> dict | None:
        result = (
            self.client.table("users").select("*").eq("telegram_id", telegram_id).limit(1).execute()
        )
        return result.data[0] if result.data else None

    def find_user_by_id(self, user_id: str) -> dict | None:
        result = self.client.table("users").select("*").eq("id", user_id).limit(1).execute()
        return result.data[0] if result.data else None

    def create_user(
        self,
        *,
        telegram_id: int,
        first_name: str = "",
        last_name: str = "",
        username: str = "",
    ) -> dict:
        self.client.table("users").insert(
            {
                "telegram_id": telegram_id,
                "first_name": first_name,
                "last_name": last_name,
                "username": username,
                "created_at": datetime.utcnow().isoformat(),
            }
        ).execute()
        user = self.find_user_by_telegram_id(telegram_id)
        if not user:
            raise RuntimeError("Failed to create user in Supabase")
        return user

    def find_resume(self, resume_id: str, user_id: str | None = None) -> dict | None:
        query = self.client.table("resumes").select("*").eq("id", resume_id)
        if user_id:
            query = query.eq("user_id", user_id)
        result = query.limit(1).execute()
        return result.data[0] if result.data else None

    def create_resume(self, record: dict[str, Any]) -> None:
        self.client.table("resumes").insert(record).execute()

    def update_resume(self, resume_id: str, fields: dict[str, Any]) -> None:
        self.client.table("resumes").update(fields).eq("id", resume_id).execute()

    def count_resumes(self) -> int:
        result = self.client.table("resumes").select("id", count="exact").execute()
        if result.count is not None:
            return int(result.count)
        return len(result.data or [])

    def count_users(self) -> int:
        result = self.client.table("users").select("id", count="exact").execute()
        if result.count is not None:
            return int(result.count)
        return len(result.data or [])

    def list_user_telegram_ids(self) -> list[int]:
        page_size = 1000
        offset = 0
        ids: list[int] = []
        while True:
            result = (
                self.client.table("users")
                .select("telegram_id")
                .order("created_at")
                .range(offset, offset + page_size - 1)
                .execute()
            )
            batch = result.data or []
            if not batch:
                break
            ids.extend(int(row["telegram_id"]) for row in batch)
            if len(batch) < page_size:
                break
            offset += page_size
        return ids

    def count_paid_resumes(self, exclude_telegram_ids: list[int] | None = None) -> int:
        query = (
            self.client.table("resumes")
            .select("id", count="exact")
            .eq("is_paid", True)
        )
        if exclude_telegram_ids:
            exclude_user_ids = self._user_ids_for_telegram_ids(exclude_telegram_ids)
            if exclude_user_ids:
                query = query.not_.in_("user_id", exclude_user_ids)
        result = query.execute()
        if result.count is not None:
            return int(result.count)
        return len(result.data or [])

    def _user_ids_for_telegram_ids(self, telegram_ids: list[int]) -> list[str]:
        out: list[str] = []
        for tg_id in telegram_ids:
            user = self.find_user_by_telegram_id(tg_id)
            if user and user.get("id"):
                out.append(str(user["id"]))
        return out

    def list_resumes_for_user(self, user_id: str, limit: int = 30) -> list[dict[str, Any]]:
        result = (
            self.client.table("resumes")
            .select("id, data, is_paid, created_at, template_id")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        items: list[dict[str, Any]] = []
        for record in result.data or []:
            data = record.get("data") or {}
            if isinstance(data, str):
                try:
                    data = json.loads(data)
                except json.JSONDecodeError:
                    data = {}
            items.append(
                {
                    "id": record["id"],
                    "full_name": data.get("full_name", ""),
                    "target_position": data.get("target_position", ""),
                    "is_paid": bool(record.get("is_paid")),
                    "created_at": record.get("created_at"),
                    "template_id": record.get("template_id") or "classic",
                }
            )
        return items

    def insert_analytics_event(self, record: dict[str, Any]) -> None:
        try:
            self.client.table("analytics_events").insert(record).execute()
        except Exception as exc:
            logger.warning("insert_analytics_event failed: %s", exc)

    def count_analytics_events_since(self, event: str, since_iso: str) -> int:
        try:
            result = (
                self.client.table("analytics_events")
                .select("id", count="exact")
                .eq("event", event)
                .gte("created_at", since_iso)
                .execute()
            )
            return int(result.count or 0)
        except Exception:
            return 0

    def count_analytics_unique_users_since(
        self,
        event: str,
        since_iso: str,
        exclude_telegram_ids: list[int] | None = None,
    ) -> int:
        try:
            query = (
                self.client.table("analytics_events")
                .select("telegram_id")
                .eq("event", event)
                .gte("created_at", since_iso)
            )
            if exclude_telegram_ids:
                query = query.not_.in_("telegram_id", exclude_telegram_ids)
            result = query.execute()
            seen: set[int] = set()
            for row in result.data or []:
                tid = row.get("telegram_id")
                if tid is not None:
                    seen.add(int(tid))
            return len(seen)
        except Exception:
            return 0

    def count_paid_resumes_since(
        self,
        since_iso: str,
        exclude_telegram_ids: list[int] | None = None,
    ) -> int:
        try:
            query = (
                self.client.table("resumes")
                .select("id, user_id, paid_at, users!inner(telegram_id)")
                .eq("is_paid", True)
                .gte("paid_at", since_iso)
            )
            if exclude_telegram_ids:
                query = query.not_.in_("users.telegram_id", exclude_telegram_ids)
            result = query.execute()
            return len(result.data or [])
        except Exception:
            try:
                rows = (
                    self.client.table("resumes")
                    .select("id, user_id, paid_at")
                    .eq("is_paid", True)
                    .gte("paid_at", since_iso)
                    .execute()
                ).data or []
                if not exclude_telegram_ids:
                    return len(rows)
                exclude_user_ids = set(self._user_ids_for_telegram_ids(exclude_telegram_ids))
                return sum(1 for r in rows if r.get("user_id") not in exclude_user_ids)
            except Exception:
                return 0

    def get_referral_stats(self, telegram_id: int) -> dict[str, int]:
        try:
            invited_result = (
                self.client.table("users")
                .select("telegram_id", count="exact")
                .eq("referred_by", telegram_id)
                .execute()
            )
            invited = int(invited_result.count or 0)
            refs = (
                self.client.table("users")
                .select("id")
                .eq("referred_by", telegram_id)
                .execute()
            )
            user_ids = [str(r["id"]) for r in (refs.data or []) if r.get("id")]
            paid_referrals = 0
            if user_ids:
                paid_rows = (
                    self.client.table("resumes")
                    .select("user_id")
                    .eq("is_paid", True)
                    .in_("user_id", user_ids)
                    .execute()
                )
                paid_referrals = len(
                    {str(r["user_id"]) for r in (paid_rows.data or []) if r.get("user_id")}
                )
        except Exception as exc:
            logger.warning("get_referral_stats failed telegram_id=%s: %s", telegram_id, exc)
            invited = 0
            paid_referrals = 0
        return {
            "invited": invited,
            "paid_referrals": paid_referrals,
            "bonus_stars": self.get_bonus_stars(telegram_id),
        }

    def get_bonus_stars(self, telegram_id: int) -> int:
        user = self.find_user_by_telegram_id(telegram_id)
        if not user:
            return 0
        return int(user.get("bonus_stars") or 0)

    def add_bonus_stars(self, telegram_id: int, amount: int) -> None:
        if amount <= 0:
            return
        user = self.find_user_by_telegram_id(telegram_id)
        if not user:
            return
        current = int(user.get("bonus_stars") or 0)
        self.client.table("users").update({"bonus_stars": current + amount}).eq(
            "telegram_id", telegram_id
        ).execute()

    def use_bonus_stars(self, telegram_id: int, amount: int) -> int:
        available = self.get_bonus_stars(telegram_id)
        applied = min(available, max(0, amount))
        if applied <= 0:
            return 0
        self.client.table("users").update({"bonus_stars": available - applied}).eq(
            "telegram_id", telegram_id
        ).execute()
        return applied

    def delete_all_resumes_for_user(self, user_id: str) -> int:
        result = self.client.table("resumes").delete().eq("user_id", user_id).execute()
        return len(result.data or [])

    def save_referral(self, referrer_tg_id: int, referee_tg_id: int) -> None:
        try:
            self.client.table("users").update({"referred_by": referrer_tg_id}).eq(
                "telegram_id", referee_tg_id
            ).execute()
        except Exception as e:
            logger.warning("save_referral failed: %s", e)

    def count_resumes_today(self, exclude_telegram_ids: list[int] | None = None) -> int:
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        try:
            query = (
                self.client.table("resumes")
                .select("id", count="exact")
                .gte("created_at", today_start)
            )
            if exclude_telegram_ids:
                exclude_user_ids = self._user_ids_for_telegram_ids(exclude_telegram_ids)
                if exclude_user_ids:
                    query = query.not_.in_("user_id", exclude_user_ids)
            result = query.execute()
            if result.count is not None:
                return int(result.count)
            return len(result.data or [])
        except Exception as e:
            logger.warning("count_resumes_today failed: %s", e)
            return 0

    def validate_promo_code(self, code: str, user_tg_id: int) -> dict | None:
        del user_tg_id
        try:
            result = (
                self.client.table("promo_codes")
                .select("*")
                .ilike("code", code.strip())
                .eq("is_active", True)
                .limit(1)
                .execute()
            )
            if not result.data:
                return None
            promo = result.data[0]
            max_uses = promo.get("max_uses")
            uses_count = promo.get("uses_count") or 0
            if max_uses and uses_count >= max_uses:
                return None
            expires_at = promo.get("expires_at")
            if expires_at and expires_at < datetime.utcnow().isoformat():
                return None
            return promo
        except Exception as e:
            logger.warning("validate_promo_code failed: %s", e)
            return None

    def use_promo_code(self, code: str, resume_id: str) -> None:
        upper = code.strip().upper()
        row = (
            self.client.table("promo_codes")
            .select("uses_count")
            .ilike("code", code.strip())
            .limit(1)
            .execute()
        )
        if row.data:
            current = row.data[0].get("uses_count") or 0
            self.client.table("promo_codes").update({"uses_count": current + 1}).ilike(
                "code", code.strip()
            ).execute()
        self.client.table("resumes").update({"promo_code": upper}).eq("id", resume_id).execute()

    def create_promo_code(
        self,
        code: str,
        owner_tg_id: int | None = None,
        discount: int = 10,
        commission: int = 20,
        max_uses: int = 100,
    ) -> dict:
        promo_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        upper = code.strip().upper()
        self.client.table("promo_codes").insert(
            {
                "id": promo_id,
                "code": upper,
                "owner_tg_id": owner_tg_id,
                "discount_percent": discount,
                "commission_percent": commission,
                "max_uses": max_uses,
                "uses_count": 0,
                "is_active": True,
                "created_at": now,
            }
        ).execute()
        return {"id": promo_id, "code": upper, "discount_percent": discount}

    def list_promo_codes(self) -> list[dict]:
        result = (
            self.client.table("promo_codes")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []

    def activate_promo_for_user(self, code: str, user_tg_id: int) -> dict:
        promo = self.validate_promo_code(code, user_tg_id)
        if not promo:
            raise ValueError("Промокод не найден или недействителен.")
        upper_code = str(promo["code"]).strip().upper()
        user = self.find_user_by_telegram_id(user_tg_id)
        if user and user.get("active_promo_code") == upper_code:
            return {"already_active": True, **promo}

        now = datetime.utcnow().isoformat()
        owner = promo.get("owner_tg_id")
        self.client.table("users").update(
            {"active_promo_code": upper_code, "promo_activated_at": now}
        ).eq("telegram_id", user_tg_id).execute()
        if owner and user and not user.get("referred_by") and not self.is_user_affiliate(
            int(owner)
        ):
            self.client.table("users").update({"referred_by": int(owner)}).eq(
                "telegram_id", user_tg_id
            ).execute()
        self.client.table("promo_activations").insert(
            {
                "id": str(uuid.uuid4()),
                "promo_code": upper_code,
                "owner_tg_id": owner,
                "user_tg_id": user_tg_id,
                "activated_at": now,
            }
        ).execute()
        return {"already_active": False, **promo}

    def get_user_active_promo(self, user_tg_id: int) -> dict | None:
        user = self.find_user_by_telegram_id(user_tg_id)
        if not user or not user.get("active_promo_code"):
            return None
        return self.validate_promo_code(user["active_promo_code"], user_tg_id)

    def mark_promo_activation_paid(self, user_tg_id: int, resume_id: str) -> None:
        user = self.find_user_by_telegram_id(user_tg_id)
        if not user or not user.get("active_promo_code"):
            return
        code = user["active_promo_code"]
        now = datetime.utcnow().isoformat()
        try:
            pending = (
                self.client.table("promo_activations")
                .select("id")
                .eq("user_tg_id", user_tg_id)
                .eq("promo_code", code)
                .is_("paid_at", "null")
                .order("activated_at", desc=True)
                .limit(1)
                .execute()
            )
            if not pending.data:
                return
            act_id = pending.data[0]["id"]
            self.client.table("promo_activations").update(
                {"paid_at": now, "resume_id": resume_id}
            ).eq("id", act_id).execute()
        except Exception as e:
            logger.warning("mark_promo_activation_paid failed: %s", e)

    def get_promo_analytics(self, exclude_telegram_ids: list[int] | None = None) -> list[dict]:
        promos = self.list_promo_codes()
        out: list[dict] = []
        for promo in promos:
            code = promo["code"]
            try:
                acts_query = (
                    self.client.table("promo_activations")
                    .select("id", count="exact")
                    .eq("promo_code", code)
                )
                paid_query = (
                    self.client.table("promo_activations")
                    .select("id", count="exact")
                    .eq("promo_code", code)
                    .not_.is_("paid_at", "null")
                )
                if exclude_telegram_ids:
                    acts_query = acts_query.not_.in_("user_tg_id", exclude_telegram_ids)
                    paid_query = paid_query.not_.in_("user_tg_id", exclude_telegram_ids)
                acts = acts_query.execute()
                paid = paid_query.execute()
                promo["activations"] = int(acts.count or len(acts.data or []))
                promo["paid_count"] = int(paid.count or len(paid.data or []))
            except Exception as e:
                logger.warning("get_promo_analytics failed for %s: %s", code, e)
                promo["activations"] = 0
                promo["paid_count"] = 0
            out.append(promo)
        return out

    def list_recent_promo_activations(self, limit: int = 20) -> list[dict]:
        try:
            result = (
                self.client.table("promo_activations")
                .select("*")
                .order("activated_at", desc=True)
                .limit(limit)
                .execute()
            )
            rows = result.data or []
            out: list[dict] = []
            for row in rows:
                user = self.find_user_by_telegram_id(int(row["user_tg_id"]))
                row["first_name"] = (user or {}).get("first_name", "")
                row["username"] = (user or {}).get("username", "")
                out.append(row)
            return out
        except Exception as e:
            logger.warning("list_recent_promo_activations failed: %s", e)
            return []

    def count_referred_users(self) -> int:
        try:
            result = (
                self.client.table("users")
                .select("id", count="exact")
                .not_.is_("referred_by", "null")
                .execute()
            )
            if result.count is not None:
                return int(result.count)
            return len(result.data or [])
        except Exception as e:
            logger.warning("count_referred_users failed: %s", e)
            return 0

    def top_referrers(self, limit: int = 10) -> list[dict[str, Any]]:
        from collections import Counter

        try:
            result = (
                self.client.table("users")
                .select("referred_by")
                .not_.is_("referred_by", "null")
                .execute()
            )
        except Exception as e:
            logger.warning("top_referrers failed: %s", e)
            return []
        counts = Counter(
            r["referred_by"] for r in (result.data or []) if r.get("referred_by")
        )
        out: list[dict[str, Any]] = []
        for referrer_id, invited in counts.most_common(limit):
            ref = self.find_user_by_telegram_id(referrer_id) or {}
            out.append(
                {
                    "referrer_id": referrer_id,
                    "invited": invited,
                    "first_name": ref.get("first_name", ""),
                    "username": ref.get("username", ""),
                }
            )
        return out

    def increment_referral_bonus(self, telegram_id: int) -> None:
        user = self.find_user_by_telegram_id(telegram_id)
        if not user:
            return
        current = int(user.get("referral_bonus") or 0)
        self.client.table("users").update({"referral_bonus": current + 1}).eq(
            "telegram_id", telegram_id
        ).execute()

    def get_referral_bonus(self, telegram_id: int) -> int:
        user = self.find_user_by_telegram_id(telegram_id)
        if not user:
            return 0
        return int(user.get("referral_bonus") or 0)

    def use_referral_bonus(self, telegram_id: int) -> bool:
        if self.get_referral_bonus(telegram_id) <= 0:
            return False
        user = self.find_user_by_telegram_id(telegram_id)
        if not user:
            return False
        current = int(user.get("referral_bonus") or 0)
        self.client.table("users").update({"referral_bonus": current - 1}).eq(
            "telegram_id", telegram_id
        ).execute()
        return True

    def is_user_affiliate(self, telegram_id: int) -> bool:
        user = self.find_user_by_telegram_id(telegram_id)
        if not user:
            return False
        return bool(user.get("is_affiliate"))

    def set_user_affiliate(self, telegram_id: int, *, is_affiliate: bool) -> None:
        try:
            self.client.table("users").update({"is_affiliate": is_affiliate}).eq(
                "telegram_id", telegram_id
            ).execute()
        except Exception as e:
            logger.warning("set_user_affiliate failed: %s", e)

    def deactivate_promos_by_owner(self, owner_tg_id: int) -> list[str]:
        try:
            result = (
                self.client.table("promo_codes")
                .select("code")
                .eq("owner_tg_id", owner_tg_id)
                .eq("is_active", True)
                .execute()
            )
            codes = [str(r["code"]) for r in (result.data or [])]
            if codes:
                self.client.table("promo_codes").update({"is_active": False}).eq(
                    "owner_tg_id", owner_tg_id
                ).execute()
            return codes
        except Exception as e:
            logger.warning("deactivate_promos_by_owner failed: %s", e)
            return []

    def list_promo_codes_by_owner(self, owner_tg_id: int) -> list[dict]:
        try:
            result = (
                self.client.table("promo_codes")
                .select("*")
                .eq("owner_tg_id", owner_tg_id)
                .order("created_at", desc=True)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.warning("list_promo_codes_by_owner failed: %s", e)
            return []

    def list_affiliate_users(self) -> list[dict]:
        try:
            result = (
                self.client.table("users")
                .select("*")
                .eq("is_affiliate", True)
                .order("created_at", desc=True)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.warning("list_affiliate_users failed: %s", e)
            return []

    def list_unpaid_for_reengagement(
        self, min_age_hours: int = 3, max_age_hours: int = 24
    ) -> list[dict]:
        created_after = (datetime.utcnow() - timedelta(hours=max_age_hours)).isoformat()
        created_before = (datetime.utcnow() - timedelta(hours=min_age_hours)).isoformat()
        try:
            result = (
                self.client.table("resumes")
                .select("id, user_id, data, created_at, re_engagement_sent, is_paid, users(telegram_id)")
                .eq("is_paid", False)
                .eq("re_engagement_sent", 0)
                .gte("created_at", created_after)
                .lte("created_at", created_before)
                .order("created_at")
                .limit(50)
                .execute()
            )
        except Exception as exc:
            if "re_engagement_sent" in str(exc).lower():
                logger.warning(
                    "list_unpaid_for_reengagement: add column re_engagement_sent to resumes (default 0)"
                )
            else:
                logger.warning("list_unpaid_for_reengagement failed: %s", exc)
            return []

        out: list[dict] = []
        for row in result.data or []:
            users = row.get("users")
            telegram_id = None
            if isinstance(users, dict):
                telegram_id = users.get("telegram_id")
            elif isinstance(users, list) and users:
                telegram_id = users[0].get("telegram_id")

            data = row.get("data") or {}
            if isinstance(data, str):
                try:
                    data = json.loads(data)
                except json.JSONDecodeError:
                    data = {}

            out.append(
                {
                    "resume_id": row.get("id"),
                    "telegram_id": telegram_id,
                    "target_position": (data.get("target_position") if isinstance(data, dict) else "") or "",
                    "created_at": row.get("created_at"),
                }
            )
        return [r for r in out if r.get("telegram_id") and r.get("resume_id")]

    def mark_reengagement_sent(self, resume_id: str) -> None:
        try:
            self.client.table("resumes").update({"re_engagement_sent": 1}).eq("id", resume_id).execute()
        except Exception as exc:
            if "re_engagement_sent" in str(exc).lower():
                logger.warning(
                    "mark_reengagement_sent: add column re_engagement_sent to resumes (default 0)"
                )
            else:
                logger.warning("mark_reengagement_sent failed resume_id=%s: %s", resume_id, exc)
