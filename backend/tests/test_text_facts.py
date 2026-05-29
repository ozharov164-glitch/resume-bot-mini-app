import unittest

from services.text_facts import (
    build_polish_user_message,
    parse_period_facts,
    sanitize_duration_claims,
    sanitize_experience_descriptions,
)


class TextFactsTest(unittest.TestCase):
    def test_period_same_year_is_less_than_one_year(self):
        facts = parse_period_facts("2023-2023")
        self.assertEqual(facts.max_years, 0)
        self.assertIn("МЕНЕЕ 1 года", facts.prompt_hint)

    def test_sanitize_removes_invented_six_years(self):
        original = "Обслуживал клиентов, работал в команде."
        polished = (
            "- Взаимодействовал с коллегами для достижения целей. "
            "- Обслуживал клиентов в течение 6 лет, обеспечивая высокое качество."
        )
        result = sanitize_duration_claims(original, polished, "2023-2023")
        self.assertNotIn("6 лет", result)
        self.assertIn("коллег", result.lower())

    def test_sanitize_keeps_user_stated_duration(self):
        original = "Работал курьером 3 года, доставлял заказы."
        polished = "Доставлял заказы в течение 3 года, соблюдая сроки."
        result = sanitize_duration_claims(original, polished, "2021-2023")
        self.assertIn("3", result)

    def test_polish_message_includes_period(self):
        msg = build_polish_user_message(
            text="Принимал заказы",
            position="официант",
            period="2023-2023",
            company="Кафе",
        )
        self.assertIn("2023-2023", msg)
        self.assertIn("МЕНЕЕ 1 года", msg)
        self.assertIn("Кафе", msg)

    def test_sanitize_experience_descriptions(self):
        exp = [
            {
                "company": "Кафе",
                "period": "2023-2023",
                "description": "Обслуживал клиентов в течение 6 лет.",
            }
        ]
        wh = [
            {
                "company": "Кафе",
                "period": "2023-2023",
                "duties": "Принимал заказы, сервировал столы.",
            }
        ]
        out = sanitize_experience_descriptions(exp, wh)
        self.assertNotIn("6 лет", out[0]["description"])


if __name__ == "__main__":
    unittest.main()
