"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-05-17 00:00:00.000000

"""

from collections.abc import Sequence
from typing import Union

import pgvector.sqlalchemy
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # We create the vector extension here since database.py no longer creates tables
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("provider", sa.String(length=20), nullable=False),
        sa.Column("google_id", sa.String(length=255), nullable=True),
        sa.Column("setup_complete", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("refresh_token_version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_google_id"), "users", ["google_id"], unique=True)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    op.create_table(
        "avatars",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("avatar_url", sa.String(length=500), nullable=False),
        sa.Column("voice_id", sa.String(length=50), nullable=False),
        sa.Column("language", sa.String(length=5), nullable=False),
        sa.Column("persona_prompt", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )

    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_archived", sa.Boolean(), nullable=False),
        sa.Column("message_count", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_chat_sessions_user_updated", "chat_sessions", ["user_id", "updated_at"], unique=False
    )

    op.create_table(
        "documents",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("file_type", sa.String(length=20), nullable=False),
        sa.Column("upload_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("chunk_count", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_documents_status", "documents", ["status"], unique=False)
    op.create_index(
        "ix_documents_user_upload", "documents", ["user_id", "upload_date"], unique=False
    )

    op.create_table(
        "document_chunks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("document_id", sa.UUID(), nullable=False),
        sa.Column("chunk_text", sa.Text(), nullable=False),
        sa.Column("chunk_order", sa.Integer(), nullable=False),
        sa.Column("embedding", pgvector.sqlalchemy.Vector(1536), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_chunks_document_order", "document_chunks", ["document_id", "chunk_order"], unique=False
    )

    op.create_table(
        "messages",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("input_type", sa.String(length=20), nullable=False),
        sa.Column("tts_cache_key", sa.String(length=255), nullable=True),
        sa.Column("sources", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["chat_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_messages_session_timestamp", "messages", ["session_id", "timestamp"], unique=False
    )
    op.create_index("ix_messages_tts_cache_key", "messages", ["tts_cache_key"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_messages_tts_cache_key", table_name="messages")
    op.drop_index("ix_messages_session_timestamp", table_name="messages")
    op.drop_table("messages")
    op.drop_index("ix_chunks_document_order", table_name="document_chunks")
    op.drop_table("document_chunks")
    op.drop_index("ix_documents_user_upload", table_name="documents")
    op.drop_index("ix_documents_status", table_name="documents")
    op.drop_table("documents")
    op.drop_index("ix_chat_sessions_user_updated", table_name="chat_sessions")
    op.drop_table("chat_sessions")
    op.drop_table("avatars")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_index(op.f("ix_users_google_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
