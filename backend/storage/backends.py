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
                """
            )

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
        allowed = {k: v for k, v in fields.items() if k in {"is_paid", "paid_at", "data", "user_answers"}}
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


class SupabaseBackend:
    def __init__(self, client: Any) -> None:
        self.client = client

    def find_user_by_telegram_id(self, telegram_id: int) -> dict | None:
        result = (
            self.client.table("users").select("*").eq("telegram_id", telegram_id).limit(1).execute()
        )
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
