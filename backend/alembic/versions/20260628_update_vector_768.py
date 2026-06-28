"""dummy to fix reverted migration

Revision ID: 20260628_update_vector_768
Revises: 20260627_add_doc_indexes
Create Date: 2026-06-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260628_update_vector_768'
down_revision: Union[str, None] = '20260627_add_doc_indexes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass

def downgrade() -> None:
    pass
