import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from middleware.request_metrics import RequestMetricsMiddleware
from middleware.security_headers import SecurityHeadersMiddleware
from database import get_db, storage_mode
from routers import (
    admin,
    affiliate_me,
    analytics,
    auth,
    enrich,
    export,
    payment,
    payment_return,
    promo,
    resume,
    skills,
    stats,
    user_stats,
    voice,
)
from services.http_clients import close_http_clients
from services.pdf_async import start_pdf_workers, stop_pdf_workers
from services.pdf_service import ensure_fonts
from services.redis_client import close_redis, ping_redis, redis_available

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_fonts()
    redis_available()
    await start_pdf_workers()
    yield
    await stop_pdf_workers()
    await close_http_clients()
    await close_redis()


app = FastAPI(
    title="ResumeBot API",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

_github_pages_origins = [
    settings.FRONTEND_URL.rstrip("/"),
    "https://ozharov164-glitch.github.io",
    "https://ozharov164-glitch.github.io/resume-bot-mini-app",
]

app.add_middleware(RequestMetricsMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_github_pages_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Admin-Key", "X-Telegram-Bot-Api-Secret-Token"],
)

app.include_router(auth.router)
app.include_router(resume.router)
app.include_router(export.router)
app.include_router(analytics.router)
app.include_router(skills.router)
app.include_router(payment.router)
app.include_router(promo.router)
app.include_router(payment_return.router)
app.include_router(stats.router)
app.include_router(admin.router)
app.include_router(voice.router)
app.include_router(enrich.router)
app.include_router(user_stats.router)
app.include_router(affiliate_me.router)


@app.get("/health")
async def health():
    payload: dict = {"status": "ok", "storage": storage_mode()}
    try:
        get_db()
    except Exception:
        logging.getLogger(__name__).exception("health check storage failed")
        return {"status": "degraded", "storage": "error"}
    if (settings.REDIS_URL or "").strip():
        payload["redis"] = "ok" if await ping_redis() else "unavailable"
    return payload
