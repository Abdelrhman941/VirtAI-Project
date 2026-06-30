"""
TTS audio cache — stores synthesised audio bytes in Redis.

Avoids re-synthesising identical text+voice combinations.
Audio bytes are stored as binary strings with a configurable TTL.

Key: virtai:tts:cache:{api_voice}:{sha256(text)[:32]}
TTL: REDIS_TTS_CACHE_TTL seconds (default 24 hours)

Important:
- Only cache non-sensitive content (TTS audio, not user data)
- Large audio blobs are stored directly — avoid caching very long texts
- Returns None on any error (caller must synthesise fresh)
"""

from __future__ import annotations

from loguru import logger

from app.infrastructure.cache.cache_keys import tts_cache_key as _make_key
from app.infrastructure.cache.redis_client import get_redis
from app.shared.config import get_settings

# Maximum audio size to cache (2 MB) — prevents Redis memory abuse
MAX_CACHEABLE_BYTES = 2 * 1024 * 1024


async def get_cached_audio(text: str, voice: str) -> bytes | None:
    """
    Look up cached TTS audio bytes.

    Returns:
        Audio bytes if found in cache, None on miss or error.
    """
    try:
        key = _make_key(text, voice)
        data = await get_redis().get(key)
        if data is not None:
            logger.debug(f"[TTSCache] HIT | voice={voice} | text_len={len(text)}")
        return data  # bytes or None
    except Exception as e:
        logger.warning(f"[TTSCache] get_cached_audio error: {e}")
        return None


async def cache_audio(text: str, voice: str, audio_bytes: bytes) -> None:
    """
    Store TTS audio bytes in Redis with TTL.

    Skips caching if audio exceeds MAX_CACHEABLE_BYTES.
    """
    if len(audio_bytes) > MAX_CACHEABLE_BYTES:
        logger.debug(
            f"[TTSCache] Skipping cache — audio too large | size={len(audio_bytes)} | "
            f"max={MAX_CACHEABLE_BYTES}"
        )
        return

    try:
        settings = get_settings()
        key = _make_key(text, voice)
        await get_redis().setex(key, settings.REDIS_TTS_CACHE_TTL, audio_bytes)
        logger.debug(
            f"[TTSCache] CACHED | voice={voice} | text_len={len(text)} | "
            f"audio_size={len(audio_bytes)} | ttl={settings.REDIS_TTS_CACHE_TTL}s"
        )
    except Exception as e:
        logger.warning(f"[TTSCache] cache_audio error: {e}")


async def invalidate_audio(text: str, voice: str) -> None:
    """Remove a specific TTS cache entry (e.g. after voice change)."""
    try:
        await get_redis().delete(_make_key(text, voice))
    except Exception as e:
        logger.warning(f"[TTSCache] invalidate_audio error: {e}")
