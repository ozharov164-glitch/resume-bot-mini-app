import json
import logging
import sqlite3
import uuid
from datetime import datetime
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
                """
            )
            for col_sql in [
                "ALTER TABLE users ADD COLUMN referred_by INTEGER DEFAULT NULL",
                "ALTER TABLE users ADD COLUMN referral_bonus INTEGER DEFAULT 0",
                "ALTER TABLE resumes ADD COLUMN promo_code TEXT DEFAULT NULL",
                "ALTER TABLE resumes ADD COLUMN discount_applied INTEGER DEFAULT 0",
                "ALTER TABLE resumes ADD COLUMN final_price_stars INTEGER DEFAULT NULL",
                "ALTER TABLE resumes ADD COLUMN final_price_rub INTEGER DEFAULT NULL",
                "ALTER TABLE resumes ADD COLUMN template_id TEXT DEFAULT 'classic'",
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
                INSERT INTO resumes (id, user_id, data, user_answers, is_paid, paid_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record["id"],
                    record["user_id"],
                    json.dumps(data, ensure_ascii=False),
                    json.dumps(answers, ensure_ascii=False),
                    1 if record.get("is_paid") else 0,
                    record.get("paid_at"),
                    record["created_at"],
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

    def count_paid_resumes(self) -> int:
        with self._connect() as conn:
            row = conn.execute("SELECT COUNT(*) AS c FROM resumes WHERE is_paid = 1").fetchone()
        return int(row["c"]) if row else 0

    def count_resumes_today(self) -> int:
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        try:
            with self._connect() as conn:
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

    def list_resumes_for_user(self, user_id: str, limit: int = 30) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, data, user_answers, is_paid, created_at
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
                }
            )
        return items


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

    def count_paid_resumes(self) -> int:
        result = (
            self.client.table("resumes")
            .select("id", count="exact")
            .eq("is_paid", True)
            .execute()
        )
        if result.count is not None:
            return int(result.count)
        return len(result.data or [])

    def list_resumes_for_user(self, user_id: str, limit: int = 30) -> list[dict[str, Any]]:
        result = (
            self.client.table("resumes")
            .select("id, data, is_paid, created_at")
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
                }
            )
        return items

    def save_referral(self, referrer_tg_id: int, referee_tg_id: int) -> None:
        try:
            self.client.table("users").update({"referred_by": referrer_tg_id}).eq(
                "telegram_id", referee_tg_id
            ).execute()
        except Exception as e:
            logger.warning("save_referral failed: %s", e)

    def count_resumes_today(self) -> int:
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        try:
            result = (
                self.client.table("resumes")
                .select("id", count="exact")
                .gte("created_at", today_start)
                .execute()
            )
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
