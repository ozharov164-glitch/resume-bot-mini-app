import json
import logging
from typing import Any

import httpx

from config import settings

logger = logging.getLogger(__name__)

# Компактный, но полный промпт: качество резюме важнее экономии на system-токенах.
SYSTEM_PROMPT = """Ты HR-редактор резюме для российского рынка (формат hh.ru).

Задача: по фактам кандидата сделать сильное, читаемое резюме — живое, конкретное, без канцелярита.

Правила качества:
1. Опыт: глаголы действия, обязанности + результат; в description — 2–4 содержательные фразы.
2. «О себе» (summary): 3–5 предложений, по делу; не клише без фактов.
3. Стиль под профессию (продавец, водитель, склад, офис и т.д.).
4. Нет опыта — честно: обучаемость, надежность, релевантные навыки; не выдумывай стаж и компании.
5. Используй только данные из запроса; даты и места работы не выдумывай.
6. Навыки — только уместные для целевой должности.

Ответ: ТОЛЬКО JSON, без markdown и комментариев:
{"full_name":"","target_position":"","city":"","phone":"","email":"","summary":"","experience":[{"company":"","position":"","period":"","description":""}],"education":[{"institution":"","degree":"","year":""}],"skills":[],"languages":["Русский — родной"]}"""

# Обрезаем только явный перебор (защита от спама), не режем нормальные ответы пользователя.
MAX_FIELD_LEN = {
    "last_job": 2000,
    "about": 800,
    "target_position": 150,
    "name": 100,
    "city": 80,
    "vacancy": 2000,
}


def _truncate(value: str, limit: int) -> str:
    value = (value or "").strip()
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip() + "…"


def _format_skills(skills: Any) -> str:
    if isinstance(skills, list):
        return ", ".join(str(s).strip() for s in skills[:16] if str(s).strip())
    return str(skills or "").strip()


def _build_user_payload(user_data: dict) -> str:
    """Структурированные факты — модель лучше понимает, чем сжатые однострочники."""
    blocks = [
        f"Целевая должность: {_truncate(user_data.get('target_position', ''), MAX_FIELD_LEN['target_position'])}",
        f"Уровень опыта: {user_data.get('experience_level', 'нет опыта')}",
        f"Последняя работа / обязанности:\n{_truncate(user_data.get('last_job', 'опыта нет'), MAX_FIELD_LEN['last_job'])}",
        f"Образование: {user_data.get('education', 'среднее')}",
        f"Навыки: {_format_skills(user_data.get('skills'))}",
        f"Город: {_truncate(user_data.get('city', ''), MAX_FIELD_LEN['city'])}",
        f"Желаемая зарплата: {user_data.get('salary', '')} руб./мес",
        f"О себе (исходник от кандидата):\n{_truncate(user_data.get('about', ''), MAX_FIELD_LEN['about'])}",
        f"Имя: {_truncate(user_data.get('name', ''), MAX_FIELD_LEN['name'])}",
        f"Телефон: {user_data.get('phone', '')}",
    ]
    email = (user_data.get("email") or "").strip()
    if email:
        blocks.append(f"Email: {email}")
    return "\n\n".join(blocks)


def _provider_routing() -> dict[str, Any]:
    only = [p.strip() for p in settings.OPENROUTER_PROVIDER_ONLY.split(",") if p.strip()]
    return {
        "only": only,
        "allow_fallbacks": True,
        "sort": {"by": "latency", "partition": "model"},
        "preferred_max_latency": {"p50": 2.5, "p90": 6},
    }


def _clean_json_content(content: str) -> str:
    content = content.strip()
    if content.startswith("```"):
        parts = content.split("```")
        if len(parts) > 1:
            content = parts[1]
        if content.startswith("json"):
            content = content[4:]
    return content.strip()


def _build_request_body(messages: list[dict], model: str, temperature: float) -> dict[str, Any]:
    return {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": settings.OPENROUTER_MAX_TOKENS,
        "provider": _provider_routing(),
        "response_format": {"type": "json_object"},
    }


async def _call_openrouter(messages: list[dict], model: str | None = None, temperature: float = 0.65) -> dict:
    model = model or settings.OPENROUTER_MODEL
    body = _build_request_body(messages, model, temperature)

    async with httpx.AsyncClient(timeout=50.0) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": settings.OPENROUTER_APP_URL,
                "X-Title": "ResumeBot",
            },
            json=body,
        )

        if response.status_code == 400 and "response_format" in body:
            body.pop("response_format", None)
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": settings.OPENROUTER_APP_URL,
                    "X-Title": "ResumeBot",
                },
                json=body,
            )

        response.raise_for_status()
        data = response.json()

    usage = data.get("usage") or {}
    logger.info(
        "openrouter model=%s prompt_tokens=%s completion_tokens=%s total=%s",
        model,
        usage.get("prompt_tokens"),
        usage.get("completion_tokens"),
        usage.get("total_tokens"),
    )

    content = data["choices"][0]["message"]["content"]
    return json.loads(_clean_json_content(content))


async def generate_resume(user_data: dict) -> dict:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": _build_user_payload(user_data)},
    ]
    try:
        return await _call_openrouter(messages, temperature=0.68)
    except json.JSONDecodeError:
        logger.warning("JSON parse failed, retrying with fallback model")
        return await _call_openrouter(
            messages, model=settings.OPENROUTER_MODEL_FALLBACK, temperature=0.6
        )
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in {402, 429, 503}:
            return await _call_openrouter(
                messages, model=settings.OPENROUTER_MODEL_FALLBACK, temperature=0.6
            )
        raise


async def adapt_resume_for_vacancy(resume_data: dict, vacancy_text: str) -> dict:
    compact_resume = json.dumps(resume_data, ensure_ascii=False, separators=(",", ":"))
    vacancy_text = _truncate(vacancy_text, MAX_FIELD_LEN["vacancy"])
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                "Адаптируй резюме под вакансию: усиль summary и skills под требования, "
                "опыт не выдумывай. Только JSON той же схемы.\n\n"
                f"Резюме:\n{compact_resume}\n\nВакансия:\n{vacancy_text}"
            ),
        },
    ]
    return await _call_openrouter(messages, temperature=0.5)
