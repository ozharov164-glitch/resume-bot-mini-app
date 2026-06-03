import os

os.environ.setdefault("BOT_TOKEN", "0:test")
os.environ.setdefault("BOT_USERNAME", "testbot")
os.environ.setdefault("OPENROUTER_API_KEY", "test")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("APP_URL", "https://example.test")
os.environ.setdefault("FRONTEND_URL", "https://example.test/app")

from services.founder_contact import (  # noqa: E402
    founder_dm_url,
    support_hub_text,
)


def test_founder_dm_url():
    assert founder_dm_url("my_founder") == "https://t.me/my_founder"
    assert founder_dm_url("") is None


def test_support_hub_text_includes_founder_and_faq():
    text = support_hub_text(greeting="Анна")
    assert "Анна" in text
    assert "PDF или DOCX не пришли" in text
    assert "вернём Stars" in text
    assert "Дмитрию" in text
