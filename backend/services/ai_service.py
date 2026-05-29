import json
import logging
from typing import Any

import httpx

from config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Ты — старший HR-редактор резюме для российского рынка (формат hh.ru).

ЗАДАЧА: превратить факты кандидата в сильное, живое, конкретное резюме без канцелярита.

═══ ПРАВИЛА ═══

ОПЫТ РАБОТЫ:
• Каждое место работы = отдельная запись в experience[]
• Описание: глаголы действия (организовывал, внедрял, обеспечивал, координировал, сократил, увеличил)
• 3–5 фраз через « • », каждая — конкретная обязанность или результат
• Есть цифры от кандидата — обязательно включи
• Нет цифр — описывай качественно («улучшил процесс», «снизил количество ошибок»)
• Формат периода: «Янв 2023 — Мар 2025» | «2019 — 2024» | «2023 — настоящее время»
• НЕЛЬЗЯ: «(2 месяца)», «(N лет)» — скобки с длительностью недопустимы

О СЕБЕ (summary):
• 4–6 предложений: [кто + опыт] → [сильные стороны] → [что умеет] → [мотивация]
• Стиль под профессию:
  — Рабочие / склад / водители: надёжность, физподготовка, ответственность
  — Медицина / соцсфера: внимательность, эмпатия, опыт с пациентами
  — Офис / продажи: коммуникация, результаты, клиентоориентированность
  — Госслужба: официальный тон, исполнительность, знание регламентов

НЕТ ОПЫТА:
• Честно: обучаемость, быстро осваиваю, готов к развитию
• Включи релевантные навыки, учёбу, волонтёрство если есть
• НЕ выдумывай стаж и компании

ОБРАЗОВАНИЕ:
• institution — конкретное название; если передана заглушка («ВУЗ», «Колледж») → пустая строка ""
• degree — «[уровень] образование» если нет специальности

НАВЫКИ: объедини указанные с уместными для профессии, без дублей
ЯЗЫКИ: всегда «Русский — родной», добавь указанные иностранные
СЕРТИФИКАТЫ: только из запроса, иначе []
ЗАРПЛАТА: только цифры без суффиксов
ТЕЛЕФОН / EMAIL: точно из запроса, не изменяй

═══ ОТВЕТ: ТОЛЬКО JSON, без markdown, без пояснений ═══
{"full_name":"","target_position":"","city":"","phone":"","email":"","salary":"","summary":"","experience":[{"company":"","position":"","period":"","description":""}],"education":[{"institution":"","degree":"","year":""}],"skills":[],"languages":["Русский — родной"],"certificates":[]}"""

SKILLS_SUGGEST_PROMPT = """Ты эксперт по российскому рынку труда (hh.ru, массовые профессии).

По названию должности подбери навыки для резюме соискателя.

Правила:
- 14–20 навыков в skills (короткие формулировки, 1–4 слова)
- Только реалистичные для профессии в РФ
- groups: hard (проф. навыки), tools (ПО/инструменты), soft (личные качества), documents (права, лицензии, медкнижка)
- Каждый навык из skills должен попасть ровно в одну группу

Ответ: ТОЛЬКО JSON:
{"skills":[],"groups":{"hard":[],"tools":[],"soft":[],"documents":[]}}"""

FALLBACK_SKILLS: dict[str, list[str]] = {
    "водител": [
        "Категория B", "Категория C", "Знание города", "Путевые листы",
        "ТТН", "Яндекс.Навигатор", "Бережная перевозка", "Пунктуальность",
        "Опыт дальних рейсов", "Без аварий", "СДЭК / Boxberry", "Ответственность",
    ],
    "курьер": [
        "Знание города", "Яндекс.Доставка", "Wildberries", "СДЭК",
        "Пунктуальность", "Физ. выносливость", "Мобильные приложения",
        "Работа с клиентами", "Бережное обращение с грузом", "Ответственность",
    ],
    "охран": [
        "Лицензия охранника", "CCTV", "Работа с рамкой", "Делопроизводство",
        "Физ. подготовка", "Работа в ночь", "Контроль доступа", "Ответственность",
        "Внимательность", "Стрессоустойчивость",
    ],
    "маляр": [
        "Покраска стен/потолков", "Шпаклёвка", "Работа с инструментом",
        "Поверхности: штукатурка", "Поверхности: гипсокартон", "Чтение чертежей",
        "Аккуратность", "Соблюдение ТБ", "Физ. выносливость",
    ],
    "продав": [
        "1С Торговля", "Кассовый аппарат", "Выкладка товара",
        "Работа с покупателями", "Инвентаризация", "Знание товара",
        "Коммуникабельность", "Стрессоустойчивость",
    ],
}

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
    last_job = user_data.get("last_job", "опыта нет")
    if "должность:" in str(last_job):
        last_job_block = f"Опыт работы (структурированный):\n{last_job}"
    else:
        last_job_block = f"Последняя работа / обязанности:\n{_truncate(last_job, MAX_FIELD_LEN['last_job'])}"

    education_line = f"Образование: {user_data.get('education', 'среднее')}"
    education_place = (user_data.get("education_place") or "").strip()
    if education_place:
        education_line += f"\nУчебное заведение: {education_place}"

    blocks = [
        f"Целевая должность: {_truncate(user_data.get('target_position', ''), MAX_FIELD_LEN['target_position'])}",
        f"Уровень опыта: {user_data.get('experience_level', 'нет опыта')}",
        last_job_block,
        education_line,
        f"Город: {_truncate(user_data.get('city', ''), MAX_FIELD_LEN['city'])}",
        f"О себе (исходник от кандидата):\n{_truncate(user_data.get('about', ''), MAX_FIELD_LEN['about'])}",
        f"Имя: {_truncate(user_data.get('name', ''), MAX_FIELD_LEN['name'])}",
        f"Телефон: {user_data.get('phone', '')}",
    ]
    salary = (user_data.get("salary") or "").strip()
    if salary:
        blocks.append(f"Желаемая зарплата: {salary} руб./мес")
    skills_str = _format_skills(user_data.get("skills"))
    if skills_str:
        blocks.append(f"Навыки (указал пользователь): {skills_str}")
    languages = (user_data.get("languages") or "").strip()
    if languages and languages.lower() != "нет":
        blocks.append(f"Языки: {languages}")
    certificates = (user_data.get("certificates") or "").strip()
    if certificates:
        blocks.append(f"Сертификаты и лицензии:\n{_truncate(certificates, 600)}")
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


def _build_request_body(
    messages: list[dict], model: str, temperature: float, max_tokens: int | None = None
) -> dict[str, Any]:
    return {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens or settings.OPENROUTER_MAX_TOKENS,
        "provider": _provider_routing(),
        "response_format": {"type": "json_object"},
    }


async def _call_openrouter(
    messages: list[dict],
    model: str | None = None,
    temperature: float = 0.65,
    max_tokens: int | None = None,
) -> dict:
    model = model or settings.OPENROUTER_MODEL
    body = _build_request_body(messages, model, temperature, max_tokens)

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

        if response.status_code >= 400:
            logger.error(
                "openrouter error model=%s status=%s body=%s",
                model,
                response.status_code,
                response.text[:500],
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

    choices = data.get("choices") or []
    if not choices or not choices[0].get("message", {}).get("content"):
        raise ValueError("OpenRouter returned empty completion")
    content = choices[0]["message"]["content"]
    return json.loads(_clean_json_content(content))


async def generate_resume(user_data: dict) -> dict:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": _build_user_payload(user_data)},
    ]
    try:
        return await _call_openrouter(messages, temperature=0.68)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning("primary model output invalid (%s), retrying fallback", exc)
        return await _call_openrouter(
            messages, model=settings.OPENROUTER_MODEL_FALLBACK, temperature=0.6
        )
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in {402, 429, 502, 503}:
            logger.warning("openrouter http %s, using fallback model", exc.response.status_code)
            return await _call_openrouter(
                messages, model=settings.OPENROUTER_MODEL_FALLBACK, temperature=0.6
            )
        raise


def _fallback_skills(position: str) -> dict[str, Any]:
    lowered = position.lower()
    for keyword, skills in FALLBACK_SKILLS.items():
        if keyword in lowered:
            return {
                "skills": skills,
                "groups": {
                    "hard": skills[:6],
                    "tools": skills[6:9] if len(skills) > 6 else [],
                    "soft": skills[9:] if len(skills) > 9 else ["Ответственность", "Пунктуальность"],
                    "documents": [],
                },
            }
    default = [
        "MS Office", "Работа в команде", "Обучаемость", "Ответственность",
        "Пунктуальность", "Коммуникабельность", "Работа с клиентами",
        "Физ. выносливость", "Стрессоустойчивость", "Внимательность",
        "Исполнительность", "Аккуратность",
    ]
    return {
        "skills": default,
        "groups": {
            "hard": default[:4],
            "tools": ["Компьютер"],
            "soft": default[4:],
            "documents": [],
        },
    }


def _normalize_skills_response(raw: dict[str, Any]) -> dict[str, Any]:
    skills = raw.get("skills") or []
    if not isinstance(skills, list):
        skills = []
    skills = [str(s).strip() for s in skills if str(s).strip()][:20]
    groups = raw.get("groups") or {}
    if not isinstance(groups, dict):
        groups = {}
    normalized_groups: dict[str, list[str]] = {}
    for key in ("hard", "tools", "soft", "documents"):
        val = groups.get(key) or []
        if isinstance(val, list):
            normalized_groups[key] = [str(v).strip() for v in val if str(v).strip()][:10]
        else:
            normalized_groups[key] = []
    if not skills and any(normalized_groups.values()):
        skills = []
        for key in ("hard", "tools", "soft", "documents"):
            skills.extend(normalized_groups[key])
        skills = list(dict.fromkeys(skills))[:20]
    return {"skills": skills, "groups": normalized_groups}


async def suggest_skills(position: str) -> dict[str, Any]:
    position = _truncate(position, MAX_FIELD_LEN["target_position"])
    messages = [
        {"role": "system", "content": SKILLS_SUGGEST_PROMPT},
        {"role": "user", "content": f"Должность: {position}"},
    ]
    try:
        raw = await _call_openrouter(messages, temperature=0.35, max_tokens=500)
        result = _normalize_skills_response(raw)
        if result["skills"]:
            return result
    except Exception as exc:
        logger.warning("skills suggest failed (%s), using fallback", exc)
    return _fallback_skills(position)


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
