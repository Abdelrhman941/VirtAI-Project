"""
Sliding window rate limiter using Redis sorted sets.

Algorithm:
    1. Remove all entries older than `window` seconds
    2. Count remaining entries
    3. If count >= limit → deny
    4. Otherwise → add current timestamp + allow

The sorted set score is the Unix timestamp in milliseconds,
which gives sub-second precision.

Key: virtai:rate:{identifier}:{window}
TTL: window + 1 second (auto-expire stale sets)
"""

from __future__ import annotations

import time

from loguru import logger

from app.infrastructure.cache.cache_keys import rate_limit_key
from app.infrastructure.cache.redis_client import get_redis
from app.shared.metrics import rate_limit_hits


async def check_rate_limit(
    identifier: str,
    limit: int,
    window: int,
) -> bool:
    """
    Check and record a request against the rate limit.

    Args:
        identifier: uniquely identifies the caller (user_id or IP)
        limit     : max allowed requests in the window
        window    : time window in seconds

    Returns:
        True  → request is allowed (within limit)
        False → request is denied (limit exceeded)

    On Redis error → allows the request (fail open) to avoid blocking users
    during cache outages.
    """
    try:
        redis = get_redis()
        key = rate_limit_key(identifier, window)
        now_ms = int(time.time() * 1000)
        window_start_ms = now_ms - (window * 1000)

        pipe = redis.pipeline()
        # Remove expired entries
        pipe.zremrangebyscore(key, 0, window_start_ms)
        # Count remaining
        pipe.zcard(key)
        # Add this request
        pipe.zadd(key, {str(now_ms): now_ms})
        # Set TTL so the key auto-expires
        pipe.expire(key, window + 1)

        results = await pipe.execute()
        current_count = results[1]  # zcard result (before this request)

        allowed = current_count < limit
        if not allowed:
            # Extract scope from identifier (e.g. 'auth:login:127.0.0.1' -> 'login')
            parts = identifier.split(":")
            scope = parts[1] if len(parts) > 1 else "unknown"
            rate_limit_hits.labels(scope=scope).inc()

            logger.warning(
                f"[RateLimit] DENIED | id={identifier} | count={current_count} | "
                f"limit={limit} | window={window}s"
            )
        return allowed

    except Exception as e:
        # Fail open — do not block users during Redis outages
        logger.error(f"[RateLimit] Redis error (failing open): {e}")
        return True


async def get_request_count(identifier: str, window: int) -> int:
    """Return the current request count (for debugging/monitoring)."""
    try:
        redis = get_redis()
        key = rate_limit_key(identifier, window)
        now_ms = int(time.time() * 1000)
        window_start_ms = now_ms - (window * 1000)
        await redis.zremrangebyscore(key, 0, window_start_ms)
        return await redis.zcard(key)
    except Exception:
        return 0
