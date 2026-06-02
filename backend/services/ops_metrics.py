"""In-process operational counters for admin dashboards and alert logging."""

from __future__ import annotations

import logging
import threading
import time
from collections import defaultdict
from typing import Any

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_started_at = time.time()

_counters: dict[str, int] = defaultdict(int)
_histograms: dict[str, list[float]] = defaultdict(list)
_MAX_HISTOGRAM_SAMPLES = 200


def inc(name: str, delta: int = 1) -> None:
    with _lock:
        _counters[name] += delta


def observe_ms(name: str, duration_ms: float) -> None:
    with _lock:
        bucket = _histograms[name]
        bucket.append(duration_ms)
        if len(bucket) > _MAX_HISTOGRAM_SAMPLES:
            del bucket[: len(bucket) - _MAX_HISTOGRAM_SAMPLES]


def record_http_status(status_code: int) -> None:
    inc(f"http_{status_code}")
    if status_code == 429:
        inc("http_429_total")
        logger.warning("ops_alert rate_limit_response count=%s", snapshot().get("http_429_total", 0))
    elif status_code >= 500:
        inc("http_5xx_total")
        logger.warning("ops_alert server_error status=%s count=%s", status_code, snapshot().get("http_5xx_total", 0))


def record_yookassa_error(detail: str = "") -> None:
    inc("yookassa_errors")
    logger.warning("ops_alert yookassa_error detail=%s total=%s", detail[:120], snapshot().get("yookassa_errors", 0))


def record_resume_generate_ms(duration_ms: float, *, ok: bool) -> None:
    observe_ms("resume_generate_ms", duration_ms)
    if ok:
        inc("resume_generate_ok")
    else:
        inc("resume_generate_fail")
    if duration_ms > 25_000:
        logger.warning(
            "ops_alert slow_resume_generate duration_ms=%.0f threshold_ms=25000",
            duration_ms,
        )


def snapshot() -> dict[str, Any]:
    with _lock:
        hist: dict[str, dict[str, float]] = {}
        for key, samples in _histograms.items():
            if not samples:
                continue
            sorted_s = sorted(samples)
            n = len(sorted_s)
            hist[key] = {
                "count": n,
                "p50_ms": sorted_s[n // 2],
                "p95_ms": sorted_s[int(n * 0.95) - 1] if n > 1 else sorted_s[0],
                "max_ms": sorted_s[-1],
            }
        return {
            "uptime_sec": round(time.time() - _started_at, 1),
            "counters": dict(_counters),
            "histograms": hist,
        }
