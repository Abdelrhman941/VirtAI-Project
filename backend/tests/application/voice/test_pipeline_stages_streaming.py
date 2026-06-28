import asyncio
import io
import pytest
import numpy as np
from unittest.mock import AsyncMock, MagicMock, patch

from app.application.voice.pipeline_stages import TTSStage, AnimationStage, generate_visemes
from app.application.voice.pipeline_context import TurnContext
from app.domain.voice.entities import TTSChunk, TTSResult
from app.schemas.ws_messages import MouthCue


class MockTTSProvider:
    def __init__(self, chunks):
        self.chunks = chunks
        self.voice = "test_voice"

    def resolve_voice(self, voice):
        return voice or self.voice

    def audio_file_id(self, message_id, voice):
        return f"{message_id}_{voice}"

    async def synthesize_streaming(self, text: str, voice: str | None = None):
        for chunk in self.chunks:
            yield TTSChunk(audio_data=chunk)


@pytest.mark.asyncio
async def test_tts_stage_streaming():
    """Test that TTSStage correctly streams binary chunks to context and accumulates them."""
    chunks = [b"chunk1", b"chunk2", b"chunk3"]
    mock_tts = MockTTSProvider(chunks)

    context = TurnContext(
        session_id="test_session",
        message_id="msg123",
        trace_id="trace1",
        text_input="Hello world",
        tts_voice="test_voice",
    )
    context.current_sentence = "Hello world"
    context.history = MagicMock()
    context.send_binary_callback = AsyncMock()

    stage = TTSStage(tts=mock_tts)

    with patch("app.infrastructure.tts.tts_utils.calculate_audio_duration", return_value=1500), \
         patch("pathlib.Path.write_bytes") as mock_write, \
         patch("app.application.voice.pipeline_stages.logger"):

        await stage.process(context)

    # Check binary callback was called for each chunk
    assert context.send_binary_callback.call_count == 3
    context.send_binary_callback.assert_any_call(b"chunk1")
    context.send_binary_callback.assert_any_call(b"chunk2")
    context.send_binary_callback.assert_any_call(b"chunk3")

    # Check TTSResult was correctly formed
    assert context.tts_result is not None
    assert context.tts_result.audio_bytes == b"chunk1chunk2chunk3"
    assert context.tts_result.audio_duration_ms == 1500
    mock_write.assert_called_once_with(b"chunk1chunk2chunk3")


@pytest.mark.asyncio
async def test_tts_stage_cancellation():
    """Test that TTSStage handles cancellation correctly."""
    
    class CancelTTSProvider(MockTTSProvider):
        async def synthesize_streaming(self, text: str, voice: str | None = None):
            yield TTSChunk(audio_data=b"chunk1")
            raise asyncio.CancelledError()

    mock_tts = CancelTTSProvider([b"chunk1"])

    context = TurnContext(
        session_id="test_session",
        message_id="msg123",
        trace_id="trace1",
        text_input="Hello world",
    )
    context.current_sentence = "Hello world"
    context.history = MagicMock()
    context.send_binary_callback = AsyncMock()

    stage = TTSStage(tts=mock_tts)

    with pytest.raises(asyncio.CancelledError):
        await stage.process(context)

    assert context.aborted is True
    assert context.send_binary_callback.call_count == 1


def test_generate_visemes_valid_audio():
    """Test generate_visemes with valid audio bytes."""
    # Create a 1-second dummy audio segment using pydub
    from pydub import AudioSegment
    
    # Create 1s of sine wave at 440Hz
    sample_rate = 16000
    t = np.linspace(0, 1, sample_rate, False)
    # Loud sine wave
    sine_wave = np.sin(2 * np.pi * 440 * t) * 30000 
    
    # Convert to 16-bit PCM
    audio_data = sine_wave.astype(np.int16).tobytes()
    segment = AudioSegment(
        data=audio_data,
        sample_width=2,
        frame_rate=sample_rate,
        channels=1
    )
    
    # Export to mp3 in memory
    buf = io.BytesIO()
    segment.export(buf, format="mp3")
    mp3_bytes = buf.getvalue()
    
    # Run generator
    cues = generate_visemes(mp3_bytes)
    
    # The amplitude should trigger viseme_aa
    assert isinstance(cues, list)
    assert len(cues) > 0
    assert isinstance(cues[0], MouthCue)
    assert cues[0].value == "viseme_aa"


def test_generate_visemes_empty_or_invalid():
    """Test generate_visemes returns empty lists for empty/invalid bytes."""
    assert generate_visemes(b"") == []
    assert generate_visemes(None) == []
    assert generate_visemes(b"invalid_mp3_data") == []
