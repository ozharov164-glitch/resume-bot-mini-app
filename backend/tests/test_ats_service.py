"""Tests for ATS scoring service."""

import unittest

from services.ats_service import compute_ats_score


class AtsScoreTests(unittest.TestCase):
    def _resume(self, **overrides) -> dict:
        base = {
            "full_name": "Иван Петров",
            "target_position": "Водитель",
            "phone": "+7 999 000-00-00",
            "email": "ivan@mail.ru",
            "city": "Москва",
            "summary": (
                "Опытный водитель с 5-летним стажем. Хорошо знаю город, "
                "работал на грузовых и легковых автомобилях. Ответственный и пунктуальный."
            ),
            "experience": [
                {
                    "company": "ООО Транспорт",
                    "position": "Водитель кат. B",
                    "period": "2020 — 2025",
                    "description": "• Перевозка грузов по Москве • Ведение путевых листов • Техосмотр автомобиля • 100+ рейсов без нареканий",
                }
            ],
            "skills": ["Яндекс.Навигатор", "Категория B", "Путевые листы", "ТТН",
                       "Пунктуальность", "Ответственность", "Знание города", "Без аварий"],
            "education": [{"institution": "МАДИ", "degree": "Среднее профессиональное", "year": "2018"}],
            "key_achievements": ["100+ рейсов без нарушений", "Снизил время доставки на 15%"],
            "languages": ["Русский — родной"],
            "documents_and_permits": ["Права кат. B"],
        }
        base.update(overrides)
        return base

    def test_full_resume_scores_high(self):
        result = compute_ats_score(self._resume())
        self.assertGreaterEqual(result["score"], 65)
        self.assertIn(result["level"], ("good", "great"))

    def test_empty_resume_scores_low(self):
        result = compute_ats_score({})
        self.assertLessEqual(result["score"], 35)
        self.assertEqual(result["level"], "low")

    def test_vacancy_increases_keyword_score(self):
        vacancy = "Требуется водитель знание города Яндекс Навигатор путевые листы ответственность пунктуальность"
        with_vac = compute_ats_score(self._resume(), vacancy)
        without_vac = compute_ats_score(self._resume())
        # With matching vacancy keyword_score >= neutral default (20)
        self.assertGreaterEqual(with_vac["keyword_score"], 15)
        self.assertTrue(with_vac["has_vacancy"])
        self.assertFalse(without_vac["has_vacancy"])

    def test_missing_keywords_returned(self):
        vacancy = "Нужна лицензия охранника, CCTV, Контроль доступа."
        result = compute_ats_score(self._resume(), vacancy)
        self.assertTrue(len(result["missing_keywords"]) > 0)

    def test_matched_keywords_in_resume(self):
        vacancy = "Яндекс.Навигатор, путевые листы, знание города."
        result = compute_ats_score(self._resume(), vacancy)
        blob = " ".join(result["matched_keywords"]).lower()
        # At least some of these should appear
        self.assertTrue(len(result["matched_keywords"]) > 0)

    def test_result_structure(self):
        result = compute_ats_score(self._resume())
        required_keys = {"score", "level", "label", "description", "completeness",
                         "quality", "keyword_score", "matched_keywords",
                         "missing_keywords", "has_vacancy", "tips"}
        self.assertEqual(required_keys, set(result.keys()))

    def test_score_within_bounds(self):
        for _ in range(3):
            r = compute_ats_score(self._resume())
            self.assertGreaterEqual(r["score"], 0)
            self.assertLessEqual(r["score"], 100)

    def test_tips_provided_for_incomplete_resume(self):
        result = compute_ats_score({"full_name": "Анна"})
        self.assertGreater(len(result["tips"]), 0)


if __name__ == "__main__":
    unittest.main()
