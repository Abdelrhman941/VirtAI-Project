"""remove legacy rag projects

Revision ID: 20260621_remove_legacy_rag
Revises: 20260619_drop_is_archived
Create Date: 2026-06-21 06:49:42.000000

"""
from collections.abc import Sequence
from typing import Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260621_remove_legacy_rag"
down_revision: Union[str, Sequence[str], None] = "20260619_drop_is_archived"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("DROP TABLE IF EXISTS data_chunks CASCADE;")

    op.execute("DROP TABLE IF EXISTS conversations CASCADE;")

    op.execute("DROP TABLE IF EXISTS assets CASCADE;")

    op.execute("DROP TABLE IF EXISTS projects CASCADE;")

    op.execute("DROP TABLE IF EXISTS episodic_memories CASCADE;")


def downgrade() -> None:
    """Downgrade schema."""
    pass
