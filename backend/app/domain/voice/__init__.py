"""Voice subdomain — ASR, TTS, visemes."""

from app.domain.voice.entities import (
    ASRResult,
    ASRSegment,
    StreamingASRResult,
    TTSChunk,
    TTSResult,
    VisemeEvent,
    WordBoundary,
    WordTimestamp,
)
from app.domain.voice.ports import BaseASRProvider, BaseTTSProvider, StreamingASRService

__all__ = [
    "ASRResult",
    "ASRSegment",
    "BaseASRProvider",
    "BaseTTSProvider",
    "StreamingASRResult",
    "StreamingASRService",
    "TTSChunk",
    "TTSResult",
    "VisemeEvent",
    "WordBoundary",
    "WordTimestamp",
]
