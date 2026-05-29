import logging
from pathlib import Path
from typing import Union

from config import settings
from storage.backends import SQLiteBackend, SupabaseBackend

logger = logging.getLogger(__name__)

StorageBackend = Union[SQLiteBackend, SupabaseBackend]
_backend: StorageBackend | None = None


def _sqlite_path() -> Path:
    raw = getattr(settings, "SQLITE_PATH", "data/resumebot.db")
    path = Path(raw)
    if not path.is_absolute():
        path = Path(__file__).resolve().parent / path
    return path


def get_db() -> StorageBackend:
    """FastAPI / bot dependency — Supabase with SQLite fallback."""
    global _backend
    if _backend is not None:
        return _backend

    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        try:
            from supabase import create_client

            client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            _backend = SupabaseBackend(client)
            logger.info("storage: Supabase connected")
            return _backend
        except Exception as exc:
            logger.warning("storage: Supabase unavailable (%s), falling back to SQLite", exc)

    path = _sqlite_path()
    _backend = SQLiteBackend(path)
    logger.info("storage: SQLite at %s", path)
    return _backend


def storage_mode() -> str:
    db = get_db()
    return "supabase" if isinstance(db, SupabaseBackend) else "sqlite"
