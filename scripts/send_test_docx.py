#!/usr/bin/env python3
"""Generate sample hh.ru DOCX for all templates and send to founder via Telegram."""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

EXAMPLE_PATH = ROOT / "frontend" / "src" / "data" / "resumeExamples.json"
OUT_DIR = ROOT / "tmp"
ENV_PATH = ROOT / "backend" / ".env"
TEMPLATES = ("classic", "modern", "compact")


def _load_backend_env() -> None:
    if not ENV_PATH.is_file():
        return
    for raw in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def _load_driver_example() -> dict:
    from services.resume_schema import normalize_resume_data

    examples = json.loads(EXAMPLE_PATH.read_text(encoding="utf-8"))
    driver = next(item for item in examples if item.get("slug") == "driver")
    resume = dict(driver["resume"])
    resume["work_schedule"] = ["Полный день", "Сменный график"]
    resume["relocation"] = "Не готов к переезду"
    resume["key_achievements"] = [
        "5 лет без ДТП и нарушений ПДД",
        "Ежедневно 40+ точек доставки по Москве и МО",
    ]
    resume["documents_and_permits"] = resume.get("certificates") or [
        "Права кат. B, C",
        "Медицинская справка",
    ]
    return normalize_resume_data(resume)


def generate_all_samples() -> list[tuple[str, bytes, str]]:
    from services.docx_service import docx_filename, generate_docx_bytes
    from services.font_assets import ensure_fonts

    ensure_fonts()
    data = _load_driver_example()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out: list[tuple[str, bytes, str]] = []
    for template in TEMPLATES:
        docx_bytes = generate_docx_bytes(data, template)
        filename = docx_filename(data, template)
        path = OUT_DIR / filename
        path.write_bytes(docx_bytes)
        print(f"Saved: {path} ({len(docx_bytes):,} bytes)")
        out.append((template, docx_bytes, filename))
    return out


async def _send_all(samples: list[tuple[str, bytes, str]]) -> None:
    _load_backend_env()
    from config import settings
    from services.telegram_service import send_document_to_user

    founder_ids = [
        int(x.strip())
        for x in (settings.FOUNDER_TELEGRAM_IDS or "").split(",")
        if x.strip().isdigit()
    ]
    if not founder_ids:
        print("No FOUNDER_TELEGRAM_IDS — skip Telegram send")
        return
    target = founder_ids[0]
    labels = {
        "classic": "Classic — тёмный sidebar, mint акценты",
        "modern": "Modern — синий single-column, chips",
        "compact": "Compact — фиолетовый sidebar 32%",
    }
    for template, docx_bytes, filename in samples:
        caption = f"Тест DOCX · {labels.get(template, template)}\nNunito Sans · hh.ru"
        await send_document_to_user(
            user_telegram_id=target,
            document=docx_bytes,
            filename=filename,
            caption=caption,
        )
        print(f"Sent {template} → chat_id={target}")


def main() -> None:
    samples = generate_all_samples()
    _load_backend_env()
    if os.environ.get("BOT_TOKEN"):
        asyncio.run(_send_all(samples))
    else:
        print("BOT_TOKEN not set — files saved locally only (run on VPS to send)")


if __name__ == "__main__":
    main()
