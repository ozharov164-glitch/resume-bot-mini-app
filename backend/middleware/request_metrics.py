"""Request timing and HTTP status metrics."""

from __future__ import annotations

import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from config import settings
from services.ops_metrics import inc, observe_ms, record_http_status

logger = logging.getLogger(__name__)

_SLOW_MS = settings.SLOW_REQUEST_MS


class RequestMetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        started = time.perf_counter()
        path = request.url.path
        inc("http_requests")
        try:
            response = await call_next(request)
        except Exception:
            inc("http_exceptions")
            record_http_status(500)
            raise
        elapsed_ms = (time.perf_counter() - started) * 1000
        observe_ms("http_request_ms", elapsed_ms)
        record_http_status(response.status_code)
        if elapsed_ms >= _SLOW_MS:
            logger.warning(
                "ops_alert slow_request method=%s path=%s status=%s duration_ms=%.0f",
                request.method,
                path,
                response.status_code,
                elapsed_ms,
            )
        return response
