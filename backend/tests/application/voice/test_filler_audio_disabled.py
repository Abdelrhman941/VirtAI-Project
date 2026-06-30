import asyncio
from collections.abc import AsyncGenerator

import pytest

from app.application.voice.handle_voice_turn import ConversationPipeline
from app.domain.chat.entities import ConversationHistory, LLMChunk, LLMResult
from app.domain.chat.ports import BaseLLMProvider
from app.domain.voice.entities import TTSChunk, TTSResult
from app.domain.voice.ports import BaseTTSProvider


class SlowNoSentenceLLM(BaseLLMProvider):
    async def stream(
        self,
        history: ConversationHistory,
        on_sentence=None,
        trace_id: str | None = None,
    ) -> AsyncGenerator[LLMChunk, None]:
        await asyncio.sleep(0.45)
        yield LLMChunk(token="", is_done=True)

    async def complete(self, history: ConversationHistory) -> LLMResult:
        return LLMResult(full_text="")

    async def is_available(self) -> bool:
        return True


class NoopTTS(BaseTTSProvider):
    def __init__(self) -> None:
        self.voice = "aria"

    async def synthesize(self, text: str) -> TTSResult:
        return TTSResult(audio_bytes=b"audio", audio_duration_ms=100)

    async def synthesize_streaming(self, text: str) -> AsyncGenerator[TTSChunk, None]:
        if False:
            yield TTSChunk(is_done=True)

    async def generate(
        self,
        text: str,
        session_id: str,
        message_id: str,
        trace_id: str | None = None,
        voice: str | None = None,
    ) -> TTSResult:
        return TTSResult(audio_bytes=b"audio", audio_duration_ms=100, audio_ref="/tmp/audio.mp3")

    async def get_available_voices(self) -> list[dict[str, str]]:
        return []

    def generate_cache_key(self, text: str, voice: str | None = None) -> str:
        return f"{voice or self.voice}:{text}"

    async def get_voice_settings(self, voice_name: str) -> dict:
        return {"voice": voice_name}


class FakeFillerCache:
    async def get_or_generate_filler(
        self,
        text: str,
        voice: str | None = None,
        session_id: str = "system",
    ) -> TTSResult:
        return TTSResult(
            audio_bytes=b"filler",
            audio_duration_ms=100,
            audio_ref="/tmp/system/filler.mp3",
        )


@pytest.mark.asyncio
async def test_filler_audio_is_disabled_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.domain.voice.filler_cache as filler_cache

    monkeypatch.setattr(filler_cache, "get_filler_cache", lambda: FakeFillerCache())

    messages = []

    async def send_callback(message) -> None:
        messages.append(message)

    pipeline = ConversationPipeline(llm=SlowNoSentenceLLM(), tts=NoopTTS())

    await pipeline.process_message(
        message_id="message-1",
        text="Hello",
        session_id="session-1",
        send_callback=send_callback,
    )

    message_ids = [getattr(message, "message_id", "") for message in messages]
    assert "message-1_filler" not in message_ids
