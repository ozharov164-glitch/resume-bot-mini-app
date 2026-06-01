import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse

from dependencies import get_current_user
from database import get_db
from services.hh_text_service import format_hh_text
from services.payment_fulfillment import parse_resume_data

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/resume", tags=["export"])


@router.get("/{resume_id}/text-export", response_class=PlainTextResponse)
async def text_export(
    resume_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    resume = db.find_resume(resume_id, current_user["id"])
    if not resume:
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": "Резюме не найдено."},
        )
    try:
        resume_data = parse_resume_data(resume["data"])
    except (ValueError, TypeError) as exc:
        logger.exception("text export parse failed resume_id=%s", resume_id)
        raise HTTPException(
            status_code=500,
            detail={"error": "invalid_data", "message": "Не удалось прочитать резюме."},
        ) from exc

    return PlainTextResponse(
        format_hh_text(resume_data),
        media_type="text/plain; charset=utf-8",
    )
