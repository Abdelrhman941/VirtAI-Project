"""fix_duplicate_sha_constraints

Revision ID: b87cbd2c66e0
Revises: 20260623_visualization_cache
Create Date: 2026-06-24 05:26:01.451985

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b87cbd2c66e0'
down_revision: Union[str, Sequence[str], None] = '20260623_visualization_cache'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
