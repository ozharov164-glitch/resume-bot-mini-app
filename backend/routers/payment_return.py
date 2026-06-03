"""Browser landing after YooKassa — redirect user back to Telegram Mini App."""

from __future__ import annotations

import html
import re

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from config import settings
from services.payment_return import telegram_payment_start_link, telegram_payment_tg_protocol

router = APIRouter(tags=["payment-return"])

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


@router.get("/payment/return", response_class=HTMLResponse)
async def payment_return_bridge(resume_id: str = "") -> str:
    rid = resume_id.strip()
    if not _UUID_RE.match(rid):
        raise HTTPException(status_code=400, detail="Invalid resume_id")

    tg_https = telegram_payment_start_link(rid)
    tg_proto = telegram_payment_tg_protocol(rid)
    bot_name = html.escape(settings.BOT_USERNAME.lstrip("@"))

    tg_https_esc = html.escape(tg_https, quote=True)
    tg_proto_esc = html.escape(tg_proto, quote=True)

    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Оплата прошла — вернитесь в Telegram</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0; padding: 24px; background: #f4fbf4; color: #161d19;
      display: flex; min-height: 100vh; align-items: center; justify-content: center;
    }}
    .card {{
      max-width: 400px; background: #fff; border-radius: 16px; padding: 28px 24px;
      box-shadow: 0 8px 32px rgba(0,108,73,.12); text-align: center;
    }}
    h1 {{ font-size: 1.25rem; margin: 0 0 12px; }}
    p {{ color: #3c4a42; line-height: 1.5; margin: 0 0 20px; font-size: 15px; }}
    a.btn {{
      display: block; background: #006c49; color: #fff; text-decoration: none;
      padding: 14px 20px; border-radius: 12px; font-weight: 600; font-size: 16px;
    }}
    .hint {{ margin-top: 16px; font-size: 13px; color: #6c7a71; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>Оплата прошла</h1>
    <p>Сейчас откроется Telegram и бот @{bot_name}. Нажмите кнопку «Открыть приложение» — PDF и DOCX придут в чат.</p>
    <a class="btn" id="open-tg" href="{tg_https_esc}">Вернуться в Telegram</a>
    <p class="hint">Если ничего не произошло — нажмите кнопку выше.</p>
  </div>
  <script>
    (function () {{
      var proto = "{tg_proto_esc}";
      var https = "{tg_https_esc}";
      try {{ window.location.href = proto; }} catch (e) {{}}
      setTimeout(function () {{
        if (!document.hidden) window.location.replace(https);
      }}, 400);
    }})();
  </script>
</body>
</html>"""
