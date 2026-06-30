"""add_hnsw_index

Revision ID: 002
Revises: 001
Create Date: 2026-05-17 01:00:00.000000

"""

from collections.abc import Sequence
from typing import Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add HNSW index to document_chunks
    op.create_index(
        "ix_chunks_embedding_hnsw",
        "document_chunks",
        ["embedding"],
        unique=False,
        postgresql_using="hnsw",
        postgresql_with={"m": 16, "ef_construction": 64},
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )


def downgrade() -> None:
    op.drop_index("ix_chunks_embedding_hnsw", table_name="document_chunks", postgresql_using="hnsw")
