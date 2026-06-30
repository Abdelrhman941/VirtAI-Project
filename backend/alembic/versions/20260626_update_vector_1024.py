"""update vector dimension to 1024

Revision ID: 20260626_update_vector_1024
Revises: 20260626_doc_chunk_idx
Create Date: 2026-06-26 17:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

revision = '20260626_update_vector_1024'
down_revision = '20260626_doc_chunk_idx'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Drop index depending on the column
    op.execute("DROP INDEX IF EXISTS ix_chunks_embedding_hnsw")
    # Truncate tables since we can't cast 384d vectors to 1024d
    op.execute("TRUNCATE TABLE document_chunks CASCADE")
    op.execute("TRUNCATE TABLE documents CASCADE")
    # Alter column type
    op.execute("ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector(1024)")
    # Recreate index
    op.execute("""
        CREATE INDEX ix_chunks_embedding_hnsw ON document_chunks USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)

def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_chunks_embedding_hnsw")
    op.execute("ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector(384)")
    op.execute("""
        CREATE INDEX ix_chunks_embedding_hnsw ON document_chunks USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)
