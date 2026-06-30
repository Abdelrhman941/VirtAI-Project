"""document_ingestion_upgrade

Revision ID: bda96c4448eb
Revises: 003
Create Date: 2026-05-17 08:35:37.787444

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "bda96c4448eb"
down_revision: Union[str, Sequence[str], None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "documents",
        sa.Column("current_stage", sa.String(length=20), server_default="QUEUED", nullable=False),
    )
    op.add_column(
        "documents", sa.Column("progress_pct", sa.Integer(), server_default="0", nullable=False)
    )
    op.add_column("documents", sa.Column("error_message", sa.Text(), nullable=True))
    op.add_column(
        "documents", sa.Column("processed_chunks", sa.Integer(), server_default="0", nullable=False)
    )
    op.add_column(
        "documents", sa.Column("total_chunks", sa.Integer(), server_default="0", nullable=False)
    )
    op.add_column("documents", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("documents", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "documents",
        sa.Column("upload_source", sa.String(length=30), server_default="SETUP", nullable=False),
    )
    op.add_column("documents", sa.Column("document_sha256", sa.String(length=64), nullable=True))
    op.add_column(
        "documents", sa.Column("normalized_content_hash", sa.String(length=64), nullable=True)
    )
    op.add_column(
        "documents", sa.Column("file_size", sa.Integer(), server_default="0", nullable=False)
    )
    op.add_column(
        "documents", sa.Column("retry_count", sa.Integer(), server_default="0", nullable=False)
    )
    op.add_column("documents", sa.Column("queue_time_ms", sa.Integer(), nullable=True))
    op.add_column(
        "documents",
        sa.Column("retrieval_scope", sa.String(length=30), server_default="GLOBAL", nullable=False),
    )
    op.add_column("documents", sa.Column("scope_id", sa.UUID(), nullable=True))
    op.add_column(
        "documents",
        sa.Column("storage_key", sa.String(length=500), server_default="", nullable=False),
    )

    op.create_index("ix_documents_sha256", "documents", ["document_sha256"])
    op.create_index("ix_documents_scope", "documents", ["retrieval_scope", "scope_id"])
    op.create_index("ix_documents_active_stage", "documents", ["current_stage"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_documents_active_stage", table_name="documents")
    op.drop_index("ix_documents_scope", table_name="documents")
    op.drop_index("ix_documents_sha256", table_name="documents")

    op.drop_column("documents", "storage_key")
    op.drop_column("documents", "scope_id")
    op.drop_column("documents", "retrieval_scope")
    op.drop_column("documents", "queue_time_ms")
    op.drop_column("documents", "retry_count")
    op.drop_column("documents", "file_size")
    op.drop_column("documents", "normalized_content_hash")
    op.drop_column("documents", "document_sha256")
    op.drop_column("documents", "upload_source")
    op.drop_column("documents", "completed_at")
    op.drop_column("documents", "started_at")
    op.drop_column("documents", "total_chunks")
    op.drop_column("documents", "processed_chunks")
    op.drop_column("documents", "error_message")
    op.drop_column("documents", "progress_pct")
    op.drop_column("documents", "current_stage")
