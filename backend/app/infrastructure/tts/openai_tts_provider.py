import asyncio
import re
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import ClassVar

import httpx
from loguru import logger

from app.domain.voice.entities import TTSChunk, TTSResult
from app.domain.voice.ports import BaseTTSProvider
from app.infrastructure.cache.tts_cache import cache_audio, get_cached_audio
from app.infrastructure.tts.tts_utils import calculate_audio_duration, clean_text_for_tts
from app.shared.config import get_settings
from app.shared.errors import TTSException


class OpenAITTSProvider(BaseTTSProvider):
    """
    OpenAI-Compatible TTS Provider
    Uses a local Kokoro TTS container (openedai-speech) for high-fidelity audio.
    """

    DEFAULT_API_VOICE: ClassVar[str] = "nova"
    VOICE_MAPPING: ClassVar[dict[str, str]] = {
        "aria": "nova",
        "en-us-arianeural": "nova",
        "jenny": "shimmer",
        "en-us-jennyneural": "shimmer",
        "sonia": "alloy",
        "en-gb-sonianeural": "alloy",
        "guy": "onyx",
        "en-us-guyneural": "onyx",
        "christopher": "echo",
        "en-us-christopherneural": "echo",
        "ryan": "fable",
        "en-gb-ryanneural": "fable",
    }

    SUPPORTED_VOICES: ClassVar[set[str]] = {
        "alloy",
        "ash",
        "ballad",
        "cedar",
        "coral",
        "echo",
        "fable",
        "marin",
        "nova",
        "onyx",
        "sage",
        "shimmer",
        "verse",
    }

    def __init__(self, voice: str = "aria", speed: float = 0.8, model: str = "tts-1", **kwargs):
        self.voice = voice
        self.speed = speed
        self.model = model if model in ("tts-1", "tts-1-hd") else "tts-1"
        self.api_url = "http://tts:8000/v1/audio/speech"
        # Reuse HTTP client for connection pooling (avoids TCP+TLS overhead per request)
        self._client = httpx.AsyncClient(
            timeout=300.0,
            limits=httpx.Limits(max_connections=4, max_keepalive_connections=2),
        )
        logger.info(f"OpenAITTSProvider initialized | voice={self.voice} | model={self.model}")

    @property
    def api_voice(self) -> str:
        return self.resolve_voice(self.voice)

    @classmethod
    def resolve_voice(cls, voice: str | None = None) -> str:
        if not voice or not isinstance(voice, str):
            return cls.DEFAULT_API_VOICE

        normalized = voice.strip().lower()
        if normalized in cls.SUPPORTED_VOICES:
            return normalized
        return cls.VOICE_MAPPING.get(normalized, cls.DEFAULT_API_VOICE)

    async def get_voice_settings(self, voice_name: str) -> dict:
        return {
            "voice": voice_name,
            "api_voice": self.resolve_voice(voice_name),
            "speed": getattr(self, "speed", 1.0),
        }

    def _is_safe_path_component(self, component: str) -> bool:
        if not component:
            return False
        if ".." in component or "/" in component or "\\" in component:
            return False
        if not re.match(r"^[a-zA-Z0-9_-]+$", component):
            return False
        return True

    def generate_cache_key(self, text: str, voice: str | None = None) -> str:
        from app.infrastructure.cache.cache_keys import tts_cache_key
        from app.infrastructure.tts.tts_utils import clean_text_for_tts

        sanitized = clean_text_for_tts(text)
        return tts_cache_key(sanitized, self.resolve_voice(voice or self.voice))

    @classmethod
    def audio_file_id(cls, message_id: str, api_voice: str) -> str:
        return f"{message_id}_{cls.resolve_voice(api_voice)}"

    async def generate(
        self,
        text: str,
        session_id: str,
        message_id: str,
        trace_id: str | None = None,
        voice: str | None = None,
    ) -> TTSResult:
        if not self._is_safe_path_component(session_id):
            raise TTSException(f"Invalid session_id: {session_id}")
        if not self._is_safe_path_component(message_id):
            raise TTSException(f"Invalid message_id: {message_id}")

        # Sanitize text BEFORE cache lookup so formatting differences don't cause misses
        sanitized_text = clean_text_for_tts(text)
        if not sanitized_text.strip():
            raise TTSException("Empty text after sanitization")

        if not voice:
            logger.warning(
                f"TTSProvider fell back to initialization default (self.voice={self.voice}) "
                f"because voice parameter was missing or falsy! session={session_id} message={message_id}"
            )
        requested_voice = voice or self.voice
        api_voice = self.resolve_voice(requested_voice)

        # STRICT ENFORCEMENT: We will explicitly override the api_voice using the voice kwarg if it is present and valid.
        # This guarantees the pipeline passed voice is used.
        if voice:
            api_voice = self.resolve_voice(voice)

        logger.info(
            f"TTS generate | session={session_id} | message={message_id} | "
            f"voice={requested_voice} | api_voice={api_voice} | trace_id={trace_id}"
        )

        cached_audio = await get_cached_audio(text=sanitized_text, voice=api_voice)
        if cached_audio is not None:
            logger.info("TTS cache hit")
            result = TTSResult(
                audio_bytes=cached_audio,
                visemes=[],
                word_boundaries=[],
                audio_duration_ms=calculate_audio_duration(cached_audio, format="pcm"),
            )
        else:
            try:
                result = await asyncio.wait_for(
                    self.synthesize(sanitized_text, trace_id=trace_id, voice=api_voice),
                    timeout=get_settings().TTS_TIMEOUT_SEC,
                )
            except asyncio.TimeoutError:
                raise TTSException("TTS synthesis timed out (wait_for trigger)") from None
            await cache_audio(text=sanitized_text, voice=api_voice, audio_bytes=result.audio_bytes)

        storage_base = Path(get_settings().AUDIO_STORAGE_PATH)
        session_dir = storage_base / session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        audio_file_id = self.audio_file_id(message_id, api_voice)
        audio_file_path = session_dir / f"{audio_file_id}.pcm"
        try:
            audio_file_path.write_bytes(result.audio_bytes)
            logger.success(f"Audio saved | path={audio_file_path}")
        except Exception as e:
            logger.error(f"Failed to save audio: {e}")
            raise TTSException(f"Failed to save audio: {e!s}") from e

        result.audio_ref = str(audio_file_path)
        return result

    async def synthesize(
        self,
        text: str,
        trace_id: str | None = None,
        voice: str | None = None,
    ) -> TTSResult:
        text = clean_text_for_tts(text)
        if not text.strip():
            raise TTSException("Empty text provided")

        api_voice = self.resolve_voice(voice or self.voice)
        try:
            response = await self._client.post(
                self.api_url,
                json={
                    "model": self.model,
                    "input": text,
                    "voice": api_voice,
                    "response_format": "pcm",
                    "speed": self.speed,
                },
            )
            if response.status_code != 200:
                logger.error(f"TTS API Error details: {response.text}")
            response.raise_for_status()
            audio_bytes = response.content
        except Exception as e:
            logger.error(f"TTS synthesis failed: {e} | trace_id={trace_id}")
            raise TTSException(f"TTS failed: {e!s}") from e

        if not audio_bytes:
            raise TTSException("TTS returned empty audio")

        audio_duration_ms = calculate_audio_duration(audio_bytes, format="pcm")

        return TTSResult(
            audio_bytes=audio_bytes,
            visemes=[],
            word_boundaries=[],
            audio_duration_ms=audio_duration_ms,
        )

    async def synthesize_streaming(
        self, text: str, max_retries: int = 3, voice: str | None = None
    ) -> AsyncGenerator[TTSChunk, None]:
        from app.infrastructure.cache.tts_cache import get_cached_audio, cache_audio
        text = clean_text_for_tts(text)
        if not text.strip():
            raise TTSException("Empty text provided")

        api_voice = self.resolve_voice(voice or self.voice)

        # Check cache
        cached_audio = await get_cached_audio(text=text, voice=api_voice)
        if cached_audio is not None:
            logger.info("TTS streaming cache hit")
            yield TTSChunk(audio_data=cached_audio)
            yield TTSChunk(is_done=True)
            return

        accumulated_chunks = []
        for attempt in range(max_retries):
            try:
                async with self._client.stream(
                    "POST",
                    self.api_url,
                    json={
                        "model": self.model,
                        "input": text,
                        "voice": api_voice,
                        "response_format": "pcm",
                        "speed": self.speed,
                    },
                ) as response:
                    if response.status_code != 200:
                        error_details = await response.aread()
                        logger.error(
                            f"TTS API Error details: {error_details.decode('utf-8', errors='replace') if error_details else ''}"
                        )
                    response.raise_for_status()
                    remainder = b""
                    async for chunk in response.aiter_bytes():
                        if chunk:
                            data = remainder + chunk
                            if len(data) % 2 != 0:
                                remainder = data[-1:]
                                data = data[:-1]
                            else:
                                remainder = b""
                            
                            if data:
                                accumulated_chunks.append(data)
                                yield TTSChunk(audio_data=data)
                    
                    if remainder:
                        accumulated_chunks.append(remainder)
                        yield TTSChunk(audio_data=remainder)
                
                # Cache the accumulated audio
                full_audio = b"".join(accumulated_chunks)
                if full_audio:
                    await cache_audio(text=text, voice=api_voice, audio_bytes=full_audio)
                    
                yield TTSChunk(is_done=True)
                return
            except Exception as e:
                accumulated_chunks.clear()
                if attempt < max_retries - 1:
                    await asyncio.sleep(2**attempt)
                else:
                    raise TTSException(f"TTS streaming failed: {e!s}") from e

    async def get_available_voices(self) -> list[dict]:
        return [
            {
                "id": "aria",
                "name": "Aria",
                "api_voice": "nova",
                "language": "en-US",
                "gender": "Female",
            },
            {
                "id": "jenny",
                "name": "Jenny",
                "api_voice": "shimmer",
                "language": "en-US",
                "gender": "Female",
            },
            {
                "id": "sonia",
                "name": "Sonia",
                "api_voice": "alloy",
                "language": "en-GB",
                "gender": "Female",
            },
            {
                "id": "guy",
                "name": "Guy",
                "api_voice": "onyx",
                "language": "en-US",
                "gender": "Male",
            },
            {
                "id": "christopher",
                "name": "Christopher",
                "api_voice": "echo",
                "language": "en-US",
                "gender": "Male",
            },
            {
                "id": "ryan",
                "name": "Ryan",
                "api_voice": "fable",
                "language": "en-GB",
                "gender": "Male",
            },
        ]
