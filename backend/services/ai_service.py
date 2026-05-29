import json
import logging
from typing import Any

import httpx

from config import settings

logger = logging.getLogger(__name__)

# Короткий system prompt — меньше input-токенов, тот же формат ответа.
SYSTEM_PROMPT = """HR-редактор резюме под hh.ru. Русский язык, без воды.
Верни ТОЛЬКО JSON:
{"full_name":"","target_position":"","city":"","phone":"","email":"","summary":"","experience":[{"company":"","position":"","period":"","description":""}],"education":[{"institution":"","degree":"","year":""}],"skills":[],"languages":[]}
Без markdown. Не выдумывай опыт."""

MAX_FIELD_LEN = {
    "last_job": 900,
    "about": 400,
    "target_position": 120,
    "name": 80,
    "city": 60,
}


def _truncate(value: str, limit: int) -> str:
    value = (value or "").strip()
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip() + "…"


def _compact_user_payload(user_data: dict) -> str:
    """Минимальный user prompt — только факты, без лишних слов."""
    skills = user_data.get("skills") or []
    if isinstance(skills, list):
        skills = ", ".join(skills[:12])
    lines = [
        f"должность: {_truncate(user_data.get('target_position', ''), MAX_FIELD_LEN['target_position'])}",
        f"опыт: {user_data.get('experience_level', 'нет')}",
        f"работа: {_truncate(user_data.get('last_job', 'нет'), MAX_FIELD_LEN['last_job'])}",
        f"образование: {user_data.get('education', 'среднее')}",
        f"навыки: {skills}",
        f"город: {_truncate(user_data.get('city', ''), MAX_FIELD_LEN['city'])}",
        f"зарплата: {user_data.get('salary', '')}",
        f"о себе: {_truncate(user_data.get('about', ''), MAX_FIELD_LEN['about'])}",
        f"имя: {_truncate(user_data.get('name', ''), MAX_FIELD_LEN['name'])}",
        f"тел: {user_data.get('phone', '')}",
    ]
    email = (user_data.get("email") or "").strip()
    if email:
        lines.append(f"email: {email}")
    return "\n".join(lines)


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


async def _call_openrouter(messages: list[dict], model: str | None = None, temperature: float = 0.55) -> dict:
    model = model or settings.OPENROUTER_MODEL
    body = _build_request_body(messages, model, temperature)

    async with httpx.AsyncClient(timeout=45.0) as client:
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

        # Некоторые провайдеры не принимают response_format — повтор без него.
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
        "openrouter model=%s prompt_tokens=%s completion_tokens=%s",
        model,
        usage.get("prompt_tokens"),
        usage.get("completion_tokens"),
    )

    content = data["choices"][0]["message"]["content"]
    return json.loads(_clean_json_content(content))


async def generate_resume(user_data: dict) -> dict:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": _compact_user_payload(user_data)},
    ]
    try:
        return await _call_openrouter(messages)
    except json.JSONDecodeError:
        return await _call_openrouter(messages, model=settings.OPENROUTER_MODEL_FALLBACK, temperature=0.5)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in {402, 429, 503}:
            return await _call_openrouter(messages, model=settings.OPENROUTER_MODEL_FALLBACK, temperature=0.5)
        raise


async def adapt_resume_for_vacancy(resume_data: dict, vacancy_text: str) -> dict:
    compact_resume = json.dumps(resume_data, ensure_ascii=False, separators=(",", ":"))
    vacancy_text = _truncate(vacancy_text, 1500)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"Адаптируй резюме под вакансию. Только JSON.\nрезюме:{compact_resume}\nвакансия:{vacancy_text}",
        },
    ]
    return await _call_openrouter(messages, temperature=0.45)
