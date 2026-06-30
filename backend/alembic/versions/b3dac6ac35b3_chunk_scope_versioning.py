"""chunk_scope_versioning

Revision ID: b3dac6ac35b3
Revises: bda96c4448eb
Create Date: 2026-05-17 08:35:51.526664

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b3dac6ac35b3"
down_revision: Union[str, Sequence[str], None] = "bda96c4448eb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "document_chunks",
        sa.Column("chunk_version", sa.Integer(), server_default="1", nullable=False),
    )
    op.add_column(
        "document_chunks",
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
    )
    op.add_column(
        "document_chunks",
        sa.Column("retrieval_scope", sa.String(length=30), server_default="GLOBAL", nullable=False),
    )
    op.add_column("document_chunks", sa.Column("scope_id", sa.UUID(), nullable=True))

    op.create_unique_constraint(
        "uq_chunk_order_version", "document_chunks", ["document_id", "chunk_order", "chunk_version"]
    )
    op.create_index("ix_chunks_active", "document_chunks", ["document_id", "is_active"])
    op.create_index("ix_chunks_version", "document_chunks", ["document_id", "chunk_version"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_chunks_version", table_name="document_chunks")
    op.drop_index("ix_chunks_active", table_name="document_chunks")
    op.drop_constraint("uq_chunk_order_version", "document_chunks", type_="unique")

    op.drop_column("document_chunks", "scope_id")
    op.drop_column("document_chunks", "retrieval_scope")
    op.drop_column("document_chunks", "is_active")
    op.drop_column("document_chunks", "chunk_version")
