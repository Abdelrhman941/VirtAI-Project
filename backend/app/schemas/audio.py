"""
Audio-related Pydantic schemas
used across WebSocket messages and API responses.

The audio pipeline uses raw PCM binary frame protocol:
- Frontend captures audio via AudioContext + AudioWorklet
- Audio is transmitted as raw Int16 PCM bytes via WebSocket binary frames
- Backend receives and concatenates PCM bytes directly without container parsing
- PCM format is implicit: 16kHz sample rate, mono channel, 16-bit signed integer
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class AudioChunk(BaseModel):
    """
    A single audio chunk received from the frontend via WebSocket binary frame.

    The audio data is raw PCM bytes (16kHz, mono, Int16) transmitted via
    WebSocket binary frames. No format field is needed since PCM is implicit
    in the binary frame protocol.
    """

    data: bytes
    index: int = 0


class AudioBuffer(BaseModel):
    """
    Accumulated audio chunks ready for ASR processing.

    The buffer stores raw PCM bytes that can be safely concatenated
    without container parsing. PCM format is implicit: 16kHz, mono, Int16.
    """

    chunks: list[bytes] = Field(default_factory=list)
    total_size: int = 0

    def add_chunk(self, chunk: bytes) -> None:
        self.chunks.append(chunk)
        self.total_size += len(chunk)

    def get_combined(self) -> bytes:
        return b"".join(self.chunks)

    def clear(self) -> None:
        self.chunks.clear()
        self.total_size = 0

    @property
    def is_empty(self) -> bool:
        return len(self.chunks) == 0

    @property
    def chunk_count(self) -> int:
        return len(self.chunks)


class ASRResponse(BaseModel):
    """Schema for ASR result sent back to frontend via WebSocket."""

    transcript: str
    language: str = "en"
    confidence: float = Field(ge=0.0, le=1.0, default=1.0)
    duration_ms: float = 0.0
    word_count: int = 0
