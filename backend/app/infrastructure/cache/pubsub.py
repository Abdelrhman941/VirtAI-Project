"""
Redis Pub/Sub Broadcaster for real-time events.
Used primarily to notify WebSocket gateway nodes of state changes (e.g., session revocation).
"""

import json
from typing import Literal

from loguru import logger

from app.infrastructure.cache.redis_client import get_redis_or_none


async def publish_session_invalidation(user_id: str, family_id: str | Literal["all"]) -> None:
    """
    Broadcasts a session invalidation event to all WebSocket nodes.

    Args:
        user_id: The ID of the user whose session was invalidated.
        family_id: The specific session family ID, or "all" to invalidate all sessions for the user.
    """
    redis = get_redis_or_none()
    if not redis:
        logger.warning(
            f"[PubSub] Redis not available, cannot broadcast session invalidation | "
            f"user_id={user_id} | family_id={family_id}"
        )
        return

    channel = f"virtai:ws:events:{user_id}"
    payload = {
        "event": "session_invalidated",
        "user_id": user_id,
        "family_id": family_id,
    }

    try:
        subscribers = await redis.publish(channel, json.dumps(payload))
        logger.debug(
            f"[PubSub] Broadcast session invalidation | "
            f"user_id={user_id} | family_id={family_id} | reached={subscribers} nodes"
        )
    except Exception as e:
        logger.error(
            f"[PubSub] Failed to broadcast session invalidation | "
            f"user_id={user_id} | family_id={family_id} | error={e}"
        )

async def publish_doc_progress(user_id: str, session_id: str | None, document_id: str, stage: str, pct: int) -> None:
    """
    Broadcasts a document ingestion progress event.
    """
    redis = get_redis_or_none()
    if not redis:
        return

    channel = f"virtai:ws:events:{user_id}"
    payload = {
        "event": "doc_status",
        "user_id": user_id,
        "session_id": session_id,
        "data": {
            "document_id": document_id,
            "stage": stage,
            "progress_pct": pct
        }
    }

    try:
        await redis.publish(channel, json.dumps(payload))
    except Exception as e:
        logger.error(f"[PubSub] Failed to broadcast doc progress | document_id={document_id} | error={e}")
