import json

import httpx

from config import settings

SYSTEM_PROMPT = """Ты профессиональный HR-специалист с 10-летним опытом работы
на российском рынке труда. Твоя задача — по ответам пользователя составить
профессиональное резюме в формате, принятом на hh.ru.

ПРАВИЛА:
1. Пиши живо, конкретно, без воды и канцелярщины.
2. Для должностей без опыта акцентируй личные качества и обучаемость.
3. Используй глаголы действия: организовывал, выполнял, достигал, обслуживал.
4. Адаптируй язык под специальность пользователя.
5. Раздел "О себе" должен быть естественным и человечным.
6. Верни строго JSON, без markdown и пояснений.
"""


def _clean_json_content(content: str) -> str:
    content = content.strip()
    if content.startswith("```"):
        parts = content.split("```")
        if len(parts) > 1:
            content = parts[1]
        if content.startswith("json"):
            content = content[4:]
    return content.strip()


async def _call_openrouter(messages: list[dict], model: str, temperature: float = 0.7) -> dict:
    async with httpx.AsyncClient(timeout=40.0) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": settings.OPENROUTER_APP_URL,
                "X-Title": "ResumeBot",
            },
            json={
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": 2000,
            },
        )
        response.raise_for_status()
        data = response.json()
    content = data["choices"][0]["message"]["content"]
    return json.loads(_clean_json_content(content))


async def generate_resume(user_data: dict) -> dict:
    user_message = f"""
Создай резюме для человека со следующими данными:

Желаемая должность: {user_data.get('target_position', '')}
Уровень опыта: {user_data.get('experience_level', 'нет опыта')}
Последнее место работы: {user_data.get('last_job', 'опыта работы нет')}
Образование: {user_data.get('education', 'среднее')}
Навыки: {', '.join(user_data.get('skills', []))}
Город: {user_data.get('city', '')}
Желаемая зарплата: {user_data.get('salary', '')} руб.
О себе: {user_data.get('about', '')}
Имя: {user_data.get('name', '')}
Телефон: {user_data.get('phone', '')}
Email: {user_data.get('email', '')}
"""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]
    try:
        return await _call_openrouter(messages, model="deepseek/deepseek-v4-flash", temperature=0.7)
    except Exception:
        return await _call_openrouter(messages, model="deepseek/deepseek-v3.2", temperature=0.65)


async def adapt_resume_for_vacancy(resume_data: dict, vacancy_text: str) -> dict:
    adapt_prompt = f"""
Адаптируй это резюме под конкретную вакансию. Измени акценты в summary и skills,
чтобы повысить релевантность требованиям вакансии. Не выдумывай новый опыт.

Текущее резюме:
{json.dumps(resume_data, ensure_ascii=False, indent=2)}

Вакансия:
{vacancy_text}

Верни только обновленный JSON.
"""
    return await _call_openrouter(
        messages=[{"role": "user", "content": adapt_prompt}],
        model="deepseek/deepseek-v4-flash",
        temperature=0.5,
    )
