import unittest

from services.resume_schema import normalize_resume_data


class ResumeSchemaTest(unittest.TestCase):
    def test_skills_string_becomes_list(self):
        raw = {"skills": "Python, SQL, Excel", "full_name": "Test"}
        out = normalize_resume_data(raw)
        self.assertEqual(out["skills"], ["Python", "SQL", "Excel"])

    def test_experience_non_list_becomes_empty(self):
        raw = {"experience": "bad", "skills": []}
        out = normalize_resume_data(raw)
        self.assertEqual(out["experience"], [])

    def test_salary_number_becomes_string(self):
        raw = {"salary": 120000, "skills": []}
        out = normalize_resume_data(raw)
        self.assertEqual(out["salary"], "120000")


if __name__ == "__main__":
    unittest.main()
