"""Capitalize Russian personal names (ФИО) for storage, API, and PDF."""

from __future__ import annotations

import re

_WORD_SEP = re.compile(r"([\s\u00A0]+)")


def _capitalize_token(token: str) -> str:
    if not token:
        return token
    first = token[0].upper()
    rest = token[1:].lower() if len(token) > 1 else ""
    return first + rest


def capitalize_person_name(value: str) -> str:
    """Each word and hyphen segment starts with a capital letter: иван петров → Иван Петров."""
    text = (value or "").strip()
    if not text:
        return ""

    words: list[str] = []
    for chunk in _WORD_SEP.split(text):
        if not chunk or chunk.isspace() or chunk == "\u00a0":
            words.append(chunk)
            continue
        words.append("-".join(_capitalize_token(part) for part in chunk.split("-")))
    return "".join(words)


def build_full_name(name: str, patronymic: str = "") -> str:
    """Merge name + patronymic with title case (user answers override AI full_name)."""
    name = capitalize_person_name(name)
    patronymic = capitalize_person_name(patronymic)
    if not name:
        return patronymic
    if patronymic and patronymic.lower() not in name.lower():
        return f"{name} {patronymic}"
    return name
