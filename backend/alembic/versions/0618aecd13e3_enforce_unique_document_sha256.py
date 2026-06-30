"""enforce_unique_document_sha256

Revision ID: 0618aecd13e3
Revises: b3dac6ac35b3
Create Date: 2026-05-22 11:49:41.216316

"""

from collections.abc import Sequence
from typing import Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0618aecd13e3"
down_revision: Union[str, Sequence[str], None] = "b3dac6ac35b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Deduplicate documents based on (user_id, document_sha256), keeping the most recent upload
    op.execute("""
        DELETE FROM documents
        WHERE id IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (
                    PARTITION BY user_id, document_sha256
                    ORDER BY upload_date DESC
                ) as rnum
                FROM documents
                WHERE document_sha256 IS NOT NULL
            ) t WHERE t.rnum > 1
        )
    """)
    op.create_unique_constraint(
        "uq_user_document_sha256", "documents", ["user_id", "document_sha256"]
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("uq_user_document_sha256", "documents", type_="unique")
