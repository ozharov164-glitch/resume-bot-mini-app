"""ATS-score: resume completeness + vacancy keyword matching (0–100)."""

from __future__ import annotations

import re
from typing import Any

_RU_STOP = frozenset(
    "и в на за от по для что как при или же не но а с из до об под над без у к"
    " во со ни бы ли ну вы мы он она оно они да нет это все все всё который"
    " который которая которое которые также может быть если чтобы чем ещё уже"
    " лет год года работы опыт более менее такой своей своего".split()
)

_DIGIT_BONUS_RE = re.compile(
    r"\d+\s*(?:\+\s*)?(?:%|тыс|млн|руб|₽|часов|лет|месяц|человек|ед\.?|рейс|клиент|заказ|объект|км|кг|т\.|шт|ед\.?)",
    re.IGNORECASE,
)
# Also award when we see any number followed by a meaningful word (broader check)
_ANY_METRIC_RE = re.compile(r"\b\d{2,}[+]?\b", re.IGNORECASE)


# ────────────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────────────

def _words(text: str) -> set[str]:
    """Extract normalised word-tokens from a string."""
    tokens = re.findall(r"[a-zA-Zа-яёА-ЯЁ0-9][a-zA-Zа-яёА-ЯЁ0-9\.\-/+#]*", text)
    return {t.lower() for t in tokens if len(t) > 2 and t.lower() not in _RU_STOP}


def _resume_blob(resume: dict) -> str:
    """All resume text concatenated for keyword search."""
    parts: list[str] = []
    for field in ("full_name", "target_position", "city", "summary"):
        parts.append(str(resume.get(field) or ""))
    for skill in (resume.get("skills") or []):
        parts.append(str(skill))
    for job in (resume.get("experience") or []):
        if isinstance(job, dict):
            parts += [str(job.get("company") or ""), str(job.get("position") or ""),
                      str(job.get("description") or "")]
    for edu in (resume.get("education") or []):
        if isinstance(edu, dict):
            parts += [str(edu.get("institution") or ""), str(edu.get("degree") or "")]
    for cert in (resume.get("certificates") or []):
        parts.append(str(cert))
    for doc in (resume.get("documents_and_permits") or []):
        parts.append(str(doc))
    return " ".join(parts)


def _extract_vacancy_keywords(vacancy: str) -> list[str]:
    """Extract meaningful phrases and words from a vacancy description."""
    # Normalise: keep only readable chars
    clean = re.sub(r"[^\w\s\.\-/+#%]", " ", vacancy, flags=re.UNICODE)
    # Extract 2-3 word collocations first (more precise)
    phrases: list[str] = []
    # bigrams: "водительское удостоверение", "опыт вождения", etc.
    tokens = clean.split()
    for i in range(len(tokens) - 1):
        pair = f"{tokens[i]} {tokens[i+1]}"
        pair_low = pair.lower()
        if (len(tokens[i]) > 3 and len(tokens[i+1]) > 3
                and tokens[i].lower() not in _RU_STOP
                and tokens[i+1].lower() not in _RU_STOP):
            phrases.append(pair_low)
    # unigrams
    unigrams = [w.lower() for w in re.findall(r"[a-zA-Zа-яёА-ЯЁ0-9][a-zA-Zа-яёА-ЯЁ0-9\.\-/+#]*", clean)
                if len(w) > 3 and w.lower() not in _RU_STOP]
    # Deduplicate maintaining order
    seen: set[str] = set()
    result: list[str] = []
    for kw in phrases + unigrams:
        if kw not in seen:
            seen.add(kw)
            result.append(kw)
    return result[:60]  # cap to avoid noise


# ────────────────────────────────────────────────────────────────────────────
# Scoring blocks
# ────────────────────────────────────────────────────────────────────────────

def _score_completeness(resume: dict) -> tuple[int, list[str]]:
    """Field completeness: 0–40 points."""
    score = 0
    tips: list[str] = []

    if resume.get("full_name"):
        score += 4
    else:
        tips.append("Укажите полное имя")

    if resume.get("target_position"):
        score += 5
    else:
        tips.append("Укажите желаемую должность")

    if resume.get("phone"):
        score += 4
    else:
        tips.append("Добавьте номер телефона")

    if resume.get("email"):
        score += 3
    else:
        tips.append("Добавьте email")

    if resume.get("city"):
        score += 2

    summary = str(resume.get("summary") or "")
    if len(summary) > 150:
        score += 5
    elif len(summary) > 50:
        score += 2
        tips.append("Расширьте раздел «О себе» (нужно ≥150 символов)")
    else:
        tips.append("Напишите раздел «О себе» (3–5 предложений)")

    exp = [j for j in (resume.get("experience") or []) if isinstance(j, dict)]
    if exp:
        score += 7
        has_bullets = any(len(str(j.get("description") or "")) > 100 for j in exp)
        if has_bullets:
            score += 4
        else:
            tips.append("Добавьте подробные описания обязанностей в каждое место работы")
    else:
        tips.append("Добавьте опыт работы")

    skills = [s for s in (resume.get("skills") or []) if s]
    if len(skills) >= 8:
        score += 4
    elif len(skills) >= 4:
        score += 2
        tips.append("Добавьте больше навыков (рекомендуется ≥8)")
    else:
        tips.append("Укажите профессиональные навыки (не менее 8)")

    edu = [e for e in (resume.get("education") or []) if isinstance(e, dict)
           and (e.get("institution") or e.get("degree"))]
    if edu:
        score += 2

    return min(40, score), tips


def _score_quality(resume: dict) -> tuple[int, list[str]]:
    """Content quality indicators: 0–25 points."""
    score = 0
    tips: list[str] = []

    summary = str(resume.get("summary") or "")
    if len(summary) >= 350:
        score += 7
    elif len(summary) >= 180:
        score += 5
    elif len(summary) >= 80:
        score += 3

    # Experience with numbers / metrics
    exp = [j for j in (resume.get("experience") or []) if isinstance(j, dict)]
    digits_found = 0
    for job in exp:
        desc = str(job.get("description") or "")
        if _DIGIT_BONUS_RE.search(desc) or _ANY_METRIC_RE.search(desc):
            digits_found += 1
    if digits_found >= 2:
        score += 8
    elif digits_found == 1:
        score += 4
    else:
        tips.append("Добавьте числовые результаты в опыт работы (%, руб., чел.)")

    # Skills count bonus
    skills = [s for s in (resume.get("skills") or []) if s]
    if len(skills) >= 12:
        score += 5
    elif len(skills) >= 8:
        score += 3

    # Key achievements
    achievements = [a for a in (resume.get("key_achievements") or []) if a]
    if len(achievements) >= 2:
        score += 5
    elif len(achievements) == 1:
        score += 2
    else:
        tips.append("Добавьте 2–3 ключевых достижения с результатами")

    return min(25, score), tips


def _score_keywords(resume: dict, vacancy_text: str) -> tuple[int, list[str], list[str]]:
    """Vacancy keyword match: 0–35 points."""
    vacancy_kws = _extract_vacancy_keywords(vacancy_text)
    if not vacancy_kws:
        return 25, [], []

    blob = _resume_blob(resume).lower()
    matched: list[str] = []
    missing: list[str] = []

    for kw in vacancy_kws:
        if kw in blob:
            matched.append(kw)
        else:
            missing.append(kw)

    if not matched and not missing:
        return 25, [], []

    total = len(matched) + len(missing)
    ratio = len(matched) / total
    score = round(ratio * 35)

    # Deduplicate missing — keep most specific (longer first)
    missing_deduped = sorted(set(missing), key=lambda x: -len(x))[:8]

    return min(35, score), matched[:20], missing_deduped


# ────────────────────────────────────────────────────────────────────────────
# Main entry point
# ────────────────────────────────────────────────────────────────────────────

_LEVELS = [
    (82, "great",  "Отлично",  "Резюме хорошо оптимизировано под ATS"),
    (65, "good",   "Хорошо",   "Резюме пройдёт большинство ATS-систем"),
    (45, "medium", "Средне",   "Есть риск — рекомендуем доработать"),
    (0,  "low",    "Слабо",    "Резюме может не пройти автоматический отсев"),
]


def compute_ats_score(resume_data: dict, vacancy_text: str | None = None) -> dict[str, Any]:
    """
    Compute ATS score (0-100) for a resume, optionally against a vacancy.

    Returns:
        score          – integer 0–100
        level          – "low" | "medium" | "good" | "great"
        label          – human label in Russian
        description    – short sentence
        completeness   – points from completeness block (max 40)
        quality        – points from content quality block (max 25)
        keyword_score  – points from keyword match (max 35)
        matched_keywords – keywords found in resume (when vacancy provided)
        missing_keywords – keywords missing from resume (when vacancy provided)
        has_vacancy    – bool
        tips           – list of actionable improvement hints
    """
    c_score, c_tips = _score_completeness(resume_data)
    q_score, q_tips = _score_quality(resume_data)

    has_vacancy = bool((vacancy_text or "").strip())
    if has_vacancy:
        k_score, matched, missing = _score_keywords(resume_data, vacancy_text.strip())  # type: ignore[arg-type]
    else:
        k_score = 20  # Neutral — benefit of the doubt
        matched, missing = [], []

    total = c_score + q_score + k_score

    level, label, description = "low", "Слабо", "Резюме может не пройти автоматический отсев"
    for threshold, lv, lb, desc in _LEVELS:
        if total >= threshold:
            level, label, description = lv, lb, desc
            break

    tips = (c_tips + q_tips)[:4]  # max 4 tips shown

    return {
        "score": total,
        "level": level,
        "label": label,
        "description": description,
        "completeness": c_score,
        "quality": q_score,
        "keyword_score": k_score,
        "matched_keywords": matched,
        "missing_keywords": missing,
        "has_vacancy": has_vacancy,
        "tips": tips,
    }
