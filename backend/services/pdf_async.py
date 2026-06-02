"""Async PDF generation with concurrency cap and optional background queue."""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Awaitable, Callable

from config import settings
from services.ops_metrics import inc, observe_ms
from services.pdf_service import generate_pdf

logger = logging.getLogger(__name__)

PDF_GENERATION_TIMEOUT_SEC = 30.0

_pdf_semaphore: asyncio.Semaphore | None = None
_pdf_queue: asyncio.Queue["_PdfJob | None"] | None = None
_worker_tasks: list[asyncio.Task[None]] = []


class PdfGenerationTimeoutError(Exception):
    """WeasyPrint exceeded the allowed time budget."""


def _semaphore() -> asyncio.Semaphore:
    global _pdf_semaphore
    if _pdf_semaphore is None:
        n = max(1, settings.PDF_MAX_CONCURRENT)
        _pdf_semaphore = asyncio.Semaphore(n)
    return _pdf_semaphore


@dataclass
class _PdfJob:
    resume_data: dict
    template_name: str
    callback: Callable[[bytes], Awaitable[None]] | None
    errback: Callable[[Exception], Awaitable[None]] | None


async def generate_pdf_async(resume_data: dict, template_name: str = "classic") -> bytes:
    """CPU-bound PDF with global concurrency limit (protects API under load)."""
    started = time.perf_counter()
    async with _semaphore():
        try:
            result = await asyncio.wait_for(
                asyncio.to_thread(generate_pdf, resume_data, template_name),
                timeout=PDF_GENERATION_TIMEOUT_SEC,
            )
            observe_ms("pdf_generate_ms", (time.perf_counter() - started) * 1000)
            inc("pdf_generate_ok")
            return result
        except asyncio.TimeoutError as exc:
            inc("pdf_generate_timeout")
            logger.error("pdf generation timeout template=%s", template_name)
            raise PdfGenerationTimeoutError("PDF generation timed out") from exc
        except Exception:
            inc("pdf_generate_fail")
            raise


async def _pdf_worker(worker_id: int) -> None:
    assert _pdf_queue is not None
    while True:
        job = await _pdf_queue.get()
        try:
            if job is None:
                break
            try:
                pdf_bytes = await generate_pdf_async(job.resume_data, job.template_name)
                if job.callback:
                    await job.callback(pdf_bytes)
            except Exception as exc:
                if job.errback:
                    await job.errback(exc)
                else:
                    logger.exception("pdf queue job failed worker=%s", worker_id)
        finally:
            _pdf_queue.task_done()


async def start_pdf_workers() -> None:
    """Background workers for fire-and-forget PDF (payment fulfillment path)."""
    global _pdf_queue, _worker_tasks
    if not settings.PDF_QUEUE_ENABLED:
        return
    if _worker_tasks:
        return
    _pdf_queue = asyncio.Queue(maxsize=settings.PDF_QUEUE_MAX_PENDING)
    workers = max(1, min(settings.PDF_MAX_CONCURRENT, 3))
    for i in range(workers):
        _worker_tasks.append(asyncio.create_task(_pdf_worker(i), name=f"pdf-worker-{i}"))
    logger.info("pdf workers started count=%s", workers)


async def stop_pdf_workers() -> None:
    global _pdf_queue, _worker_tasks
    if _pdf_queue is None:
        return
    for _ in _worker_tasks:
        await _pdf_queue.put(None)
    if _worker_tasks:
        await asyncio.gather(*_worker_tasks, return_exceptions=True)
    _worker_tasks = []
    _pdf_queue = None


def enqueue_pdf_job(
    resume_data: dict,
    template_name: str,
    *,
    on_success: Callable[[bytes], Awaitable[None]] | None = None,
    on_error: Callable[[Exception], Awaitable[None]] | None = None,
) -> bool:
    """Non-blocking PDF job; returns False if queue full (caller should fall back to sync)."""
    if _pdf_queue is None:
        return False
    if _pdf_queue.qsize() >= settings.PDF_QUEUE_MAX_PENDING:
        inc("pdf_queue_dropped")
        return False
    try:
        _pdf_queue.put_nowait(
            _PdfJob(
                resume_data=resume_data,
                template_name=template_name,
                callback=on_success,
                errback=on_error,
            )
        )
        inc("pdf_queue_enqueued")
        return True
    except asyncio.QueueFull:
        inc("pdf_queue_dropped")
        return False
