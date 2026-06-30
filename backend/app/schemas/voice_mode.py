"""
Voice Mode WebSocket Message Schemas

This module defines Pydantic models for voice mode WebSocket messages,
including audio chunks, transcripts, and error messages with validation
for security and data integrity.

Message Flow:
- Client -> Server: AudioChunkMessage, VoiceModeStop
- Server -> Client: TranscriptMessage, VoiceModeError
"""

from __future__ import annotations

import base64
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.shared.ids import parse_uuid


def _normalize_optional_identifier(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        raise ValueError("Identifier cannot be empty")
    parsed = parse_uuid(normalized)
    if parsed is None:
        raise ValueError("Identifier must be a UUID")
    return str(parsed)


def _normalize_required_identifier(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError("Identifier cannot be empty")
    parsed = parse_uuid(normalized)
    if parsed is None:
        raise ValueError("Identifier must be a UUID")
    return str(parsed)


# ── Client Messages (Frontend -> Backend) ─────────────────────────────────────


class AudioChunkMessage(BaseModel):
    """
    Client sends audio chunk from microphone capture.

    Audio data is base64-encoded for WebSocket transmission.
    The is_final flag indicates silence was detected by VAD.

    Validates: Requirements 18.1, 18.2
    """

    type: Literal["audio_chunk"] = Field(
        default="audio_chunk", description="Message type identifier"
    )
    audio: str = Field(..., min_length=1, description="Base64-encoded audio data")
    is_final: bool = Field(default=False, description="True when silence detected by VAD")
    timestamp: float = Field(..., ge=0.0, description="Client timestamp in milliseconds")
    format: Literal["webm", "opus", "wav"] = Field(default="webm", description="Audio codec format")
    session_id: str | None = Field(None, description="Session identifier")

    @field_validator("audio")
    @classmethod
    def validate_base64(cls, v: str) -> str:
        """
        Validate that audio field contains valid base64 data.

        Validates: Requirement 18.2
        """
        if not v:
            raise ValueError("Audio data cannot be empty")

        try:
            # Attempt to decode base64 to verify validity
            decoded = base64.b64decode(v, validate=True)
            if len(decoded) == 0:
                raise ValueError("Decoded audio data is empty")
        except Exception as e:
            raise ValueError(f"Invalid base64 audio data: {e!s}") from e

        return v

    @field_validator("session_id")
    @classmethod
    def validate_identifier_format(cls, v: str | None) -> str | None:
        """Validate that session_id is non-empty when provided."""
        return _normalize_optional_identifier(v)

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp(cls, v: float) -> float:
        """Ensure timestamp is a positive number."""
        if v < 0:
            raise ValueError("Timestamp must be non-negative")
        return v


class VoiceModeStop(BaseModel):
    """
    Client requests to stop voice mode session.

    Triggers cleanup of audio buffers and session resources.
    """

    type: Literal["voice_mode_stop"] = Field(
        default="voice_mode_stop", description="Message type identifier"
    )
    session_id: str = Field(..., description="Session identifier to stop")

    @field_validator("session_id")
    @classmethod
    def validate_identifier_format(cls, v: str) -> str:
        """Validate identifier format."""
        return _normalize_required_identifier(v)


# ── Server Messages (Backend -> Frontend) ─────────────────────────────────────


class VoiceModeError(BaseModel):
    """
    Server reports voice mode specific errors to client.

    Error codes:
    - BUFFER_OVERFLOW: Audio buffer exceeded size limit
    - TRANSCRIPTION_FAILED: ASR service failed to transcribe audio
    - INVALID_AUDIO_FORMAT: Unsupported or corrupted audio format
    - RATE_LIMIT_EXCEEDED: Too many audio chunks sent too quickly
    - SESSION_NOT_FOUND: Invalid or expired session_id
    - AUDIO_TIMEOUT: Audio buffer accumulation timed out
    """

    type: Literal["voice_mode_error"] = Field(
        default="voice_mode_error", description="Message type identifier"
    )
    session_id: str | None = Field(None, description="Session identifier (if applicable)")
    code: str = Field(..., description="Error code identifier")
    message: str = Field(..., description="Human-readable error message")
    details: dict | None = Field(None, description="Additional error context")

    @field_validator("session_id")
    @classmethod
    def validate_identifier_format(cls, v: str | None) -> str | None:
        """Validate identifier format when provided."""
        return _normalize_optional_identifier(v)

    @field_validator("code")
    @classmethod
    def validate_error_code(cls, v: str) -> str:
        """Validate error code is one of the known codes."""
        valid_codes = {
            "BUFFER_OVERFLOW",
            "TRANSCRIPTION_FAILED",
            "INVALID_AUDIO_FORMAT",
            "RATE_LIMIT_EXCEEDED",
            "SESSION_NOT_FOUND",
            "AUDIO_TIMEOUT",
            "INVALID_BASE64",
            "CHUNK_TOO_LARGE",
        }
        if v not in valid_codes:
            # Allow unknown codes but log warning
            pass
        return v


# ── Helper Functions ──────────────────────────────────────────────────────────


def make_voice_mode_error(
    code: str,
    message: str,
    session_id: str | None = None,
    details: dict | None = None,
) -> VoiceModeError:
    """Create a VoiceModeError message."""
    return VoiceModeError(
        session_id=session_id,
        code=code,
        message=message,
        details=details,
    )


def make_buffer_overflow_error(session_id: str, buffer_size: int, max_size: int) -> VoiceModeError:
    """Create a buffer overflow error message."""
    return make_voice_mode_error(
        code="BUFFER_OVERFLOW",
        message=f"Audio buffer exceeded maximum size of {max_size} bytes",
        session_id=session_id,
        details={"buffer_size": buffer_size, "max_size": max_size},
    )


def make_transcription_failed_error(session_id: str, error_message: str) -> VoiceModeError:
    """Create a transcription failed error message."""
    return make_voice_mode_error(
        code="TRANSCRIPTION_FAILED",
        message="Failed to transcribe audio",
        session_id=session_id,
        details={"error": error_message},
    )


def make_rate_limit_error(session_id: str, limit: int) -> VoiceModeError:
    """Create a rate limit exceeded error message."""
    return make_voice_mode_error(
        code="RATE_LIMIT_EXCEEDED",
        message=f"Too many audio chunks sent. Maximum rate: {limit} chunks/second",
        session_id=session_id,
        details={"rate_limit": limit},
    )


def make_invalid_audio_format_error(
    session_id: str, format: str, supported_formats: list[str]
) -> VoiceModeError:
    """Create an invalid audio format error message."""
    return make_voice_mode_error(
        code="INVALID_AUDIO_FORMAT",
        message=f"Unsupported audio format: {format}",
        session_id=session_id,
        details={"format": format, "supported_formats": supported_formats},
    )
