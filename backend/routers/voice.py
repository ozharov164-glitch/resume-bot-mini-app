from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from dependencies import get_current_user
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
    result = await polish_experience_text(text, position)
    return {"polished": result}
