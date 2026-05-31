#!/usr/bin/env python3
"""Generate showcase PNG previews: each profession × each PDF template."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from services.pdf_service import ensure_fonts, generate_preview_png  # noqa: E402

JSON_FILE = ROOT / "frontend/src/data/resumeExamples.json"
OUT_DIR = ROOT / "frontend/public/examples"

TEMPLATES = ("classic", "modern", "compact")
# 165 DPI — чётко на retina-карточках (~1240px ширина), без артеfactов сжатия
RESOLUTION = 165


def main() -> None:
    ensure_fonts()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    examples = json.loads(JSON_FILE.read_text(encoding="utf-8"))
    written: list[Path] = []

    for example in examples:
        slug = example["slug"]
        resume = example["resume"]
        for tmpl in TEMPLATES:
            png = generate_preview_png(
                resume,
                tmpl,
                watermark=False,
                resolution=RESOLUTION,
            )
            dest = OUT_DIR / f"{slug}-{tmpl}.png"
            dest.write_bytes(png)
            written.append(dest)
            print(f"Wrote {dest.name} ({len(png):,} bytes) — {example['position']} / {tmpl}")

    # Удаляем устаревшие одношаблонные PNG (driver.png без суффикса)
    for example in examples:
        legacy = OUT_DIR / f"{example['slug']}.png"
        if legacy.exists():
            legacy.unlink()
            print(f"Removed legacy {legacy.name}")

    print(f"\nDone. {len(written)} files in {OUT_DIR}")


if __name__ == "__main__":
    main()
