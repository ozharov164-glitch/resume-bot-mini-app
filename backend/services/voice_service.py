import logging
from typing import Any

import httpx

from config import settings
from services.text_facts import build_polish_user_message, sanitize_duration_claims

logger = logging.getLogger(__name__)

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions"

POLISH_EXPERIENCE_PROMPT = """Перефразируй описание опыта работы как профессиональную запись для резюме hh.ru.
Используй глаголы действия (организовывал, выполнял, обеспечивал, координировал, внедрял).

СТРОГО:
- НЕ добавляй факты, цифры, сроки, годы/месяцы стажа — если их НЕТ в тексте пользователя
- Если указан период работы — описание НЕ должно противоречить его длительности
- ЗАПРЕЩЕНО: «N лет опыта», «в течение N лет», «за N лет» без явного основания в исходнике
- Сохрани цифры и названия только из исходного текста
- Верни 3–5 фраз через « • »
- Верни ТОЛЬКО готовый текст, без JSON, без пояснений."""

POLISH_ABOUT_PROMPT = """Улучши раздел «О себе» для резюме hh.ru.
Стиль: профессиональный но живой, 3–5 предложений. Не клише.
Структура: [кто я + опыт] → [сильные стороны] → [мотивация].

СТРОГО:
- НЕ добавляй факты и цифры, которых нет в тексте пользователя
- НЕ превращай личные качества в описание "опыта работы"
- Сохрани конкретные детали из исходника
- Верни ТОЛЬКО улучшенный текст, без JSON, без пояснений."""

POLISH_CERTIFICATES_PROMPT = """Отредактируй список сертификатов и лицензий для резюме hh.ru.
Стандартизируй написание, исправь опечатки, сделай список чистым.

СТРОГО:
- НЕ добавляй сертификаты, которых нет в тексте пользователя
- Сохрани все документы из исходника
- Верни ТОЛЬКО готовый текст, без JSON, без пояснений."""

POLISH_PROMPTS = {
    "experience": POLISH_EXPERIENCE_PROMPT,
    "about": POLISH_ABOUT_PROMPT,
    "certificates": POLISH_CERTIFICATES_PROMPT,
    "last_job": POLISH_EXPERIENCE_PROMPT,
    "duties": POLISH_EXPERIENCE_PROMPT,
}

PUNCTUATE_PROMPT = """Ты редактор русского текста из распознавания речи.
Расставь знаки препинания (точки, запятые, тире, вопросительные и восклицательные).
Не меняй слова, не добавляй и не удаляй факты. Верни ТОЛЬКО исправленный текст."""


def _groq_keys() -> list[str]:
    return [k.strip() for k in settings.GROQ_API_KEYS.split(",") if k.strip()]


def _groq_client(timeout: float = 60.0) -> httpx.AsyncClient:
    proxy = (settings.GROQ_PROXY_URL or "").strip() or None
    return httpx.AsyncClient(timeout=timeout, proxy=proxy)


def _retryable_status(code: int) -> bool:
    return code in (401, 403, 429, 500, 502, 503, 504)


async def _groq_request(
    build_request: Any,
    *,
    operation: str,
) -> httpx.Response:
    keys = _groq_keys()
    if not keys:
        raise RuntimeError("Groq API keys not configured")

    last_error: Exception | None = None
    async with _groq_client() as client:
        for index, key in enumerate(keys):
            try:
                request = build_request(key)
                response = await client.send(request)
                if response.status_code >= 400 and _retryable_status(response.status_code):
                    logger.warning(
                        "groq %s key #%s failed status=%s, trying next",
                        operation,
                        index + 1,
                        response.status_code,
                    )
                    last_error = httpx.HTTPStatusError(
                        f"Groq {operation} failed",
                        request=response.request,
                        response=response,
                    )
                    continue
                response.raise_for_status()
                return response
            except httpx.HTTPStatusError as exc:
                if exc.response is not None and _retryable_status(exc.response.status_code):
                    logger.warning(
                        "groq %s key #%s failed status=%s, trying next",
                        operation,
                        index + 1,
                        exc.response.status_code,
                    )
                    last_error = exc
                    continue
                raise

    raise last_error or RuntimeError(f"All Groq keys failed for {operation}")


async def _punctuate_russian(text: str) -> str:
    body = {
        "model": settings.GROQ_PUNCTUATE_MODEL,
        "messages": [
            {"role": "system", "content": PUNCTUATE_PROMPT},
            {"role": "user", "content": text},
        ],
        "temperature": 0.1,
        "max_tokens": 1024,
    }

    def build_request(key: str) -> httpx.Request:
        return httpx.Request(
            "POST",
            GROQ_CHAT_URL,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json=body,
        )

    response = await _groq_request(build_request, operation="punctuate")
    data = response.json()
    content = ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
    return content.strip() or text


async def transcribe_audio(audio_bytes: bytes, filename: str, content_type: str) -> str:
    if not audio_bytes:
        raise ValueError("Empty audio")

    keys = _groq_keys()
    if not keys:
        raise RuntimeError("Groq API keys not configured")

    last_error: Exception | None = None
    data: dict[str, Any] = {}

    async with _groq_client() as client:
        for index, key in enumerate(keys):
            try:
                response = await client.post(
                    GROQ_TRANSCRIBE_URL,
                    headers={"Authorization": f"Bearer {key}"},
                    files={"file": (filename, audio_bytes, content_type or "audio/webm")},
                    data={
                        "model": settings.GROQ_STT_MODEL,
                        "language": "ru",
                        "response_format": "json",
                        "temperature": "0",
                    },
                )
                if response.status_code >= 400 and _retryable_status(response.status_code):
                    logger.warning(
                        "groq transcribe key #%s failed status=%s, trying next",
                        index + 1,
                        response.status_code,
                    )
                    last_error = httpx.HTTPStatusError(
                        "Groq transcribe failed",
                        request=response.request,
                        response=response,
                    )
                    continue
                response.raise_for_status()
                data = response.json()
                break
            except httpx.HTTPStatusError as exc:
                if exc.response is not None and _retryable_status(exc.response.status_code):
                    logger.warning(
                        "groq transcribe key #%s failed status=%s, trying next",
                        index + 1,
                        exc.response.status_code,
                    )
                    last_error = exc
                    continue
                raise
        else:
            raise last_error or RuntimeError("All Groq keys failed for transcribe")

    text = str(data.get("text") or "").strip()
    if not text:
        return ""

    try:
        return await _punctuate_russian(text)
    except Exception as exc:
        logger.warning("groq punctuate failed, returning raw transcript: %s", exc)
        return text


async def polish_experience_text(
    text: str,
    position: str,
    *,
    period: str = "",
    company: str = "",
    job_position: str = "",
    field_type: str = "experience",
) -> str:
    if not text.strip():
        return text

    system_prompt = POLISH_PROMPTS.get(field_type, POLISH_EXPERIENCE_PROMPT)

    user_content = build_polish_user_message(
        text=text,
        position=position,
        period=period,
        company=company,
        job_position=job_position,
    )

    body = {
        "model": settings.GROQ_POLISH_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.45,
        "max_tokens": 600,
    }

    def build_request(key: str) -> httpx.Request:
        return httpx.Request(
            "POST",
            GROQ_CHAT_URL,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json=body,
        )

    try:
        response = await _groq_request(build_request, operation="polish")
        data = response.json()
        content = ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
        polished = content.strip()
        return sanitize_duration_claims(text, polished or text, period)
    except Exception as exc:
        logger.warning("groq polish failed, trying openrouter: %s", exc)

    or_body = {
        "model": settings.OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.45,
        "max_tokens": 500,
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
            json=or_body,
        )
        response.raise_for_status()
        data = response.json()

    choices = data.get("choices") or []
    if not choices:
        return text

    content = (choices[0].get("message") or {}).get("content") or ""
    polished = content.strip() or text
    return sanitize_duration_claims(text, polished, period)
