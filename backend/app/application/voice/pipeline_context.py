import asyncio
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from app.domain.chat.entities import ConversationHistory
from app.domain.voice.entities import TTSResult
from app.schemas.audio import AudioBuffer


@dataclass
class TurnContext:
    session_id: str
    message_id: str
    trace_id: str

    # Input Data
    audio_buffer: AudioBuffer | None = None
    text_input: str | None = None
    user_id: str | None = None

    # State / History
    history: ConversationHistory | None = None
    original_system_prompt: str | None = None

    # Extracted Output
    asr_transcript: str | None = None
    llm_full_response: str | None = None
    llm_emotion: str | None = None
    # Phase 2: canonical ISO-8601 timestamp from the persisted assistant
    # message row.  Populated by handle_voice_turn after persist_assistant_output
    # completes; read by LLMStage to attach to the chat.final WS event.
    assistant_created_at: str | None = None
    tts_voice: str | None = None
    tts_result: TTSResult | None = None
    mouth_cues: list[Any] = field(default_factory=list)
    timeline: list[Any] = field(default_factory=list)
    retrieved_chunks: list[Any] | None = None

    # Orchestration & Callbacks
    send_callback: Callable[[Any], asyncio.Future[Any]] | None = None
    send_binary_callback: Callable[[bytes], asyncio.Future[Any]] | None = None
    aborted: bool = False

    # 3. Backpressure: Strict LLM-to-TTS pacing using maxsize=3
    sentence_queue: asyncio.Queue[str | None] = field(
        default_factory=lambda: asyncio.Queue(maxsize=3)
    )
    current_sentence: str | None = None
    sentence_index: int = 0
    cancel_event: asyncio.Event = field(default_factory=asyncio.Event)

    def abort(self) -> None:
        self.aborted = True
        self.cancel_event.set()
        while not self.sentence_queue.empty():
            try:
                self.sentence_queue.get_nowait()
                self.sentence_queue.task_done()
            except asyncio.QueueEmpty:
                break
