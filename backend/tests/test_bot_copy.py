import os

os.environ.setdefault("BOT_TOKEN", "0:test")
os.environ.setdefault("OPENROUTER_API_KEY", "test")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test")
os.environ.setdefault("JWT_SECRET", "test")
os.environ.setdefault("APP_URL", "https://example.test")
os.environ.setdefault("FRONTEND_URL", "https://example.test/app")

from services.bot_copy import PAYMENT_LINE, start_text, trust_text  # noqa: E402
from services.stats_display import DISPLAY_COUNT_FLOOR, public_resume_count  # noqa: E402


def test_public_resume_count_floor():
    assert public_resume_count(None) >= DISPLAY_COUNT_FLOOR


def test_trust_mentions_card_and_5000():
    text = trust_text(5000)
    assert "5 000" in text
    assert "банковской картой" in text
    assert "Telegram Stars" in text
    assert "без карты" not in text
    assert "лучше конкурентов" in text


def test_start_text_payment_options():
    text = start_text(5000, "Анна")
    assert "Анна" in text
    assert PAYMENT_LINE in text
    assert "Classic" in text
    assert "водителей" in text


def test_how_it_works_mentions_template():
    from services.bot_copy import how_it_works_text

    text = how_it_works_text()
    assert "шаблон PDF" in text
    assert "11 вопросов" not in text
