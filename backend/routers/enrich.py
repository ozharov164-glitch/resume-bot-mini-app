import logging

import httpx
from fastapi import APIRouter, Query

from config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/enrich", tags=["enrich"])


@router.get("/company")
async def suggest_company(q: str = Query(..., min_length=2), limit: int = 5):
    """
    Автодополнение компаний/организаций.
    Priority: DaData → Yandex Maps Suggest
    """
    results = []

    if getattr(settings, "DADATA_API_KEY", ""):
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
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
            async with httpx.AsyncClient(timeout=2.0) as client:
                r = await client.get(
                    "https://suggest-maps.yandex.ru/suggest-geo",
                    params={"text": q, "results": limit, "lang": "ru_RU"},
                )
                if r.status_code == 200:
                    items = r.json().get("results", [])
                    results = [
                        {
                            "name": item.get("title", {}).get("text", ""),
                            "hint": item.get("subtitle", {}).get("text", ""),
                            "type": "place",
                        }
                        for item in items
                        if item.get("title", {}).get("text")
                    ]
        except Exception as e:
            logger.warning("Yandex suggest failed: %s", e)

    return {"suggestions": results[:limit]}
