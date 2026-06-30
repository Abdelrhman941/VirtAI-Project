"""
Redis cache for authenticated user profiles.

Reduces repeated database reads on access-token validation paths.
"""

from __future__ import annotations

import json
from typing import Any

from loguru import logger

from app.infrastructure.cache.cache_keys import auth_session_key
from app.infrastructure.cache.redis_client import get_redis
from app.shared.config import get_settings

_STATS = {
    "hits": 0,
    "misses": 0,
    "sets": 0,
    "invalidates": 0,
    "errors": 0,
}


def get_auth_session_cache_stats() -> dict[str, float | int]:
    lookups = _STATS["hits"] + _STATS["misses"]
    hit_ratio = (_STATS["hits"] / lookups) if lookups else 0.0
    return {
        "hits": _STATS["hits"],
        "misses": _STATS["misses"],
        "sets": _STATS["sets"],
        "invalidates": _STATS["invalidates"],
        "errors": _STATS["errors"],
        "lookups": lookups,
        "hit_ratio": round(hit_ratio, 4),
    }


async def cache_auth_session(
    user_id: str, payload: dict[str, Any], ttl_seconds: int | None = None
) -> None:
    """Store a minimal user payload for fast auth resolution."""
    try:
        settings = get_settings()
        ttl = ttl_seconds if ttl_seconds is not None else settings.REDIS_AUTH_SESSION_TTL
        await get_redis().setex(auth_session_key(user_id), ttl, json.dumps(payload))
        _STATS["sets"] += 1
        logger.debug(f"[AuthSessionCache] cache_set | user={user_id} | ttl={ttl}s")
    except Exception as e:
        _STATS["errors"] += 1
        logger.warning(f"[AuthSessionCache] cache failed | user={user_id} | {e}")


async def get_cached_auth_session(user_id: str) -> dict[str, Any] | None:
    """Return cached auth payload or None when missing/unavailable."""
    try:
        raw = await get_redis().get(auth_session_key(user_id))
        if raw is None:
            _STATS["misses"] += 1
            logger.debug(f"[AuthSessionCache] cache_miss | user={user_id}")
            return None
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        _STATS["hits"] += 1
        logger.debug(f"[AuthSessionCache] cache_hit | user={user_id}")
        return json.loads(raw)
    except Exception as e:
        _STATS["errors"] += 1
        logger.warning(f"[AuthSessionCache] get failed | user={user_id} | {e}")
        return None


async def invalidate_auth_session(user_id: str) -> None:
    """Invalidate cached auth payload."""
    try:
        await get_redis().delete(auth_session_key(user_id))
        _STATS["invalidates"] += 1
        logger.debug(f"[AuthSessionCache] cache_invalidate | user={user_id}")
    except Exception as e:
        _STATS["errors"] += 1
        logger.warning(f"[AuthSessionCache] invalidate failed | user={user_id} | {e}")
