import logging

from fastapi import APIRouter, HTTPException, Query, Request

from config import settings
from services.http_clients import get_api_client
from services.rate_limiter import RateLimitExceeded, check_rate_limit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/enrich", tags=["enrich"])

DADATA_PARTY_URL = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/party"


async def _dadata_party(query: str, limit: int) -> list[dict[str, str]]:
    if not settings.DADATA_API_KEY:
        return []
    try:
        client = await get_api_client(timeout=2.5)
        r = await client.post(
            DADATA_PARTY_URL,
            headers={"Authorization": f"Token {settings.DADATA_API_KEY}"},
            json={"query": query, "count": limit},
        )
        if r.status_code != 200:
            logger.warning(
                "DaData suggest/party HTTP %s: %s",
                r.status_code,
                r.text[:200],
            )
            return []
        suggestions = r.json().get("suggestions", [])
        results: list[dict[str, str]] = []
        seen: set[str] = set()
        for s in suggestions:
            name = (s.get("value") or "").strip()
            if not name or name.lower() in seen:
                continue
            seen.add(name.lower())
            data = s.get("data") or {}
            city = (data.get("address") or {}).get("data", {}).get("city") or ""
            results.append(
                {
                    "name": name,
                    "hint": city,
                    "type": data.get("type") or "",
                }
            )
        return results
    except Exception as e:
        logger.warning("DaData party suggest failed: %s", e)
        return []


_EDU_KEYWORDS = (
    "университет",
    "институт",
    "академия",
    "колледж",
    "техникум",
    "училище",
    "лицей",
    "гимназия",
    "школа",
    "образован",
)


def _looks_like_education(name: str, org_type: str) -> bool:
    lowered = name.lower()
    if org_type and org_type.upper() in {"LEGAL", "INDIVIDUAL"}:
        return any(k in lowered for k in _EDU_KEYWORDS)
    return any(k in lowered for k in _EDU_KEYWORDS)


def _client_ip(request: Request) -> str:
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if forwarded:
        return forwarded
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


async def _enforce_enrich_limit(request: Request) -> None:
    try:
        await check_rate_limit("enrich_suggest", f"ip:{_client_ip(request)}")
    except RateLimitExceeded as exc:
        raise HTTPException(
            status_code=429,
            detail=f"Слишком много запросов. Повторите через ~{exc.retry_after_hours} ч.",
        ) from exc


@router.get("/company")
async def suggest_company(
    request: Request,
    q: str = Query(..., min_length=2, max_length=120),
    limit: int = Query(5, ge=1, le=10),
):
    await _enforce_enrich_limit(request)
    """
    Автодополнение работодателя — только официальные названия из ЕГРЮЛ (DaData).
    Без ключа DaData подсказок нет: пользователь вводит текст вручную.
    """
    results = await _dadata_party(q, limit)
    return {"suggestions": results[:limit]}


@router.get("/institution")
async def suggest_institution(
    request: Request,
    q: str = Query(..., min_length=2, max_length=120),
    limit: int = Query(5, ge=1, le=10),
):
    await _enforce_enrich_limit(request)
    """
    Автодополнение учебного заведения — DaData party, отфильтровано по типу организации.
    """
    raw = await _dadata_party(q, limit * 3)
    filtered = [item for item in raw if _looks_like_education(item["name"], item.get("type", ""))]
    if not filtered and raw:
        filtered = raw[:limit]
    return {"suggestions": filtered[:limit]}
