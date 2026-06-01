from services.text_facts import sanitize_summary_claims


def test_sanitize_summary_drops_invented_written_years():
    user_data = {
        "about": "Люблю работать с людьми и поддерживать порядок.",
        "work_history": [
            {"company": "Кафе", "period": "2024", "position": "Официант", "duties": "Обслуживал гостей"}
        ],
    }
    summary = (
        "Имею пятилетний опыт работы в сфере гостеприимства. "
        "Вежливо общаюсь с гостями и соблюдаю стандарты сервиса."
    )
    cleaned = sanitize_summary_claims(summary, user_data)
    assert "пятилет" not in cleaned.lower()
    assert "стандарты сервиса" in cleaned.lower()


def test_sanitize_summary_keeps_duration_when_user_provided():
    user_data = {
        "about": "Имею 5 лет опыта в продажах B2C и B2B.",
        "work_history": [],
    }
    summary = "Имею 5 лет опыта в продажах и уверенно работаю с возражениями."
    cleaned = sanitize_summary_claims(summary, user_data)
    assert cleaned == summary
