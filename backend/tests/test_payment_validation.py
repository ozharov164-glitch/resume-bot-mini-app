import os

import pytest

os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-at-least-32-characters-long")

from services.payment_validation import (  # noqa: E402
    expected_rub_amount,
    expected_stars_amount,
    payment_amount_matches,
    resume_belongs_to_telegram,
)


class _DB:
    def __init__(self) -> None:
        self.user = {"id": "u1", "telegram_id": 42}
        self.resume = {
            "id": "r1",
            "user_id": "u1",
            "final_price_stars": 149,
            "final_price_rub": 149,
        }

    def find_resume(self, resume_id: str, user_id: str | None = None):
        if resume_id != "r1":
            return None
        if user_id and user_id != "u1":
            return None
        return dict(self.resume)

    def find_user_by_telegram_id(self, telegram_id: int):
        if int(telegram_id) == 42:
            return dict(self.user)
        return None

    def get_bonus_stars(self, _telegram_id: int) -> int:
        return 0


def test_resume_belongs_to_owner():
    db = _DB()
    assert resume_belongs_to_telegram(db, "r1", 42) is True
    assert resume_belongs_to_telegram(db, "r1", 99) is False


def test_expected_stars_matches_resume_price():
    db = _DB()
    amount = expected_stars_amount(
        db,
        resume_id="r1",
        telegram_id=42,
        payment_type="single_pdf",
        bonus_stars_applied=0,
    )
    assert amount == 149


def test_expected_rub_matches_resume_price():
    db = _DB()
    rub = expected_rub_amount(
        db,
        resume_id="r1",
        telegram_id=42,
        bonus_stars_applied=0,
    )
    assert rub == "149.00"


def test_payment_amount_matches_tolerance():
    assert payment_amount_matches("149.00", "149") is True
    assert payment_amount_matches("149.00", "1.00") is False
