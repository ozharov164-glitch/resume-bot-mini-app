"""Social share banner (no QR — text handle only)."""

from __future__ import annotations

from io import BytesIO

from PIL import Image, ImageDraw, ImageFont


def generate_share_banner(
    *,
    full_name: str,
    target_position: str,
    bot_handle: str = "@resumeez_bot",
) -> bytes:
    width, height = 1024, 512
    img = Image.new("RGB", (width, height), "#0d1f14")
    draw = ImageDraw.Draw(img)

    try:
        title_font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 44)
        sub_font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 30)
        small_font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 24)
    except OSError:
        title_font = ImageFont.load_default()
        sub_font = title_font
        small_font = title_font

    draw.rectangle((0, height - 8, width, height), fill="#2de08a")
    draw.text((48, 56), "ResumeBot", font=title_font, fill="#2de08a")
    name = (full_name or "Резюме").strip()[:60]
    position = (target_position or "Специалист").strip()[:80]
    draw.text((48, 140), name, font=title_font, fill="#ffffff")
    draw.text((48, 210), position, font=sub_font, fill="#c8e6d4")
    draw.text((48, 400), f"Создано в Telegram · {bot_handle}", font=small_font, fill="#8fb39a")

    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
