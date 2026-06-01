"""Async wrappers for CPU-bound PDF generation."""

from __future__ import annotations

import asyncio
import logging

from services.pdf_service import generate_pdf

logger = logging.getLogger(__name__)

PDF_GENERATION_TIMEOUT_SEC = 30.0


class PdfGenerationTimeoutError(Exception):
    """WeasyPrint exceeded the allowed time budget."""


async def generate_pdf_async(resume_data: dict, template_name: str = "classic") -> bytes:
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(generate_pdf, resume_data, template_name),
            timeout=PDF_GENERATION_TIMEOUT_SEC,
        )
    except asyncio.TimeoutError as exc:
        logger.error("pdf generation timeout template=%s", template_name)
        raise PdfGenerationTimeoutError("PDF generation timed out") from exc
