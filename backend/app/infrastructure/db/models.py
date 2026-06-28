import uuid
from datetime import datetime, timezone
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.infrastructure.db.database import Base
from app.shared.config import get_settings

settings = get_settings()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    username: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider: Mapped[str] = mapped_column(String(20), default="local")
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    setup_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    refresh_token_version: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), onupdate=utc_now
    )


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), default="New Chat")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), onupdate=utc_now
    )
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    # Phase 1: canonical timestamp for the most-recent message in this session.
    # Stamped by save_message() on every persist; NOT touched by title renames.
    # Backfilled from messages.timestamp by migration 20260625_add_last_message_at.
    last_message_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=func.now())

    __table_args__ = (
        # Legacy index kept; still referenced by update_chat_session_title path.
        Index("ix_chat_sessions_user_updated", "user_id", "updated_at"),
        # New canonical recency index (created by Phase 0 migration).
        Index("ix_chat_sessions_user_last_message", "user_id", "last_message_at"),
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    input_type: Mapped[str] = mapped_column(String(20), default="text")
    tts_cache_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sources: Mapped[list | dict] = mapped_column(JSONB, default=list)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=func.now())

    __table_args__ = (
        Index("ix_messages_session_timestamp", "session_id", "timestamp"),
        Index("ix_messages_tts_cache_key", "tts_cache_key"),
    )


class Avatar(Base):
    __tablename__ = "avatars"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    avatar_url: Mapped[str] = mapped_column(String(500), default="")
    voice_id: Mapped[str] = mapped_column(String(50), default="aria")
    language: Mapped[str] = mapped_column(String(5), default="en")
    persona_prompt: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, server_default=func.now(), onupdate=utc_now
    )


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)
    upload_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=func.now())
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="processing")

    current_stage: Mapped[str] = mapped_column(String(20), default="QUEUED")
    progress_pct: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    processed_chunks: Mapped[int] = mapped_column(Integer, default=0)
    total_chunks: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    upload_source: Mapped[str] = mapped_column(String(30), default="SETUP")
    document_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    retrieval_scope: Mapped[str] = mapped_column(String(30), default="GLOBAL")
    scope_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    storage_key: Mapped[str] = mapped_column(String(500), default="")

    __table_args__ = (
        Index("ix_documents_user_upload", "user_id", "upload_date"),
        Index("ix_documents_status", "status"),
        Index("ix_documents_sha256", "document_sha256"),
        Index("ix_documents_scope", "retrieval_scope", "scope_id"),
        Index("ix_documents_active_stage", "current_stage"),
        UniqueConstraint(
            "user_id", "scope_id", "document_sha256", name="uq_user_scope_document_sha256"
        ),
    )


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_order: Mapped[int] = mapped_column(Integer, nullable=False)
    embedding: Mapped[Any | None] = mapped_column(
        Vector(settings.EMBEDDING_DIMENSION), nullable=True
    )
    chunk_metadata: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=func.now())
    chunk_version: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    retrieval_scope: Mapped[str] = mapped_column(String(30), default="GLOBAL")
    scope_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    __table_args__ = (
        Index("ix_chunks_document_order", "document_id", "chunk_order"),
        Index(
            "ix_chunks_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
        Index("ix_chunks_active_doc_scope", "is_active", "document_id", "scope_id"),
        UniqueConstraint(
            "document_id", "chunk_order", "chunk_version", name="uq_chunk_order_version"
        ),
        Index("ix_chunks_active", "document_id", "is_active"),
        Index("ix_chunks_version", "document_id", "chunk_version"),
        Index(
            "ix_chunks_text_gin", text("to_tsvector('english', chunk_text)"), postgresql_using="gin"
        ),
    )


class SummaryCache(Base):
    __tablename__ = "summary_cache"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=func.now())


class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=func.now())

    __table_args__ = (
        Index("ix_quizzes_document_id", "document_id"),
        Index("ix_quizzes_user_id", "user_id"),
    )


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[list | dict] = mapped_column(JSONB, default=list)
    correct_option_index: Mapped[int] = mapped_column(Integer, nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    citations: Mapped[list | dict] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=func.now())

    __table_args__ = (
        Index("ix_quiz_questions_quiz_id", "quiz_id"),
    )


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quiz_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=func.now())

    __table_args__ = (
        Index("ix_quiz_attempts_quiz_id", "quiz_id"),
        Index("ix_quiz_attempts_user_id", "user_id"),
    )

    answers: Mapped[list["QuizAttemptAnswer"]] = relationship(back_populates="attempt", cascade="all, delete-orphan")


class QuizAttemptAnswer(Base):
    __tablename__ = "quiz_attempt_answers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quiz_attempts.id", ondelete="CASCADE"), nullable=False
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False
    )
    selected_option: Mapped[int] = mapped_column(Integer, nullable=True)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    time_spent_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    hesitation_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=func.now())

    __table_args__ = (
        Index("ix_quiz_attempt_answers_attempt_id", "attempt_id"),
        Index("ix_quiz_attempt_answers_question_id", "question_id"),
    )

    attempt: Mapped["QuizAttempt"] = relationship(back_populates="answers")


class DiagramCache(Base):
    __tablename__ = "diagram_cache"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    mermaid_code: Mapped[str] = mapped_column(Text, nullable=False)
    citations: Mapped[list | dict] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=func.now())


class VisualizationCache(Base):
    __tablename__ = "visualization_cache"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    unavailable: Mapped[bool] = mapped_column(Boolean, default=False)
    reason: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, server_default=func.now())
