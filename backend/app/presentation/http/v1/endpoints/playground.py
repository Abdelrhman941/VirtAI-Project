import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Body, HTTPException
from loguru import logger
from pydantic import BaseModel, Field

from app.domain.voice.entities import TTSResult
from app.infrastructure.tts.openai_tts_provider import OpenAITTSProvider
from app.shared.config import get_settings

router = APIRouter()

class PlaygroundTTSRequest(BaseModel):
    text: str = Field(..., description="Text to synthesize")
    voice: str = Field(default="aria", description="Voice ID to use")

class PlaygroundTTSResponse(BaseModel):
    audio_url: str
    visemes: list[dict]
    duration_ms: int

@router.post("/tts", response_model=PlaygroundTTSResponse)
async def generate_playground_tts(
    request: PlaygroundTTSRequest,
):
    """
    Stateless endpoint to generate TTS and Visemes for the Avatar Playground.
    Bypasses the database and session manager completely.
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    logger.info(f"[Playground] Generating TTS for text: {request.text[:50]}... | voice={request.voice}")

    try:
        # 1. Generate TTS using the production provider
        tts_provider = OpenAITTSProvider(voice=request.voice, speed=1.0)
        
        # Use a system session and random message ID to bypass DB checks in audio.py
        message_id = f"playground_{uuid.uuid4().hex}"
        session_id = "system"
        
        tts_result = await tts_provider.generate(
            text=request.text,
            session_id=session_id,
            message_id=message_id,
            voice=request.voice
        )
        
        # 2. Generate Visemes using the production generator
        visemes = []
        try:
            from app.infrastructure.tts.viseme_generator import VisemeGenerator
            viseme_gen = VisemeGenerator()
            if tts_result.audio_ref:
                visemes = await viseme_gen.generate_from_audio(
                    audio_path=tts_result.audio_ref,
                    text=request.text,
                    session_id=session_id,
                    message_id=message_id
                )
        except Exception as e:
            logger.warning(f"[Playground] Failed to generate visemes: {e}")

        # 3. Construct the response
        # The file is stored at AUDIO_STORAGE_PATH / "system" / f"{message_id}_{api_voice}.pcm"
        # We need the exact file ID that the TTS provider generated.
        api_voice = tts_provider.resolve_voice(request.voice)
        audio_file_id = f"{message_id}_{api_voice}"
        
        # Fallback if tts_provider implements audio_file_id classmethod differently
        if hasattr(OpenAITTSProvider, "audio_file_id"):
            audio_file_id = OpenAITTSProvider.audio_file_id(message_id, api_voice)
            
        audio_url = f"/api/v1/audio/{session_id}/{audio_file_id}.pcm"

        # Convert Viseme objects to dicts for JSON serialization
        visemes_dict = [{"start": v.start, "end": v.end, "value": v.value} for v in visemes]

        return PlaygroundTTSResponse(
            audio_url=audio_url,
            visemes=visemes_dict,
            duration_ms=int(tts_result.audio_duration_ms)
        )

    except Exception as e:
        logger.error(f"[Playground] Error generating TTS: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
