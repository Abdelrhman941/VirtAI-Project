"""
Redis async client — connection lifecycle management.

Single redis.asyncio client instance shared across the application.
Uses hiredis parser for performance where available.

Pattern: init_redis() at startup, close_redis() at shutdown.
get_redis() returns the active client for use in cache modules.
"""

from __future__ import annotations

import asyncio

from loguru import logger
from redis.asyncio import Redis

from app.shared.config import get_settings

_redis: Redis | None = None


async def init_redis() -> None:
    """
    Connect to Redis and verify connectivity.
    Called once at application startup (lifespan).
    """
    global _redis

    settings = get_settings()
    url_safe = settings.REDIS_URL.split("@")[-1] if "@" in settings.REDIS_URL else "redacted"
    logger.info(f"Connecting to Redis | url={url_safe}")

    last_error: Exception | None = None
    for attempt in range(1, settings.REDIS_CONNECT_RETRIES + 1):
        _redis = Redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=False,  # keep bytes; callers encode/decode as needed
            socket_connect_timeout=30.0,
            socket_timeout=30.0,
            max_connections=50,
        )

        try:
            await _redis.ping()  # type: ignore[misc]
            logger.info("Redis connection established")
            return
        except Exception as exc:
            last_error = exc
            await _redis.aclose()
            _redis = None
            logger.warning(
                {
                    "event": "redis_connect_failed",
                    "attempt": attempt,
                    "max_attempts": settings.REDIS_CONNECT_RETRIES,
                    "error_type": type(exc).__name__,
                }
            )
            if attempt < settings.REDIS_CONNECT_RETRIES:
                await asyncio.sleep(settings.REDIS_CONNECT_RETRY_DELAY_SEC)

    raise RuntimeError("Redis connection failed") from last_error


async def close_redis() -> None:
    """Close Redis connection. Called at application shutdown."""
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None
        logger.info("Redis connection closed")


def get_redis() -> Redis:
    """
    Return the active Redis client.
    Raises RuntimeError if init_redis() has not been called.
    """
    if _redis is None:
        raise RuntimeError(
            "Redis not initialised. Ensure init_redis() is called in the app lifespan."
        )
    return _redis


async def is_redis_healthy() -> bool:
    """Non-throwing health check."""
    if _redis is None:
        return False
    try:
        await _redis.ping()  # type: ignore[misc]
        return True
    except Exception:
        return False


def get_redis_or_none() -> Redis | None:
    """Return Redis client or None if unavailable (for fail-closed paths)."""
    return _redis
