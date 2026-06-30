"""refactor_unique_document_sha256

Revision ID: 0618aecd13e4
Revises: 0618aecd13e3
Create Date: 2026-05-23 00:00:00.000000

"""

from collections.abc import Sequence
from typing import Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0618aecd13e4"
down_revision: Union[str, Sequence[str], None] = "0618aecd13e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Deduplicate documents based on (user_id, scope_id, document_sha256)
    op.execute("""
        DELETE FROM documents
        WHERE id IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (
                    PARTITION BY user_id, scope_id, document_sha256
                    ORDER BY upload_date DESC
                ) as rnum
                FROM documents
                WHERE document_sha256 IS NOT NULL
            ) t WHERE t.rnum > 1
        )
    """)
    op.drop_constraint("uq_user_document_sha256", "documents", type_="unique")
    op.create_unique_constraint(
        "uq_user_scope_document_sha256", "documents", ["user_id", "scope_id", "document_sha256"]
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("uq_user_scope_document_sha256", "documents", type_="unique")
    op.create_unique_constraint(
        "uq_user_document_sha256", "documents", ["user_id", "document_sha256"]
    )
