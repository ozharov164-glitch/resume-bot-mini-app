import re
import unittest

from services.resume_enrichment import (
    build_documents_and_permits,
    derive_key_achievements,
    format_profession_extra_lines,
)


class ResumeEnrichmentTest(unittest.TestCase):
    def test_profession_extra_driver_license(self):
        lines = format_profession_extra_lines(
            {"driver_license": ["B", "C"], "driver_experience": "3–5 лет"}
        )
        self.assertTrue(any("Права кат." in line for line in lines))
        self.assertTrue(any("Стаж" in line for line in lines))

    def test_documents_merge_dedupe(self):
        data = {
            "profession_extra": {"driver_license": ["E"]},
            "certificates": ["Медкнижка", "Медкнижка"],
        }
        docs = build_documents_and_permits(data)
        self.assertEqual(len(docs), 2)

    def test_key_achievements_from_user_digits(self):
        out = derive_key_achievements(
            {},
            {"achievements": "Увеличил продажи на 20%\nСократил простои на 15%"},
        )
        self.assertEqual(len(out), 2)
        self.assertTrue(all(re.search(r"\d", x) for x in out))


if __name__ == "__main__":
    unittest.main()
