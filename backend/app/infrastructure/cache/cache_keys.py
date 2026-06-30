"""
Redis key naming conventions — single source of truth.

All Redis keys used across the application are defined here.
This prevents key collisions and makes TTL/scope reasoning clear.

Key format: virtai:{namespace}:{identifier}

Namespaces:
    chat:ctx    — active chat context (last 50 messages per session)
    tts         — synthesised TTS audio cache
    llm         — LLM completion cache
    jwt         — JWT blacklist for invalidated tokens
    rate        — rate limiting counters
    ws          — WebSocket session metadata
"""

from __future__ import annotations

import hashlib
import re


def chat_context_key(session_id: str) -> str:
    """Redis list key for active chat context (last 50 messages)."""
    return f"virtai:chat:ctx:{session_id}"


def tts_cache_key(text: str, voice: str) -> str:
    """Redis string key for cached TTS audio bytes."""
    safe_voice = re.sub(r"[^a-z0-9-]+", "-", (voice or "default").strip().lower()).strip("-")
    digest = hashlib.sha256(text.encode()).hexdigest()[:32]
    return f"virtai:tts:cache:{safe_voice}:{digest}_pcm"


def llm_cache_key(prompt_hash: str) -> str:
    """Redis string key for cached LLM completions."""
    return f"virtai:llm:cache:{prompt_hash}"


def jwt_blacklist_key(jti: str) -> str:
    """Redis string key for blacklisted JWT token IDs."""
    return f"virtai:jwt:blacklist:{jti}"


def rate_limit_key(identifier: str, window: int) -> str:
    """
    Redis sorted-set key for sliding window rate limiting.

    Args:
        identifier: user_id or IP address
        window    : rate limit window in seconds (used to namespace windows)
    """
    return f"virtai:rate:{identifier}:{window}"


def ws_session_key(session_id: str) -> str:
    """Redis hash key for WebSocket session metadata."""
    return f"virtai:ws:session:{session_id}"


def auth_session_key(user_id: str) -> str:
    """Redis hash key for cached authenticated user profile."""
    return f"virtai:auth:session:{user_id}"


def token_validation_key(jti: str) -> str:
    """Redis string key for cached JWT validation status."""
    return f"virtai:auth:token:{jti}"


def auth_refresh_key(user_id: str, family_id: str) -> str:
    """Redis string key for the active refresh token in a session family."""
    return f"virtai:auth:refresh:{user_id}:{family_id}"


def auth_refresh_active_jti_key(user_id: str, family_id: str) -> str:
    """Redis string key for the active refresh JTI in a session family."""
    return f"virtai:auth:refresh:active-jti:{user_id}:{family_id}"


def auth_refresh_consumed_jti_key(jti: str) -> str:
    """Redis string key marking a rotated refresh JTI as consumed."""
    return f"virtai:auth:refresh:consumed:{jti}"


def auth_refresh_family_revoked_key(user_id: str, family_id: str) -> str:
    """Redis string key showing a refresh session family is revoked."""
    return f"virtai:auth:refresh:family-revoked:{user_id}:{family_id}"


def auth_refresh_user_families_key(user_id: str) -> str:
    """Redis set key containing all refresh family IDs known for a user."""
    return f"virtai:auth:refresh:families:{user_id}"


def auth_refresh_reuse_incident_key(user_id: str, jti: str) -> str:
    """Redis hash key recording refresh token reuse detection metadata."""
    return f"virtai:auth:refresh:reuse:{user_id}:{jti}"


def auth_refresh_rotation_lock_key(user_id: str, family_id: str) -> str:
    """Redis lock key serializing refresh rotation per session family."""
    return f"virtai:auth:refresh:lock:{user_id}:{family_id}"


def auth_refresh_family_meta_key(user_id: str, family_id: str) -> str:
    """Redis hash key for session family metadata."""
    return f"virtai:auth:refresh:meta:{user_id}:{family_id}"
