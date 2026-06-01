import os
from unittest.mock import patch

import pytest

os.environ.setdefault("BOT_TOKEN", "0:test")
os.environ.setdefault("BOT_USERNAME", "testbot")
os.environ.setdefault("OPENROUTER_API_KEY", "test")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("APP_URL", "https://example.test")
os.environ.setdefault("FRONTEND_URL", "https://example.test/app")

from services import rate_limiter  # noqa: E402
from services.rate_limiter import RateLimitExceeded, check_rate_limit


@pytest.fixture(autouse=True)
def _clear_limits():
    rate_limiter._counters.clear()
    yield
    rate_limiter._counters.clear()


def test_founder_exempt_from_resume_generate():
    for _ in range(5):
        check_rate_limit("resume_generate", 7595981350)


def test_resume_generate_limit_for_regular_user():
    tid = 999_888_777
    with patch("services.rate_limiter.is_founder", return_value=False):
        for _ in range(3):
            check_rate_limit("resume_generate", tid)
        with pytest.raises(RateLimitExceeded) as exc:
            check_rate_limit("resume_generate", tid)
    assert exc.value.retry_after_hours >= 1
