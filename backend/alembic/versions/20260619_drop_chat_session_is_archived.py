"""Drop unused chat session archive flag

Revision ID: 20260619_drop_is_archived
Revises: 0618aecd13e4
Create Date: 2026-06-19 04:45:00.000000

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260619_drop_is_archived"
down_revision: Union[str, Sequence[str], None] = "0618aecd13e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column("chat_sessions", "is_archived")


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column(
        "chat_sessions",
        sa.Column("is_archived", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.alter_column("chat_sessions", "is_archived", server_default=None)
