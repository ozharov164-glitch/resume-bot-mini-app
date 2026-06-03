"""Shared Nunito Sans font assets for PDF and DOCX export."""

from __future__ import annotations

import logging
import urllib.request
from pathlib import Path

logger = logging.getLogger(__name__)

FONTS_DIR = Path(__file__).parent.parent / "fonts"

FONT_FILES = {
    "NunitoSans-Regular.ttf": "https://github.com/googlefonts/NunitoSans/raw/main/fonts/ttf/NunitoSans-Regular.ttf",
    "NunitoSans-Bold.ttf": "https://github.com/googlefonts/NunitoSans/raw/main/fonts/ttf/NunitoSans-Bold.ttf",
    "NunitoSans-SemiBold.ttf": "https://github.com/googlefonts/NunitoSans/raw/main/fonts/ttf/NunitoSans-SemiBold.ttf",
    "NunitoSans-Italic.ttf": "https://github.com/googlefonts/NunitoSans/raw/main/fonts/ttf/NunitoSans-Italic.ttf",
}


def ensure_fonts() -> bool:
    """Download Nunito Sans fonts if not present. Returns True if fonts available."""
    FONTS_DIR.mkdir(parents=True, exist_ok=True)
    try:
        for filename, url in FONT_FILES.items():
            dest = FONTS_DIR / filename
            if not dest.exists():
                urllib.request.urlretrieve(url, dest)
        return True
    except Exception as exc:
        logger.warning("Font download failed, using system fonts: %s", exc)
        return False
