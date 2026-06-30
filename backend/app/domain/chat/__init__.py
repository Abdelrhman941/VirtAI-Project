"""Chat subdomain — LLM interaction, conversation management, prompt policies."""

from app.domain.chat.entities import (
    ChatMessage,
    ConversationHistory,
    LLMChunk,
    LLMResult,
    MessageRole,
    PipelineEvent,
    PipelineEventType,
    ev,
)
from app.domain.chat.policies import build_conversation, get_system_prompt
from app.domain.chat.ports import BaseLLMProvider

__all__ = [
    # ── Entities ──────────
    "ChatMessage",
    "ConversationHistory",
    "LLMChunk",
    "LLMResult",
    "MessageRole",
    "PipelineEvent",
    "PipelineEventType",
    "ev",
    # ── Ports ──────────
    "BaseLLMProvider",
    # ── Factories ──────────
    "build_conversation",
    "get_system_prompt",
]
