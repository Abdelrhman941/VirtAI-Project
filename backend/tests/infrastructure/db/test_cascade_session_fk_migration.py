"""Unit tests for Batch 1 — session FK cascade & migration content.

These tests verify:
1. The migration file exists and has the expected constraint name.
2. The Document ORM model declares a FK on scope_id targeting chat_sessions.id.
3. The migration's upgrade() SQL first NULLs orphaned scope_ids (no IntegrityError
   when orphans exist).
4. The downgrade() removes only the FK constraint (not the column).
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path
from types import ModuleType
from unittest.mock import MagicMock, patch, call


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

MIGRATION_PATH = (
    Path(__file__).resolve().parents[3]
    / "alembic"
    / "versions"
    / "20260629_cascade_session_fk.py"
)


def _load_migration() -> ModuleType:
    spec = importlib.util.spec_from_file_location(
        "migration_cascade_session_fk", MIGRATION_PATH
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestMigrationFile:
    def test_migration_file_exists(self) -> None:
        assert MIGRATION_PATH.exists(), (
            f"Migration file not found at {MIGRATION_PATH}. "
            "Run the batch task before running tests."
        )

    def test_revision_and_down_revision(self) -> None:
        mod = _load_migration()
        assert mod.revision == "20260629_cascade_session_fk"
        assert mod.down_revision == "20260628_update_vector_768"

    def test_fk_name_constant(self) -> None:
        mod = _load_migration()
        assert mod._FK_NAME == "fk_documents_scope_id_chat_sessions"

    def test_upgrade_executes_orphan_cleanup_sql(self) -> None:
        """upgrade() must emit a SQL statement that NULLs orphaned scope_ids
        before creating the FK, otherwise the migration would fail on a dirty DB."""
        mod = _load_migration()
        mock_op = MagicMock()

        with patch.object(mod, "op", mock_op):
            mod.upgrade()

        execute_calls = mock_op.execute.call_args_list
        assert len(execute_calls) >= 1, "upgrade() must call op.execute() at least once"
        first_sql: str = execute_calls[0][0][0]
        assert "UPDATE documents" in first_sql
        assert "scope_id = NULL" in first_sql
        assert "chat_sessions" in first_sql

    def test_upgrade_creates_fk(self) -> None:
        mod = _load_migration()
        mock_op = MagicMock()

        with patch.object(mod, "op", mock_op):
            mod.upgrade()

        mock_op.create_foreign_key.assert_called_once_with(
            "fk_documents_scope_id_chat_sessions",
            "documents",
            "chat_sessions",
            ["scope_id"],
            ["id"],
            ondelete="SET NULL",
        )

    def test_downgrade_drops_only_fk(self) -> None:
        mod = _load_migration()
        mock_op = MagicMock()

        with patch.object(mod, "op", mock_op):
            mod.downgrade()

        mock_op.drop_constraint.assert_called_once_with(
            "fk_documents_scope_id_chat_sessions",
            "documents",
            type_="foreignkey",
        )
        mock_op.drop_column.assert_not_called()


class TestDocumentModelFK:
    def test_scope_id_has_fk_to_chat_sessions(self) -> None:
        """The Document ORM model's scope_id column must carry a FK pointing at
        chat_sessions.id so SQLAlchemy validation and Alembic autogenerate both
        see the constraint."""
        from sqlalchemy import inspect as sa_inspect
        from sqlalchemy import create_engine
        from sqlalchemy.pool import StaticPool

        # Use a lightweight in-memory sqlite engine just for inspection — we
        # don't need to create the tables, only inspect the metadata.
        from app.infrastructure.db.models import Document

        table = Document.__table__
        fk_cols = {
            fk.column.table.name + "." + fk.column.name
            for fk in table.foreign_keys
            if fk.parent.name == "scope_id"
        }
        assert "chat_sessions.id" in fk_cols, (
            "Document.scope_id must have a FK to chat_sessions.id. "
            f"Found: {fk_cols!r}"
        )

    def test_scope_id_fk_ondelete_set_null(self) -> None:
        from app.infrastructure.db.models import Document

        table = Document.__table__
        for fk in table.foreign_keys:
            if fk.parent.name == "scope_id":
                assert fk.ondelete == "SET NULL", (
                    f"Expected ondelete='SET NULL', got {fk.ondelete!r}"
                )
                break
        else:
            raise AssertionError("FK on scope_id not found")
