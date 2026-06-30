from collections.abc import Awaitable, Callable
from contextlib import suppress
from typing import Any

from loguru import logger

from app.domain.chat.entities import ChatMessageDict
from app.domain.chat.ports import ChatContextCachePort


class TurnPersistenceManager:
    def __init__(
        self,
        persist_turn: (
            Callable[[str, str, str, str, str | None, str | None], Awaitable[ChatMessageDict | None]] | None
        ),
        context_cache: ChatContextCachePort | None,
    ):
        self._persist_turn = persist_turn
        self._context_cache = context_cache

    async def persist_user_input(
        self, session_id: str, text: str, trace_id: str | None, message_id: str | None = None
    ) -> ChatMessageDict | None:
        """Persist user message. Returns the saved ChatMessageDict (with
        canonical timestamp) so the caller can forward it to WS events.
        Returns None if persistence is disabled or fails.
        """
        saved: ChatMessageDict | None = None
        try:
            if self._persist_turn:
                saved = await self._persist_turn(session_id, "user", text, "text", None, message_id)
        except Exception as e:
            logger.warning(f"[Pipeline] Failed to persist user message: {e} | trace_id={trace_id}")

        if self._context_cache:
            with suppress(Exception):
                await self._context_cache.push_message(session_id, "user", text)

        return saved

    async def rebuild_history_if_needed(self, session_id: str, history: Any) -> None:
        if history.is_empty and self._context_cache:
            ctx_messages = await self._context_cache.get_or_rebuild_context(session_id)
            for msg in ctx_messages[:-1]:
                if msg["role"] == "user":
                    history.add_user_message(msg["content"])
                elif msg["role"] == "assistant":
                    history.add_assistant_message(msg["content"])

    async def persist_assistant_output(
        self, session_id: str, text: str, tts_key: str | None, trace_id: str | None, message_id: str | None = None
    ) -> ChatMessageDict | None:
        """Persist assistant message. Returns the saved ChatMessageDict (with
        canonical timestamp) so the caller can forward it to WS events.
        Returns None if persistence is disabled or fails.
        """
        saved: ChatMessageDict | None = None
        try:
            if self._persist_turn:
                saved = await self._persist_turn(session_id, "assistant", text, "text", tts_key, message_id)
        except Exception as e:
            logger.warning(
                f"[Pipeline] Failed to persist assistant message: {e} | trace_id={trace_id}"
            )

        if self._context_cache:
            with suppress(Exception):
                await self._context_cache.push_message(
                    session_id,
                    "assistant",
                    text,
                    extra={"tts_cache_key": tts_key} if tts_key else None,
                )

        return saved
