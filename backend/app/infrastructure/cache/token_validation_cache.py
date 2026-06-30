"""
Short-lived JWT validation cache.

Caches per-JTI validation results to reduce repeated Redis blacklist checks.
"""

from __future__ import annotations

from loguru import logger

from app.infrastructure.cache.cache_keys import token_validation_key
from app.infrastructure.cache.redis_client import get_redis
from app.shared.config import get_settings

_VALID = b"valid"
_REVOKED = b"revoked"
_STATS = {
    "hits": 0,
    "misses": 0,
    "sets": 0,
    "invalidates": 0,
    "errors": 0,
}


def get_token_validation_cache_stats() -> dict[str, float | int]:
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


async def cache_token_status(jti: str, is_revoked: bool, ttl_seconds: int | None = None) -> None:
    """Cache token status by JTI for a short period."""
    try:
        settings = get_settings()
        ttl = ttl_seconds if ttl_seconds is not None else settings.REDIS_TOKEN_VALIDATION_TTL
        value = _REVOKED if is_revoked else _VALID
        await get_redis().setex(token_validation_key(jti), ttl, value)
        _STATS["sets"] += 1
        logger.debug(
            f"[TokenValidationCache] cache_set | jti={jti[:8]}... | status={'revoked' if is_revoked else 'valid'} | ttl={ttl}s"
        )
    except Exception as e:
        _STATS["errors"] += 1
        logger.warning(f"[TokenValidationCache] cache failed | jti={jti[:8]}... | {e}")


async def get_token_status(jti: str) -> bool | None:
    """
    Return cached status.

    Returns:
      True  -> token is revoked
      False -> token is valid
      None  -> not cached / unavailable
    """
    try:
        value = await get_redis().get(token_validation_key(jti))
        if value is None:
            _STATS["misses"] += 1
            logger.debug(f"[TokenValidationCache] cache_miss | jti={jti[:8]}...")
            return None
        if value == _REVOKED or value == "revoked":
            _STATS["hits"] += 1
            logger.debug(f"[TokenValidationCache] cache_hit | jti={jti[:8]}... | status=revoked")
            return True
        if value == _VALID or value == "valid":
            _STATS["hits"] += 1
            logger.debug(f"[TokenValidationCache] cache_hit | jti={jti[:8]}... | status=valid")
            return False
        return None
    except Exception as e:
        _STATS["errors"] += 1
        logger.warning(f"[TokenValidationCache] get failed | jti={jti[:8]}... | {e}")
        return None


async def invalidate_token_status(jti: str) -> None:
    """Remove cached token status (used on logout/revocation)."""
    try:
        await get_redis().delete(token_validation_key(jti))
        _STATS["invalidates"] += 1
        logger.debug(f"[TokenValidationCache] cache_invalidate | jti={jti[:8]}...")
    except Exception as e:
        _STATS["errors"] += 1
        logger.warning(f"[TokenValidationCache] invalidate failed | jti={jti[:8]}... | {e}")
