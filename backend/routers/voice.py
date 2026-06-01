from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from dependencies import get_current_user
from services.rate_limiter import RateLimitExceeded, check_rate_limit
from services.voice_service import polish_experience_text, transcribe_audio

router = APIRouter(prefix="/api/voice", tags=["voice"])

MAX_AUDIO_BYTES = 5 * 1024 * 1024


@router.post("/transcribe")
async def transcribe_voice(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    data = await file.read()
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Аудио слишком большое (макс. 5 МБ).")
    if not data:
        raise HTTPException(status_code=400, detail="Пустой аудиофайл.")
    try:
        check_rate_limit("voice_transcribe", current_user.get("telegram_id"))
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
        text = await transcribe_audio(
            data,
            file.filename or "recording.webm",
            file.content_type or "audio/webm",
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Голосовой ввод временно недоступен.") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Не удалось распознать речь.") from exc
    return {"text": text}


@router.post("/polish")
async def polish_text(body: dict, current_user: dict = Depends(get_current_user)):
    text = str(body.get("text", ""))[:1000]
    position = str(body.get("position", ""))[:100]
    period = str(body.get("period", ""))[:80]
    company = str(body.get("company", ""))[:120]
    job_position = str(body.get("job_position", ""))[:100]
    field_type = str(body.get("field_type", "experience"))[:30]

    allowed_types = {"experience", "about", "certificates", "last_job", "duties"}
    if field_type not in allowed_types:
        field_type = "experience"

    result = await polish_experience_text(
        text,
        position,
        period=period,
        company=company,
        job_position=job_position,
        field_type=field_type,
    )
    return {"polished": result}
