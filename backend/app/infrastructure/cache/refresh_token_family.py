"""Refresh token family tracking and replay detection."""

from __future__ import annotations

# 1. Standard Library
import json
from datetime import datetime, timezone

# 2. Third-Party
from loguru import logger
from redis.asyncio.client import Redis as AsyncRedis

# 3. Local Application
from app.infrastructure.cache.cache_keys import (
    auth_refresh_active_jti_key,
    auth_refresh_consumed_jti_key,
    auth_refresh_family_meta_key,
    auth_refresh_family_revoked_key,
    auth_refresh_key,
    auth_refresh_reuse_incident_key,
    auth_refresh_rotation_lock_key,
    auth_refresh_user_families_key,
)
from app.infrastructure.cache.redis_client import get_redis
from app.shared.config import get_settings


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_device_name(user_agent: str) -> str:
    """Extract a simple device name from User-Agent string."""
    ua = user_agent.lower()
    if "iphone" in ua:
        return "iPhone"
    if "ipad" in ua:
        return "iPad"
    if "android" in ua:
        return "Android Device"
    if "macintosh" in ua or "mac os" in ua:
        return "Mac"
    if "windows" in ua:
        return "Windows PC"
    if "linux" in ua:
        return "Linux PC"
    return "Unknown Device"


async def acquire_refresh_rotation_lock(user_id: str, family_id: str) -> str | None:
    settings = get_settings()
    redis_client: AsyncRedis = get_redis()
    token = f"{user_id}:{family_id}:{datetime.now(timezone.utc).timestamp()}"
    acquired: bool | None = await redis_client.execute_command(
        "SET",
        auth_refresh_rotation_lock_key(user_id, family_id),
        token,
        "EX",
        settings.REFRESH_ROTATION_LOCK_SECONDS,
        "NX",
    )
    return token if acquired else None


async def release_refresh_rotation_lock(user_id: str, family_id: str, token: str) -> None:
    redis_client: AsyncRedis = get_redis()
    key = auth_refresh_rotation_lock_key(user_id, family_id)
    script = """
    if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
    end
    return 0
    """
    await redis_client.execute_command("EVAL", script, 1, key, token)


async def store_initial_refresh_token(
    user_id: str,
    family_id: str,
    refresh_token: str,
    refresh_jti: str,
    ttl_seconds: int,
    *,
    client_ip: str = "unknown",
    user_agent: str = "unknown",
    device_name: str | None = None,
) -> None:
    redis_client: AsyncRedis = get_redis()
    from redis.asyncio.client import Pipeline

    pipe: Pipeline = redis_client.pipeline()
    pipe.setex(auth_refresh_key(user_id, family_id), ttl_seconds, refresh_token)
    pipe.setex(auth_refresh_active_jti_key(user_id, family_id), ttl_seconds, refresh_jti)
    pipe.sadd(auth_refresh_user_families_key(user_id), family_id)
    pipe.expire(auth_refresh_user_families_key(user_id), ttl_seconds)
    pipe.delete(auth_refresh_family_revoked_key(user_id, family_id))
    # Session metadata
    pipe.hset(
        auth_refresh_family_meta_key(user_id, family_id),
        mapping={
            "ip": client_ip,
            "ua": user_agent,
            "device_name": device_name or _parse_device_name(user_agent),
            "created_at": _now_iso(),
            "last_seen": _now_iso(),
            "revoked_reason": "",
        },
    )
    pipe.expire(auth_refresh_family_meta_key(user_id, family_id), ttl_seconds)
    await pipe.execute()


async def mark_refresh_rotated(
    user_id: str,
    family_id: str,
    old_jti: str,
    new_jti: str,
    new_refresh_token: str,
    ttl_seconds: int,
) -> None:
    redis_client: AsyncRedis = get_redis()
    consumed_payload = json.dumps(
        {
            "user_id": user_id,
            "rotated_at": _now_iso(),
            "replaced_by_jti": new_jti,
        }
    )
    from redis.asyncio.client import Pipeline

    pipe: Pipeline = redis_client.pipeline()
    pipe.setex(auth_refresh_consumed_jti_key(old_jti), ttl_seconds, consumed_payload)
    pipe.setex(auth_refresh_key(user_id, family_id), ttl_seconds, new_refresh_token)
    pipe.setex(auth_refresh_active_jti_key(user_id, family_id), ttl_seconds, new_jti)
    pipe.sadd(auth_refresh_user_families_key(user_id), family_id)
    pipe.expire(auth_refresh_user_families_key(user_id), ttl_seconds)
    pipe.hset(
        auth_refresh_family_meta_key(user_id, family_id),
        "last_seen",
        _now_iso(),
    )
    pipe.expire(auth_refresh_family_meta_key(user_id, family_id), ttl_seconds)
    await pipe.execute()


async def is_refresh_jti_consumed(jti: str) -> bool:
    try:
        redis_client: AsyncRedis = get_redis()
        return bool(
            await redis_client.execute_command("EXISTS", auth_refresh_consumed_jti_key(jti))
        )
    except Exception as e:
        logger.error(f"[RefreshFamily] consumed check failed (FAILING CLOSED): {e}")
        return True


async def is_refresh_family_revoked(user_id: str, family_id: str) -> bool:
    try:
        redis_client: AsyncRedis = get_redis()
        return bool(
            await redis_client.execute_command(
                "EXISTS", auth_refresh_family_revoked_key(user_id, family_id)
            )
        )
    except Exception as e:
        logger.error(f"[RefreshFamily] revoked check failed (FAILING CLOSED): {e}")
        return True


async def revoke_refresh_family(
    user_id: str, family_id: str, *, reason: str, replay_jti: str | None = None
) -> None:
    settings = get_settings()
    ttl_seconds = settings.REFRESH_REUSE_INCIDENT_TTL_DAYS * 24 * 60 * 60
    redis_client: AsyncRedis = get_redis()
    from redis.asyncio.client import Pipeline

    pipe: Pipeline = redis_client.pipeline()
    pipe.delete(auth_refresh_key(user_id, family_id))
    pipe.delete(auth_refresh_active_jti_key(user_id, family_id))
    pipe.setex(
        auth_refresh_family_revoked_key(user_id, family_id),
        ttl_seconds,
        json.dumps({"reason": reason, "revoked_at": _now_iso(), "replay_jti": replay_jti}),
    )
    if replay_jti:
        pipe.hset(
            auth_refresh_reuse_incident_key(user_id, replay_jti),
            mapping={
                "user_id": user_id,
                "jti": replay_jti,
                "reason": reason,
                "detected_at": _now_iso(),
            },
        )
        pipe.expire(auth_refresh_reuse_incident_key(user_id, replay_jti), ttl_seconds)
    # Update the session metadata hash so the revocation reason is visible
    # even if the session is later included in a dashboard query.
    meta_key = auth_refresh_family_meta_key(user_id, family_id)
    pipe.hset(meta_key, mapping={"revoked_reason": reason, "last_seen": _now_iso()})
    pipe.expire(meta_key, ttl_seconds)
    await pipe.execute()

    from app.shared.metrics import auth_token_revocations

    auth_token_revocations.labels(reason=reason).inc()

    from app.infrastructure.cache.pubsub import publish_session_invalidation

    await publish_session_invalidation(user_id, family_id)

    logger.warning(
        {
            "event": "refresh_family_revoked",
            "user_id": user_id,
            "family_id": family_id,
            "reason": reason,
            "replay_jti_prefix": replay_jti[:8] if replay_jti else None,
        }
    )


async def revoke_all_refresh_families(
    user_id: str, *, reason: str, replay_jti: str | None = None
) -> None:
    redis_client: AsyncRedis = get_redis()
    result = await redis_client.execute_command("SMEMBERS", auth_refresh_user_families_key(user_id))
    raw_families: set[bytes] = (
        result if isinstance(result, set) else set(result) if isinstance(result, list) else set()
    )
    families = [
        item.decode("utf-8") if isinstance(item, bytes) else str(item) for item in raw_families
    ]
    if not families:
        return
    for family_id in families:
        await revoke_refresh_family(user_id, family_id, reason=reason, replay_jti=replay_jti)
