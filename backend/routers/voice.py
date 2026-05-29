from fastapi import APIRouter, Depends

from dependencies import get_current_user
from services.voice_service import polish_experience_text

router = APIRouter(prefix="/api/voice", tags=["voice"])


@router.post("/polish")
async def polish_text(body: dict, current_user: dict = Depends(get_current_user)):
    text = str(body.get("text", ""))[:1000]
    position = str(body.get("position", ""))[:100]
    result = await polish_experience_text(text, position)
    return {"polished": result}
