from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Protocol, TypedDict
from uuid import UUID, uuid4


class DocumentStatusDict(TypedDict):
    id: str
    filename: str
    status: str
    current_stage: str
    progress_pct: int
    processed_chunks: int
    total_chunks: int
    started_at: str | None
    completed_at: str | None
    upload_source: str | None
    error_message: str | None


class Document(Protocol):
    id: UUID | None
    user_id: UUID
    filename: str
    file_type: str
    upload_date: datetime
    chunk_count: int
    status: str  # processing, ready, failed
    retrieval_scope: str
    scope_id: UUID | None


@dataclass
class DocumentChunk:
    id: UUID | None
    document_id: UUID
    chunk_text: str
    chunk_order: int
    embedding: list[float] | None
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime | None = None
    chunk_version: int = 1
    is_active: bool = True
    retrieval_scope: str = "GLOBAL"
    scope_id: UUID | None = None


@dataclass
class IndexableChunk:
    chunk_id: str | int
    chunk_text: str
    chunk_metadata: dict[str, Any] | None = None


class AgentAction(str, Enum):
    RETRIEVE = "retrieve"
    ANSWER = "answer"
    SUMMARIZE = "summarize"
    QUIZ = "quiz"
    SEARCH = "search"
    UNKNOWN = "unknown"


@dataclass
class AgentInput:
    query: str
    project_id: int
    input_id: str = field(default_factory=lambda: str(uuid4()))
    action: AgentAction = AgentAction.ANSWER
    limit: int = 5
    stream: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class AgentOutput:
    input_id: str
    agent_name: str
    output_id: str = field(default_factory=lambda: str(uuid4()))
    success: bool = True
    result: Any = None
    stream_generator: Any = None
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class AgentTrace:
    input_id: str
    query: str
    project_id: int
    trace_id: str = field(default_factory=lambda: str(uuid4()))
    steps: list[AgentOutput] = field(default_factory=list)
    final_answer: Any = None
    stream_generator: Any = None
    success: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)

    def add_step(self, output: AgentOutput) -> None:
        self.steps.append(output)

    def last_result(self) -> Any:
        if self.steps:
            return self.steps[-1].result
        return None


@dataclass
class MemoryEntry:
    session_id: str
    role: str  # "user" | "assistant"
    content: str
    entry_id: str = field(default_factory=lambda: str(uuid4()))
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class RetrievedDocument:
    text: str
    score: float
    metadata: dict[str, Any] = field(default_factory=dict)
    id: str | None = None

    @property
    def chunk_text(self) -> str:
        """Compatibility alias for components that operate on DocumentChunk-like objects."""
        return self.text


class RetrievalStatus(str, Enum):
    SUCCESS = "success"
    LOW_CONFIDENCE = "low_confidence"
    NO_RESULTS = "no_results"
    DEGRADED = "degraded"
    FAILED = "failed"


@dataclass
class RetrievalResult:
    status: RetrievalStatus
    documents: list[RetrievedDocument] = field(default_factory=list)
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
