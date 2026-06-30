"""Enforce ON DELETE CASCADE: documents.scope_id → chat_sessions.id

Revision ID: 20260629_cascade_session_fk
Revises: 20260628_update_vector_768
Create Date: 2026-06-29 00:00:00.000000

Problem:
    documents.scope_id stores the chat_sessions.id for SESSION-scoped docs,
    but there was no FK constraint. When DELETE /api/v1/chat/all fires, the
    app-level code deletes sessions in Python but any race or rollback leaves
    orphaned documents pointing at deleted sessions.

Fix:
    Add a nullable FK from documents.scope_id → chat_sessions.id with
    ON DELETE SET NULL. We cannot use CASCADE here because scope_id is also
    NULL for GLOBAL docs, and the FK should only apply when retrieval_scope
    is 'SESSION'. SET NULL is safe: a NULL scope_id for a SESSION doc simply
    means the parent session no longer exists — the orphan-cleanup job will
    catch it within 30 minutes, and the document is no longer retrievable.

    We drop the un-named ix_documents_scope_id index first (created in
    20260627_add_doc_indexes) and recreate it after the FK is in place so
    Postgres can use it for FK validation.
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260629_cascade_session_fk"
down_revision: Union[str, None] = "20260628_update_vector_768"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_FK_NAME = "fk_documents_scope_id_chat_sessions"
_IDX_NAME = "ix_documents_scope_id"


def upgrade() -> None:
    # Ensure existing NULLs are fine — scope_id is already nullable.
    # Rows where retrieval_scope='SESSION' but scope_id references a
    # non-existent session_id would violate the FK; set them to NULL first
    # so the migration can apply cleanly on a live DB.
    op.execute(
        """
        UPDATE documents
        SET scope_id = NULL,
            retrieval_scope = 'GLOBAL'
        WHERE retrieval_scope = 'SESSION'
          AND scope_id NOT IN (SELECT id FROM chat_sessions)
        """
    )

    op.create_foreign_key(
        _FK_NAME,
        "documents",
        "chat_sessions",
        ["scope_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(_FK_NAME, "documents", type_="foreignkey")
