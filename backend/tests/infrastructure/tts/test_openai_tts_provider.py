import pytest

import app.infrastructure.tts.openai_tts_provider as tts_provider_module
from app.infrastructure.cache.cache_keys import tts_cache_key
from app.infrastructure.tts.openai_tts_provider import OpenAITTSProvider
from app.shared.errors import TTSException


def test_frontend_voice_ids_resolve_to_openai_api_voices() -> None:
    assert OpenAITTSProvider.resolve_voice("aria") == "nova"
    assert OpenAITTSProvider.resolve_voice("jenny") == "shimmer"
    assert OpenAITTSProvider.resolve_voice("sonia") == "alloy"
    assert OpenAITTSProvider.resolve_voice("guy") == "onyx"
    assert OpenAITTSProvider.resolve_voice("christopher") == "echo"
    assert OpenAITTSProvider.resolve_voice("ryan") == "fable"


def test_tts_cache_key_contains_literal_api_voice() -> None:
    text = "Same text, different voice."

    nova_key = tts_cache_key(text, "nova")
    onyx_key = tts_cache_key(text, "onyx")

    assert nova_key.startswith("virtai:tts:cache:nova:")
    assert onyx_key.startswith("virtai:tts:cache:onyx:")
    assert nova_key != onyx_key


def test_audio_file_id_contains_api_voice_suffix() -> None:
    message_id = "0e5e4f4f-60c7-44ec-bd0f-745c692d4476_0"

    assert OpenAITTSProvider.audio_file_id(message_id, "onyx") == f"{message_id}_onyx"


@pytest.mark.asyncio
async def test_api_voice_reflects_current_provider_voice() -> None:
    provider = OpenAITTSProvider(voice="aria")
    try:
        assert provider.api_voice == "nova"

        provider.voice = "guy"

        assert provider.api_voice == "onyx"
    finally:
        await provider._client.aclose()


@pytest.mark.asyncio
async def test_generate_uses_configured_tts_timeout(monkeypatch, tmp_path) -> None:
    class Settings:
        TTS_TIMEOUT_SEC = 0.01
        AUDIO_STORAGE_PATH = str(tmp_path)

    async def slow_synthesize(*args, **kwargs):
        import asyncio

        await asyncio.sleep(0.05)
        from app.domain.voice.entities import TTSResult

        return TTSResult(audio_bytes=b"audio", audio_duration_ms=100)

    async def no_cached_audio(*args, **kwargs):
        return None

    async def cache_noop(*args, **kwargs):
        return None

    monkeypatch.setattr(tts_provider_module, "get_settings", lambda: Settings())
    monkeypatch.setattr(tts_provider_module, "get_cached_audio", no_cached_audio)
    monkeypatch.setattr(tts_provider_module, "cache_audio", cache_noop)

    provider = OpenAITTSProvider(voice="aria")
    monkeypatch.setattr(provider, "synthesize", slow_synthesize)

    try:
        with pytest.raises(TTSException, match="timed out"):
            await provider.generate(
                text="This should time out.",
                session_id="session1",
                message_id="message1",
            )
    finally:
        await provider._client.aclose()
