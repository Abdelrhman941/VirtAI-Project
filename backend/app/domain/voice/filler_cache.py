"""Lazy cached fillers for low-latency conversational UX."""

import asyncio

from loguru import logger

from app.domain.voice.entities import TTSResult
from app.domain.voice.ports import BaseTTSProvider


class FillerCache:
    """
    Caches short TTS filler phrases per voice to avoid generation latency
    on every turn. Example phrases: 'Hmm...', 'One moment...', 'Let me think...'
    """

    def __init__(self, tts_provider: BaseTTSProvider):
        self._tts = tts_provider
        # Map: "voice_id:phrase" -> TTSResult
        self._cache: dict[str, TTSResult] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    async def get_or_generate_filler(
        self, phrase: str, voice: str | None = None, session_id: str = "system"
    ) -> TTSResult | None:
        """
        Retrieves a cached filler or generates it if missing.
        """
        if not self._tts:
            return None

        voice_id = voice or getattr(self._tts, "voice", "default")
        cache_key = f"{voice_id}:{phrase}"

        if cache_key in self._cache:
            return self._cache[cache_key]

        if cache_key not in self._locks:
            self._locks[cache_key] = asyncio.Lock()

        async with self._locks[cache_key]:
            # Double check in case another task generated it while waiting
            if cache_key in self._cache:
                return self._cache[cache_key]

            try:
                # Generate it
                logger.info(f"Generating cache miss for filler: '{phrase}' (voice: {voice_id})")
                result = await self._tts.generate(
                    text=phrase,
                    session_id=session_id,
                    message_id=f"filler_{abs(hash(cache_key))}",
                    voice=voice_id,
                )
                self._cache[cache_key] = result
                return result
            except Exception as e:
                logger.error(f"Failed to generate filler '{phrase}' for voice '{voice_id}': {e}")
                return None


# Global instance initialized elsewhere
filler_cache: FillerCache | None = None


def init_filler_cache(tts_provider: BaseTTSProvider) -> FillerCache:
    global filler_cache
    filler_cache = FillerCache(tts_provider)
    return filler_cache


def get_filler_cache() -> FillerCache | None:
    return filler_cache
