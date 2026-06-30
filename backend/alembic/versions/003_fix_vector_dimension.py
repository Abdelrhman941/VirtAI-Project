"""fix vector dimension from 1536 to 384 for FastEmbed BGE-small

Revision ID: 003
Revises: 002
Create Date: 2026-05-17 04:30:00.000000

"""

from collections.abc import Sequence
from typing import Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the HNSW index first (it depends on the vector column type)
    op.drop_index("ix_chunks_embedding_hnsw", table_name="document_chunks", postgresql_using="hnsw")

    # Alter the embedding column from Vector(1536) to Vector(384)
    # This requires dropping and recreating since pgvector dimension is part of the type
    op.execute("ALTER TABLE document_chunks DROP COLUMN IF EXISTS embedding")
    op.execute("ALTER TABLE document_chunks ADD COLUMN embedding vector(384)")

    # Recreate the HNSW index with the new dimension
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
    op.execute("ALTER TABLE document_chunks DROP COLUMN IF EXISTS embedding")
    op.execute("ALTER TABLE document_chunks ADD COLUMN embedding vector(1536)")
    op.create_index(
        "ix_chunks_embedding_hnsw",
        "document_chunks",
        ["embedding"],
        unique=False,
        postgresql_using="hnsw",
        postgresql_with={"m": 16, "ef_construction": 64},
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )
