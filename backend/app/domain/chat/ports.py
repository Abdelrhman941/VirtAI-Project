"""Chat domain ports — abstract interfaces for LLM and prompt building."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator, Callable
from typing import Any

from app.domain.chat.entities import (
    ChatMessageDict,
    ChatSessionDict,
    ConversationHistory,
    LLMChunk,
    LLMResult,
)


class ChatRepositoryPort(ABC):
    """Abstract interface for chat session and message persistence."""

    @abstractmethod
    async def create_chat_session(
        self, user_id: str, title: str = "New Chat", session_id: str | None = None
    ) -> ChatSessionDict: ...

    @abstractmethod
    async def get_chat_session(self, session_id: str) -> ChatSessionDict | None: ...

    @abstractmethod
    async def update_chat_session_title(
        self, session_id: str, title: str
    ) -> ChatSessionDict | None: ...

    @abstractmethod
    async def list_user_sessions(self, user_id: str, limit: int = 50) -> list[ChatSessionDict]: ...

    @abstractmethod
    async def delete_chat_session(self, session_id: str) -> bool: ...

    @abstractmethod
    async def save_message(
        self,
        session_id: str,
        role: str,
        content: str,
        input_type: str = "text",
        tts_cache_key: str | None = None,
        sources: list[dict[str, Any]] | None = None,
    ) -> ChatMessageDict: ...

    @abstractmethod
    async def get_session_messages(
        self, session_id: str, limit: int = 50
    ) -> list[ChatMessageDict]: ...

    @abstractmethod
    async def get_message_count(self, session_id: str) -> int: ...


class ChatContextCachePort(ABC):
    """Port for managing chat session context cache with concurrency safety."""

    @abstractmethod
    async def get_or_rebuild_context(self, session_id: str) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def push_message(
        self, session_id: str, role: str, content: str, extra: dict[str, Any] | None = None
    ) -> None:
        """Push a message to the context cache."""
        pass

    @abstractmethod
    async def invalidate(self, session_id: str) -> None:
        """Invalidate the cache for a session."""
        pass


class BaseLLMProvider(ABC):
    """Abstract LLM provider interface."""

    @abstractmethod
    async def stream(
        self,
        history: ConversationHistory,
        on_sentence: Callable[[str], None] | None = None,
        trace_id: str | None = None,
    ) -> AsyncGenerator[LLMChunk, None]:
        """
        Streams tokens from the LLM.
        Yields LLMChunk for each token.
        When a full sentence is detected → sets chunk.sentence.
        """
        yield NotImplemented

    @abstractmethod
    async def complete(
        self,
        history: ConversationHistory,
        response_format: dict[str, Any] | None = None,
    ) -> LLMResult:
        """Non-streaming completion (for simple cases)"""
        ...

    @abstractmethod
    async def is_available(self) -> bool:
        """Health check"""
        ...
