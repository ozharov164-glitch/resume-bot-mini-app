import unittest
from unittest.mock import MagicMock

from services.bonus_payment import apply_bonus_rub, apply_bonus_stars, bonus_units_to_apply


class BonusPaymentTests(unittest.TestCase):
    def test_bonus_units_cap_at_price_minus_one(self):
        self.assertEqual(bonus_units_to_apply(50, 149), 50)
        self.assertEqual(bonus_units_to_apply(200, 149), 148)
        self.assertEqual(bonus_units_to_apply(10, 5), 4)
        self.assertEqual(bonus_units_to_apply(10, 1), 0)

    def test_apply_bonus_stars(self):
        db = MagicMock()
        db.get_bonus_stars.return_value = 30
        stars, applied = apply_bonus_stars(db, 1, 149, True)
        self.assertEqual(applied, 30)
        self.assertEqual(stars, 119)

    def test_apply_bonus_rub(self):
        db = MagicMock()
        db.get_bonus_stars.return_value = 30
        rub, applied = apply_bonus_rub(db, 1, "149.00", True)
        self.assertEqual(applied, 30)
        self.assertEqual(rub, "119.00")

    def test_apply_bonus_rub_respects_promo_price(self):
        db = MagicMock()
        db.get_bonus_stars.return_value = 50
        rub, applied = apply_bonus_rub(db, 1, "119.00", True)
        self.assertEqual(applied, 50)
        self.assertEqual(rub, "69.00")


if __name__ == "__main__":
    unittest.main()
