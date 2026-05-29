#!/usr/bin/env python3
"""Generate showcase PNG previews from frontend/src/data/resumeExamples.json."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from services.pdf_service import ensure_fonts, generate_preview_png  # noqa: E402

JSON_FILE = ROOT / "frontend/src/data/resumeExamples.json"
OUT_DIR = ROOT / "frontend/public/examples"


def main() -> None:
    ensure_fonts()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    examples = json.loads(JSON_FILE.read_text(encoding="utf-8"))
    for example in examples:
        slug = example["slug"]
        png = generate_preview_png(example["resume"], watermark=False, resolution=150)
        dest = OUT_DIR / f"{slug}.png"
        dest.write_bytes(png)
        print(f"Wrote {dest.name} ({len(png):,} bytes) — {example['position']}")

    print(f"\nDone. {len(list(OUT_DIR.glob('*.png')))} files in {OUT_DIR}")


if __name__ == "__main__":
    main()
