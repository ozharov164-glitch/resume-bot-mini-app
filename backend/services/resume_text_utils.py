"""Shared resume text helpers (no PDF/DOCX engine dependencies)."""

from __future__ import annotations

import re


def split_bullets(text: str) -> list[str]:
    if not text:
        return []
    raw = str(text).strip()
    if "•" in raw or "·" in raw or "\n" in raw:
        parts = re.split(r"[•·\n]+", raw)
        bullets = [p.strip() for p in parts if p.strip()]
    else:
        sentences = [s.strip() for s in re.split(r"\.\s+", raw) if s.strip()]
        bullets = []
        for sentence in sentences:
            if not sentence.endswith("."):
                sentence = f"{sentence}."
            bullets.append(sentence[0].upper() + sentence[1:] if sentence else sentence)
    return bullets[:7]
