"""
Redis-backed chat context cache.

Stores the last N messages per session as a Redis List of JSON strings.
PostgreSQL remains the source of truth — Redis is a fast read-through cache.

Flow:
    get_context()   → Redis HIT  → return messages
                    → Redis MISS → return [] (no rebuild)
    get_or_rebuild_context()    → Redis HIT  → return messages
                                → Redis MISS → rebuild from PostgreSQL → return messages
    push_message()  → append to Redis list + trim to MAX_MESSAGES
    invalidate()    → delete context key (e.g. session ended)

Key: virtai:chat:ctx:{session_id}   (Redis List, JSON strings)
TTL: REDIS_CHAT_CONTEXT_TTL seconds (refreshed on each push)
"""

from __future__ import annotations

import asyncio
import json

from loguru import logger
from redis.asyncio.client import Redis as AsyncRedis

from app.domain.chat.ports import ChatContextCachePort
from app.infrastructure.cache.cache_keys import chat_context_key
from app.infrastructure.cache.redis_client import get_redis
from app.shared.config import get_settings


class ChatContextCache(ChatContextCachePort):
    async def get_or_rebuild_context(self, session_id: str) -> list[dict]:
        return await get_or_rebuild_context(session_id)

    async def push_message(
        self, session_id: str, role: str, content: str, extra: dict | None = None
    ) -> None:
        return await push_message(session_id, role, content, extra)

    async def invalidate(self, session_id: str) -> None:
        return await invalidate(session_id)


# Maximum messages stored per session in Redis
MAX_MESSAGES = 50


async def get_context(session_id: str) -> list[dict]:
    """
    Return the last MAX_MESSAGES messages for a session from Redis.

    Returns an empty list if Redis is unavailable or key is missing.
    Does NOT trigger a PostgreSQL rebuild — call rebuild_context() explicitly.
    """
    try:
        redis_client: AsyncRedis = get_redis()
        key = chat_context_key(session_id)
        result = await redis_client.execute_command("LRANGE", key, 0, -1)
        raw_messages: list[bytes] = result if isinstance(result, list) else []
        return [json.loads(m) for m in raw_messages]
    except Exception as e:
        logger.warning(f"[ChatContextCache] get_context failed | session={session_id} | {e}")
        return []


_rebuild_locks: dict[str, asyncio.Lock] = {}


async def get_or_rebuild_context(session_id: str) -> list[dict]:
    """
    Get context from Redis, rebuilding from PostgreSQL if the key is missing or expired.

    This is the preferred method for the pipeline — it guarantees fresh context
    on a cache miss without failing the request.
    """
    messages = await get_context(session_id)
    if not messages:
        lock = _rebuild_locks.get(session_id)
        if lock is None:
            lock = asyncio.Lock()
            _rebuild_locks[session_id] = lock

        async with lock:
            messages = await get_context(session_id)
            if not messages:
                logger.info(f"[ChatContextCache] Cache miss — rebuilding | session={session_id}")
                messages = await rebuild_context(session_id)
    return messages


async def push_message(
    session_id: str,
    role: str,
    content: str,
    extra: dict | None = None,
) -> None:
    """
    Append a message to the context list and trim to MAX_MESSAGES.
    Refreshes TTL on every write.

    Args:
        session_id: active session id
        role      : "user" or "assistant"
        content   : message text
        extra     : optional extra fields (input_type, tts_cache_key, etc.)
    """
    try:
        settings = get_settings()
        redis_client: AsyncRedis = get_redis()
        key = chat_context_key(session_id)

        message = {"role": role, "content": content}
        if extra:
            message.update(extra)

        from redis.asyncio.client import Pipeline

        pipe: Pipeline = redis_client.pipeline()
        pipe.rpush(key, json.dumps(message))
        pipe.ltrim(key, -MAX_MESSAGES, -1)  # keep last N
        pipe.expire(key, settings.REDIS_CHAT_CONTEXT_TTL)  # refresh TTL
        await pipe.execute()
    except Exception as e:
        logger.warning(f"[ChatContextCache] push_message failed | session={session_id} | {e}")


async def rebuild_context(session_id: str) -> list[dict]:
    """
    Fetch the last MAX_MESSAGES messages from PostgreSQL and repopulate Redis.

    Called on a cache miss. Returns the messages fetched.
    Fails gracefully if PostgreSQL is also unreachable.
    """
    try:
        from app.infrastructure.db.database import AsyncSessionLocal
        from app.infrastructure.db.repositories.chat_repository import ChatRepository
        from app.infrastructure.storage.local_storage import LocalStorageProvider
        from app.shared.config import get_settings

        async with AsyncSessionLocal() as db:
            settings = get_settings()
            storage = LocalStorageProvider(base_path=settings.UPLOAD_BASE_PATH)
            repo = ChatRepository(db, storage_provider=storage)
            messages = await repo.get_session_messages(session_id, limit=MAX_MESSAGES)
            if not messages:
                return []

        settings = get_settings()
        redis_client: AsyncRedis = get_redis()
        key = chat_context_key(session_id)

        # Rebuild atomically
        from redis.asyncio.client import Pipeline

        pipe: Pipeline = redis_client.pipeline()
        pipe.delete(key)
        for msg in messages:
            pipe.rpush(key, json.dumps({"role": msg["role"], "content": msg["content"]}))
        pipe.expire(key, settings.REDIS_CHAT_CONTEXT_TTL)
        await pipe.execute()

        logger.info(
            f"[ChatContextCache] Rebuilt from PostgreSQL | session={session_id} | count={len(messages)}"
        )
        return [{"role": m["role"], "content": m["content"]} for m in messages]

    except Exception as e:
        logger.error(f"[ChatContextCache] rebuild_context failed | session={session_id} | {e}")
        return []


async def invalidate(session_id: str) -> None:
    """Delete the context key for a session (e.g. on session end)."""
    _rebuild_locks.pop(session_id, None)
    try:
        redis_client: AsyncRedis = get_redis()
        await redis_client.execute_command("DEL", chat_context_key(session_id))
        logger.debug(f"[ChatContextCache] Context invalidated | session={session_id}")
    except Exception as e:
        logger.warning(f"[ChatContextCache] invalidate failed | session={session_id} | {e}")
