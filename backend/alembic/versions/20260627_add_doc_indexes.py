"""add document indexes for cleanup

Revision ID: 20260627_add_doc_indexes
Revises: bda96c4448eb_document_ingestion_upgrade
Create Date: 2026-06-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260627_add_doc_indexes'
down_revision: Union[str, None] = '20260626_update_vector_1024'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Note: Creating indexes without CONCURRENTLY will briefly lock the table for writes.
    # This is acceptable here for initial setup and low-traffic environments.
    
    # 1. documents.session_id (represented by scope_id)
    # Adding a dedicated index since the existing composite is on (retrieval_scope, scope_id)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_documents_scope_id "
        "ON documents (scope_id)"
    )
    
    # 2. documents.status (already created in 001_initial_schema, but ensuring its presence)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_documents_status "
        "ON documents (status)"
    )


def downgrade() -> None:
    op.drop_index('ix_documents_scope_id', table_name='documents', if_exists=True)
    # Deliberately NOT dropping ix_documents_status here because it belongs to 001_initial_schema
