import json
import logging
import re

import httpx
from fastapi import APIRouter, Query

from config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/enrich", tags=["enrich"])


def _yandex_item_title(item: object) -> str:
    if not isinstance(item, list) or len(item) < 2:
        return ""
    part = item[1]
    if not isinstance(part, list) or len(part) < 2:
        return ""
    hl, suffix = part[0], part[1]
    if isinstance(hl, list) and len(hl) >= 2 and hl[0] == "hl" and isinstance(hl[1], str):
        return f"{hl[1]}{suffix if isinstance(suffix, str) else ''}".strip()
    if isinstance(suffix, str):
        return suffix.strip()
    return ""


def _parse_yandex_suggest(raw: str) -> list[dict[str, str]]:
    match = re.search(r"suggest\.apply\((.*)\)\s*$", raw.strip(), re.DOTALL)
    if not match:
        return []
    try:
        payload = json.loads(match.group(1))
    except json.JSONDecodeError:
        return []
    if not isinstance(payload, list) or len(payload) < 2:
        return []
    items = payload[1]
    if not isinstance(items, list):
        return []
    results: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in items:
        name = _yandex_item_title(item)
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        results.append({"name": name, "hint": "", "type": "place"})
    return results


@router.get("/company")
async def suggest_company(q: str = Query(..., min_length=2), limit: int = 5):
    """Автодополнение компаний/организаций. DaData → Yandex Maps suggest (JSONP)."""
    results: list[dict[str, str]] = []

    if settings.DADATA_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=2.5) as client:
                r = await client.post(
                    "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/party",
                    headers={"Authorization": f"Token {settings.DADATA_API_KEY}"},
                    json={"query": q, "count": limit},
                )
                if r.status_code == 200:
                    suggestions = r.json().get("suggestions", [])
                    results = [
                        {
                            "name": s["value"],
                            "hint": s["data"].get("address", {}).get("data", {}).get("city") or "",
                            "type": s["data"].get("type", ""),
                        }
                        for s in suggestions
                    ]
        except Exception as e:
            logger.warning("DaData suggest failed: %s", e)

    if not results:
        try:
            async with httpx.AsyncClient(timeout=2.5) as client:
                r = await client.get(
                    "https://suggest-maps.yandex.ru/suggest-geo",
                    params={"text": q, "results": limit, "lang": "ru_RU", "types": "biz,geo"},
                )
                if r.status_code == 200:
                    results = _parse_yandex_suggest(r.text)
        except Exception as e:
            logger.warning("Yandex suggest failed: %s", e)

    return {"suggestions": results[:limit]}
