"""Guardrails against invented work-duration facts in LLM outputs."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)

_YEAR_RE = re.compile(r"\b((?:19|20)\d{2})\b")
_DURATION_NUM_RE = re.compile(
    r"\b(\d+)\s*(?:\+?\s*)?(?:лет|года|год|мес\.?|месяц(?:а|ев)?)\b",
    re.IGNORECASE,
)
_DURATION_PHRASE_RE = re.compile(
    r"(?:в\s+течение\s+)?\d+\s*(?:\+?\s*)?(?:лет|года|год|мес\.?|месяц(?:а|ев)?)",
    re.IGNORECASE,
)
_PRESENT_MARKERS = ("наст", "н.в", "сейчас", "по н")


@dataclass(frozen=True)
class PeriodFacts:
    raw: str
    max_years: int | None
    prompt_hint: str


def parse_period_facts(period: str) -> PeriodFacts:
    raw = (period or "").strip()
    if not raw:
        return PeriodFacts("", None, "")

    low = raw.lower()
    years = [int(y) for y in _YEAR_RE.findall(raw)]
    if not years:
        return PeriodFacts(
            raw,
            None,
            f'Период работы: «{raw}». Не добавляй длительность стажа (лет/месяцев), если её нет в исходном тексте.',
        )

    if len(years) == 1 or min(years) == max(years):
        return PeriodFacts(
            raw,
            0,
            f'Период: «{raw}» — стаж МЕНЕЕ 1 года. ЗАПРЕЩЕНО писать «N лет/года/месяцев» про общий стаж, '
            "если пользователь сам этого не написал.",
        )

    start = min(years)
    end = max(years)
    if any(marker in low for marker in _PRESENT_MARKERS):
        from datetime import datetime

        end = datetime.now().year

    span = max(end - start, 0)
    max_years = span + 1
    return PeriodFacts(
        raw,
        max_years,
        f'Период: «{raw}» — реальный стаж не более ~{max_years} '
        f"{'года' if max_years == 1 else 'лет'}. "
        "Не указывай больший стаж и не выдумывай «N лет опыта», если этого нет в исходнике.",
    )


def duration_numbers(text: str) -> set[int]:
    return {int(m.group(1)) for m in _DURATION_NUM_RE.finditer(text or "")}


def build_polish_user_message(
    *,
    text: str,
    position: str,
    period: str = "",
    company: str = "",
    job_position: str = "",
) -> str:
    lines = []
    role = (job_position or position or "").strip()
    if role:
        lines.append(f"Должность: {role}")
    company = (company or "").strip()
    if company:
        lines.append(f"Компания: {company}")
    facts = parse_period_facts(period)
    if facts.prompt_hint:
        lines.append(facts.prompt_hint)
    lines.append(f"Текст пользователя (не добавляй факты и цифры, которых здесь нет):\n{text}")
    return "\n".join(lines)


def _duration_allowed(number: int, original: str, facts: PeriodFacts) -> bool:
    if number in duration_numbers(original):
        return True
    if facts.max_years is None:
        return False
    return number <= facts.max_years


def _strip_duration_phrases(text: str, predicate) -> tuple[str, int]:
    removed = 0

    def repl(match: re.Match[str]) -> str:
        nonlocal removed
        phrase = match.group(0)
        nums = [int(n) for n in re.findall(r"\d+", phrase)]
        if not nums:
            return phrase
        if any(predicate(n) for n in nums):
            removed += 1
            return ""
        return phrase

    cleaned = _DURATION_PHRASE_RE.sub(repl, text)
    return cleaned, removed


def sanitize_duration_claims(original: str, polished: str, period: str = "") -> str:
    """Remove invented tenure phrases from polished text."""
    polished = (polished or "").strip()
    original = (original or "").strip()
    if not polished:
        return original

    facts = parse_period_facts(period)

    def is_invented(number: int) -> bool:
        return not _duration_allowed(number, original, facts)

    cleaned, removed = _strip_duration_phrases(polished, is_invented)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    cleaned = re.sub(r"^\s*[•·\-]\s*$", "", cleaned, flags=re.MULTILINE)
    cleaned = cleaned.strip()

    if removed:
        logger.info(
            "sanitize_duration_claims removed %s invented phrase(s) period=%r original_nums=%s",
            removed,
            period,
            sorted(duration_numbers(original)),
        )

    return cleaned or original


def sanitize_experience_descriptions(experience: list, work_history: list) -> list:
    """Align AI experience bullets with user-provided periods."""
    if not isinstance(experience, list):
        return experience
    user_entries = [e for e in (work_history or []) if isinstance(e, dict)]
    for index, job in enumerate(experience):
        if not isinstance(job, dict) or index >= len(user_entries):
            continue
        src = user_entries[index]
        duties = str(src.get("duties") or "").strip()
        description = str(job.get("description") or "").strip()
        period = str(src.get("period") or job.get("period") or "").strip()
        if description and duties:
            job["description"] = sanitize_duration_claims(duties, description, period)
    return experience
