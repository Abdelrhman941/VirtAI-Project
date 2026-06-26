"""add document_chunks composite index

Revision ID: 20260626_doc_chunk_idx
Revises: 20260625_add_last_message_at
Create Date: 2026-06-26 12:00:00.000000

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260626_doc_chunk_idx"
down_revision: Union[str, Sequence[str], None] = "20260625_add_last_message_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_chunks_active_doc_scope",
        "document_chunks",
        ["is_active", "document_id", "scope_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_chunks_active_doc_scope", table_name="document_chunks")
