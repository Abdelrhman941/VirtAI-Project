"""add last_message_at to chat_sessions

Revision ID: 20260625_add_last_message_at
Revises: 20260623_visualization_cache
Create Date: 2026-06-25 14:42:00.000000

Phase 0 of the timestamp architecture fix.

Changes (strictly additive — no existing fields renamed or removed):
  - Add `last_message_at` column to `chat_sessions` (nullable TIMESTAMPTZ).
  - Backfill from MAX(messages.timestamp) per session, falling back to
    created_at for sessions that have no messages yet.
  - Add index on (user_id, last_message_at DESC) to support efficient
    recency-ordered session listing without touching the existing
    ix_chat_sessions_user_updated index.

Rollback (downgrade):
  - Drop the index.
  - Drop the column.
  Both are safe — no data is lost because this column is derived data.
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260625_add_last_message_at"
down_revision: Union[str, Sequence[str], None] = "b87cbd2c66e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Step 1: Add nullable column ───────────────────────────────────────────
    # Nullable so existing rows don't need a default value at the DDL level.
    # The backfill in Step 2 ensures every row gets a value before the index
    # is created.
    op.add_column(
        "chat_sessions",
        sa.Column(
            "last_message_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # ── Step 2: Backfill ──────────────────────────────────────────────────────
    # For every session that has at least one message, set last_message_at to
    # the MAX timestamp of that session's messages.
    # For sessions with no messages (empty sessions), fall back to created_at
    # so that the column is never NULL after this migration.
    #
    # Uses a single UPDATE … FROM … SELECT pattern (PostgreSQL syntax) for
    # efficiency — no row-by-row Python loop.
    op.execute(
        """
        UPDATE chat_sessions AS cs
        SET last_message_at = COALESCE(
            (
                SELECT MAX(m.timestamp)
                FROM messages m
                WHERE m.session_id = cs.id
            ),
            cs.created_at
        )
        """
    )

    # ── Step 3: Tighten to NOT NULL now that every row is populated ───────────
    op.alter_column("chat_sessions", "last_message_at", nullable=False)

    # ── Step 4: Add recency index ─────────────────────────────────────────────
    # Mirrors the pattern of the existing ix_chat_sessions_user_updated index
    # but targets last_message_at instead of updated_at.
    # The existing index is NOT dropped here (Phase 0 is additive-only).
    op.create_index(
        "ix_chat_sessions_user_last_message",
        "chat_sessions",
        ["user_id", sa.text("last_message_at DESC")],
    )


def downgrade() -> None:
    # Drop in reverse order: index first, then column.
    # Safe — last_message_at is derived data; dropping it loses no source-of-truth data.
    op.drop_index("ix_chat_sessions_user_last_message", table_name="chat_sessions")
    op.drop_column("chat_sessions", "last_message_at")
