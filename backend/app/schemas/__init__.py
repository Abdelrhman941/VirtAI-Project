"""
Schemas package – public re-exports for all Pydantic DTOs.

Import from ``app.schemas`` for a flat, convenient namespace:

    from app.schemas import AudioBuffer, LoginRequest, ChatDelta
"""

# ── audio ────────────────────────────────────────────────────
from app.schemas.audio import (
    ASRResponse,
    AudioBuffer,
    AudioChunk,
)

# ── auth ─────────────────────────────────────────────────────
from app.schemas.auth import (
    GoogleCallbackRequest,
    LoginRequest,
    SetupStatusRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
)

# ── voice_mode ───────────────────────────────────────────────
from app.schemas.voice_mode import (
    AudioChunkMessage,
    VoiceModeError,
    VoiceModeStop,
    make_buffer_overflow_error,
    make_invalid_audio_format_error,
    make_rate_limit_error,
    make_transcription_failed_error,
    make_voice_mode_error,
)

# ── ws_messages (modern protocol) ────────────────────────────
from app.schemas.ws_messages import (
    AnimationTimelineV2,
    AnimationTimelineV2Item,
    AudioData,
    ChatAbort,
    # Server → Client (modern)
    ChatDelta,
    ChatFinal,
    # Client → Server
    ChatUserMessage,
    ClientSpeechStopped,
    ErrorMessage,
    MouthCue,
    PipelineState,
    ServerPong,
    ServerReady,
    TranscriptMessage,
    TTSReady,
    TTSRequest,
    VisemesReady,
    # Envelope / base
    WSMessageEnvelope,
    make_animation_timeline_v2,
    # Modern factory helpers
    make_chat_delta,
    make_chat_final,
    make_error,
    make_pipeline_state,
    make_transcript_message,
    make_tts_ready,
    make_visemes_ready,
)

__all__ = [
    # audio
    "AudioChunk",
    "AudioBuffer",
    "ASRResponse",
    # auth
    "LoginRequest",
    "SignupRequest",
    "SetupStatusRequest",
    "GoogleCallbackRequest",
    "TokenResponse",
    "UserResponse",
    # voice_mode
    "AudioChunkMessage",
    "VoiceModeStop",
    "TranscriptMessage",
    "VoiceModeError",
    "make_transcript_message",
    "make_voice_mode_error",
    "make_buffer_overflow_error",
    "make_transcription_failed_error",
    "make_rate_limit_error",
    "make_invalid_audio_format_error",
    # ws_messages – modern protocol
    "WSMessageEnvelope",
    "ChatUserMessage",
    "ClientSpeechStopped",
    "ChatAbort",
    "TTSRequest",
    "ChatDelta",
    "ChatFinal",
    "PipelineState",
    "AudioData",
    "AnimationTimelineV2",
    "AnimationTimelineV2Item",
    "TTSReady",
    "MouthCue",
    "VisemesReady",
    "ErrorMessage",
    "make_chat_delta",
    "make_chat_final",
    "make_animation_timeline_v2",
    "make_pipeline_state",
    "make_tts_ready",
    "make_visemes_ready",
    "make_error",
    "ServerReady",
    "ServerPong",
]
