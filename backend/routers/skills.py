import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from dependencies import get_current_user
from models.schemas import SuggestSkillsRequest, SuggestSkillsResponse
from services.ai_service import suggest_skills
from services.rate_limiter import RateLimitExceeded, check_rate_limit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/skills", tags=["skills"])


@router.post("/suggest", response_model=SuggestSkillsResponse)
async def suggest_skills_for_position(
    payload: SuggestSkillsRequest,
    current_user: dict = Depends(get_current_user),
):
    position = payload.position.strip()
    if not position:
        raise HTTPException(status_code=400, detail="Укажите должность.")
    try:
        check_rate_limit("skills_suggest", current_user.get("telegram_id"))
    except RateLimitExceeded as exc:
        return JSONResponse(
            status_code=429,
            content={
                "error": "rate_limit",
                "retry_after_hours": exc.retry_after_hours,
                "message": "Лимит запросов исчерпан",
            },
        )
    try:
        result = await suggest_skills(position)
        return SuggestSkillsResponse(skills=result["skills"], groups=result.get("groups", {}))
    except Exception as exc:
        logger.exception("skills suggest failed user_id=%s", current_user.get("id"))
        raise HTTPException(
            status_code=500,
            detail="Не удалось подобрать навыки. Попробуйте ещё раз.",
        ) from exc
