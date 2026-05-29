import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import auth, payment, resume, stats

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = FastAPI(
    title="ResumeBot API",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

_github_pages_origins = [
    settings.FRONTEND_URL.rstrip("/"),
    "https://ozharov164-glitch.github.io",
    "https://ozharov164-glitch.github.io/resume-bot-mini-app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_github_pages_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(resume.router)
app.include_router(payment.router)
app.include_router(stats.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
