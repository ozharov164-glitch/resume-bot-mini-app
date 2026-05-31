#!/usr/bin/env python3
"""Generate template preview PNGs for frontend/public/templates/."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from services.pdf_service import ensure_fonts, generate_preview_png  # noqa: E402

OUT_DIR = ROOT / "frontend/public/templates"

SAMPLE_DATA = {
    "full_name": "Алексей Смирнов",
    "target_position": "водитель-курьер",
    "city": "Казань",
    "phone": "+7 (917) 123-45-67",
    "email": "smirnov.a@mail.ru",
    "salary": "55000",
    "summary": (
        "Ответственный водитель с опытом доставки и междугородних рейсов. "
        "Знаю город и область, пунктуален, аккуратен с документами и грузом."
    ),
    "skills": [
        "Категория B",
        "Категория C",
        "Яндекс.Навигатор",
        "Путевые листы",
        "ТТН",
        "Пунктуальность",
    ],
    "languages": ["Русский — родной"],
    "certificates": ["Права кат. B, C", "Медкнижка", "Допуск к перевозке грузов"],
    "experience": [
        {
            "company": "ООО «СДЭК»",
            "position": "Водитель-курьер",
            "period": "2021 — н.в.",
            "description": (
                "• Доставлял до 40 заказов в день по городу\n"
                "• 0 аварий за 3 года\n"
                "• Выполнение плана доставок 120%\n"
                "• Работа с ТТН и мобильным приложением"
            ),
        },
        {
            "company": "ИП Петров",
            "position": "Водитель",
            "period": "2018 — 2021",
            "description": (
                "• Междугородние рейсы по Татарстану\n"
                "• Контроль технического состояния авто\n"
                "• Ведение путевых листов"
            ),
        },
    ],
    "education": [
        {
            "institution": "Казанский колледж транспорта",
            "degree": "Среднее специальное, автомобильный транспорт",
            "year": "2017",
        }
    ],
}


def main() -> None:
    ensure_fonts()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for template_id in ("classic", "modern", "compact"):
        png = generate_preview_png(
            SAMPLE_DATA,
            template_id,
            watermark=False,
            resolution=165,
        )
        dest = OUT_DIR / f"{template_id}.png"
        dest.write_bytes(png)
        print(f"Wrote {dest} ({len(png):,} bytes)")

    print(f"\nDone. {len(list(OUT_DIR.glob('*.png')))} files in {OUT_DIR}")


if __name__ == "__main__":
    main()
