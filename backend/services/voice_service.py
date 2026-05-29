import logging

import httpx

from config import settings

logger = logging.getLogger(__name__)

POLISH_PROMPT = """Перефразируй текст пользователя как профессиональное описание
опыта работы для резюме hh.ru. Используй глаголы действия (организовывал, выполнял,
обеспечивал). НЕ добавляй факты которых нет в тексте. Сохрани цифры и названия.
Верни ТОЛЬКО готовый текст, без JSON, без пояснений."""


async def polish_experience_text(text: str, position: str) -> str:
    messages = [
        {"role": "system", "content": POLISH_PROMPT},
        {"role": "user", "content": f"Должность: {position}\nТекст: {text}"},
    ]
    body = {
        "model": settings.OPENROUTER_MODEL,
        "messages": messages,
        "temperature": 0.4,
        "max_tokens": 400,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
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

    choices = data.get("choices") or []
    if not choices:
        logger.warning("voice polish: empty choices")
        return text

    content = (choices[0].get("message") or {}).get("content") or ""
    polished = content.strip()
    return polished or text
