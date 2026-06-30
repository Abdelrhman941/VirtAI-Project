"""Chat domain entities — pure data classes with no external dependencies."""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, TypedDict

_logger = logging.getLogger(__name__)


class ChatMessageDict(TypedDict):
    id: str
    session_id: str
    role: str
    content: str
    created_at: str


class ChatSessionDict(TypedDict):
    id: str
    user_id: str
    title: str
    created_at: str
    last_message_at: str | None


# ── Message Roles ─────────────────────────────────────────────────────────────
class MessageRole(str, Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"


# ── Data Classes ──────────────────────────────────────────────────────────────
@dataclass
class ChatMessage:
    """A single message in the conversation history"""

    role: MessageRole
    content: str

    def to_dict(self) -> dict[str, str]:
        return {
            "role": self.role.value,
            "content": self.content,
        }


@dataclass
class LLMChunk:
    """A single streaming chunk from the LLM"""

    token: str  # the token text
    is_done: bool = False  # True = stream finished
    sentence: str | None = None  # set when a full sentence is ready


@dataclass
class LLMResult:
    """Full result after streaming is complete"""

    full_text: str
    sentences: list[str] = field(default_factory=list)
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    model: str = ""
    duration_ms: float = 0.0

    @property
    def total_chars(self) -> int:
        return len(self.full_text)


@dataclass
class ConversationHistory:
    """
    Manages conversation history with automatic trimming.
    Keeps the system prompt always at index 0.
    """

    system_prompt: str
    max_messages: int = 10  # max user+assistant pairs to keep (sliding window)
    max_tokens: int = 4096  # safe token limit threshold
    _messages: list[ChatMessage] = field(default_factory=list)
    sanitizer: Callable[[str], str] | None = None
    _tokenizer: Any = field(init=False, default=None)
    _tokenizer_failed: bool = field(init=False, default=False)

    def __post_init__(self) -> None:
        try:
            import tiktoken

            self._tokenizer = tiktoken.get_encoding("cl100k_base")
        except ImportError:
            self._tokenizer_failed = True
            _logger.warning("tiktoken not installed, falling back to char heuristic")

    def add_user_message(self, content: str) -> None:
        """Add a user message, applying the configured sanitizer if present.

        If no sanitizer was injected, fall back to the existing behavior and
        import `PromptSanitizer` lazily for backwards compatibility.
        """
        if self.sanitizer is not None:
            sanitized_content = self.sanitizer(content)
        else:
            from app.shared.security.prompt_sanitizer import PromptSanitizer

            sanitized_content = PromptSanitizer.sanitize(content)

        self._messages.append(ChatMessage(role=MessageRole.USER, content=sanitized_content))
        self._trim()

    def add_assistant_message(self, content: str) -> None:
        self._messages.append(ChatMessage(role=MessageRole.ASSISTANT, content=content))
        self._trim()

    def get_messages(self) -> list[dict[str, str]]:
        """Returns messages formatted for the API"""
        system = ChatMessage(role=MessageRole.SYSTEM, content=self.system_prompt)
        return [system.to_dict()] + [m.to_dict() for m in self._messages]

    def clear(self) -> None:
        """Clears history but keeps system prompt"""
        self._messages.clear()

    def _trim(self) -> None:
        """
        Keeps only the last N message pairs, and enforces a maximum token limit.
        Always removes in pairs (user + assistant) to keep history consistent.
        Uses 1 token ≈ 4 characters heuristic.
        """
        max_raw = self.max_messages * 2  # pairs → individual messages
        if len(self._messages) > max_raw:
            trimmed = len(self._messages) - max_raw
            self._messages = self._messages[-max_raw:]
            _logger.warning(
                "History trimmed by pair count | removed=%d messages | remaining=%d | max_pairs=%d",
                trimmed,
                len(self._messages),
                self.max_messages,
            )

        if self._tokenizer:
            system_tokens = len(self._tokenizer.encode(self.system_prompt, disallowed_special=()))
            message_tokens = [
                len(self._tokenizer.encode(m.content, disallowed_special=()))
                for m in self._messages
            ]
            estimated_tokens = system_tokens + sum(message_tokens)
        else:
            estimated_tokens = (
                len(self.system_prompt) + sum(len(m.content) for m in self._messages)
            ) // 4

        while len(self._messages) >= 2 and estimated_tokens > self.max_tokens:
            if self._tokenizer:
                dropped_tokens = message_tokens[0] + message_tokens[1]
                message_tokens = message_tokens[2:]
                estimated_tokens -= dropped_tokens
            else:
                dropped_chars = len(self._messages[0].content) + len(self._messages[1].content)
                estimated_tokens -= dropped_chars // 4

            self._messages = self._messages[2:]
            _logger.warning(
                "History trimmed by token budget | est_tokens=%d | max=%d | remaining=%d",
                estimated_tokens,
                self.max_tokens,
                len(self._messages),
            )

    def get_estimated_tokens(self) -> int:
        """Calculates the current estimated token count using the tokenizer or heuristic fallback."""
        if self._tokenizer:
            system_tokens = len(self._tokenizer.encode(self.system_prompt, disallowed_special=()))
            message_tokens = sum(
                len(self._tokenizer.encode(m.content, disallowed_special=()))
                for m in self._messages
            )
            return system_tokens + message_tokens
        return (len(self.system_prompt) + sum(len(m.content) for m in self._messages)) // 4

    @property
    def message_count(self) -> int:
        return len(self._messages)

    @property
    def is_empty(self) -> bool:
        return len(self._messages) == 0


# ── Pipeline Events ───────────────────────────────────────────────────────────
class PipelineEventType(Enum):
    # ── Status ────────────────────────────────────────────────────────────────
    LISTENING = auto()  # mic is active
    PROCESSING = auto()  # ASR running
    THINKING = auto()  # LLM running
    SPEAKING = auto()  # TTS running
    IDLE = auto()  # done

    # ── ASR ───────────────────────────────────────────────────────────────────
    TRANSCRIPT = auto()  # ASR result ready

    # ── LLM ───────────────────────────────────────────────────────────────────
    LLM_TOKEN = auto()  # single token
    LLM_SENTENCE = auto()  # full sentence ready → triggers TTS
    LLM_DONE = auto()  # full response done

    # ── TTS ───────────────────────────────────────────────────────────────────
    TTS_VISEMES = auto()  # viseme events for a sentence
    TTS_AUDIO = auto()  # audio chunk
    TTS_DONE = auto()  # sentence TTS done

    # ── Errors ────────────────────────────────────────────────────────────────
    ERROR = auto()
    WARNING = auto()  # non-fatal warning

    # ── Control ───────────────────────────────────────────────────────────────
    ABORT = auto()  # stop everything
    HEARTBEAT = auto()  # keepalive
    CLEANUP = auto()  # session cleanup


@dataclass
class PipelineEvent:
    type: PipelineEventType
    data: dict[str, Any] = field(default_factory=dict)
    session_id: str | None = None  # for tracking
    trace_id: str | None = None  # for distributed tracing


def ev(
    event_type: PipelineEventType,
    session_id: str | None = None,
    trace_id: str | None = None,
    **kwargs: Any,
) -> PipelineEvent:
    """Shorthand to create a PipelineEvent."""
    return PipelineEvent(type=event_type, data=kwargs, session_id=session_id, trace_id=trace_id)
