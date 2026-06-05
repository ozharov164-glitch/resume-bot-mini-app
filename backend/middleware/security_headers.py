"""Response hardening for API responses."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        h = response.headers
        h.setdefault("X-Content-Type-Options", "nosniff")
        h.setdefault("X-Frame-Options", "DENY")
        h.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        h.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        h.setdefault("X-Permitted-Cross-Domain-Policies", "none")
        # HSTS: force HTTPS for 1 year; includeSubDomains for full coverage
        h.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        # CSP: restrict resource origins; API responses only, not HTML
        if not response.headers.get("content-type", "").startswith("text/html"):
            h.setdefault(
                "Content-Security-Policy",
                "default-src 'none'; frame-ancestors 'none'",
            )
        return response
