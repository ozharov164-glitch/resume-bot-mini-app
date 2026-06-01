import unittest

from services.name_format import build_full_name, capitalize_person_name


class NameFormatTest(unittest.TestCase):
    def test_capitalize_words(self):
        self.assertEqual(capitalize_person_name("иван петров"), "Иван Петров")

    def test_capitalize_patronymic(self):
        self.assertEqual(capitalize_person_name("сергеевич"), "Сергеевич")

    def test_hyphenated(self):
        self.assertEqual(capitalize_person_name("анна-мария"), "Анна-Мария")

    def test_build_full_name(self):
        self.assertEqual(
            build_full_name("алексей ежелев", "витальевич"),
            "Алексей Ежелев Витальевич",
        )

    def test_empty(self):
        self.assertEqual(capitalize_person_name(""), "")
        self.assertEqual(build_full_name("", ""), "")


if __name__ == "__main__":
    unittest.main()
