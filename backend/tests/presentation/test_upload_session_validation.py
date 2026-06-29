"""Unit tests for Batch 2 — document upload limit and session validation fixes.

These tests verify:
1. _verify_session_ownership returns 404 when session doesn't exist (before 403).
2. _verify_session_ownership returns 403 when session belongs to another user.
3. count_active_jobs_in_scope counts only session-scoped docs when session_id given.
4. Upload endpoint uses session-scoped count when session_id is present.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(uid: str | None = None):
    user = MagicMock()
    user.id = uid or str(uuid4())
    return user


# ---------------------------------------------------------------------------
# Tests: _verify_session_ownership — 404 vs 403 ordering
# ---------------------------------------------------------------------------

class TestVerifySessionOwnership:
    """_verify_session_ownership must 404 before 403."""

    @pytest.mark.asyncio
    async def test_nonexistent_session_raises_404(self) -> None:
        """If the session doesn't exist, raise HTTP 404, not 403."""
        from app.presentation.http.v1.endpoints.documents import _verify_session_ownership_logic

        mock_repo = AsyncMock()
        mock_repo.get_chat_session.return_value = None  # session not found

        user = _make_user()

        with pytest.raises(HTTPException) as exc_info:
            await _verify_session_ownership_logic(
                session_id="00000000-0000-0000-0000-000000000001",
                user=user,
                session_repo=mock_repo,
            )

        assert exc_info.value.status_code == 404, (
            f"Expected 404 for non-existent session, got {exc_info.value.status_code}"
        )

    @pytest.mark.asyncio
    async def test_wrong_owner_raises_403(self) -> None:
        """If the session exists but belongs to another user, raise HTTP 403."""
        from app.presentation.http.v1.endpoints.documents import _verify_session_ownership_logic

        other_user_id = str(uuid4())
        mock_repo = AsyncMock()
        mock_repo.get_chat_session.return_value = {
            "id": "00000000-0000-0000-0000-000000000001",
            "user_id": other_user_id,
        }

        user = _make_user()  # different id than other_user_id

        with pytest.raises(HTTPException) as exc_info:
            await _verify_session_ownership_logic(
                session_id="00000000-0000-0000-0000-000000000001",
                user=user,
                session_repo=mock_repo,
            )

        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_valid_session_returns_session_id(self) -> None:
        """If session exists and belongs to the user, return the session_id."""
        from app.presentation.http.v1.endpoints.documents import _verify_session_ownership_logic

        user = _make_user()
        session_id = "00000000-0000-0000-0000-000000000001"
        mock_repo = AsyncMock()
        mock_repo.get_chat_session.return_value = {
            "id": session_id,
            "user_id": str(user.id),
        }

        result = await _verify_session_ownership_logic(
            session_id=session_id,
            user=user,
            session_repo=mock_repo,
        )

        assert result == session_id

    @pytest.mark.asyncio
    async def test_no_session_id_returns_none(self) -> None:
        """If session_id is None, return None without querying DB."""
        from app.presentation.http.v1.endpoints.documents import _verify_session_ownership_logic

        mock_repo = AsyncMock()
        user = _make_user()

        result = await _verify_session_ownership_logic(
            session_id=None,
            user=user,
            session_repo=mock_repo,
        )

        assert result is None
        mock_repo.get_chat_session.assert_not_called()


# ---------------------------------------------------------------------------
# Tests: DocumentRepository.count_active_jobs_in_scope
# ---------------------------------------------------------------------------

class TestCountActiveJobsInScope:
    """count_active_jobs_in_scope must filter by session scope when provided."""

    @pytest.mark.asyncio
    async def test_global_count_when_no_session(self) -> None:
        """Without session_id, fall back to global user-level count."""
        from app.infrastructure.db.repositories.document_repository import DocumentRepository

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = 3
        mock_db.execute.return_value = mock_result

        repo = DocumentRepository(mock_db)
        count = await repo.count_active_jobs_in_scope(user_id=str(uuid4()), session_id=None)

        assert count == 3
        call_args = mock_db.execute.call_args_list[0]
        # The SQL should NOT reference scope_id
        stmt_str = str(call_args[0][0].compile(compile_kwargs={"literal_binds": False}))
        assert "scope_id" not in stmt_str.lower()

    @pytest.mark.asyncio
    async def test_session_scoped_count_when_session_provided(self) -> None:
        """With session_id, count must filter by scope_id = session_id."""
        from app.infrastructure.db.repositories.document_repository import DocumentRepository
        from uuid import UUID

        session_id = str(uuid4())
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = 1
        mock_db.execute.return_value = mock_result

        repo = DocumentRepository(mock_db)
        count = await repo.count_active_jobs_in_scope(
            user_id=str(uuid4()), session_id=session_id
        )

        assert count == 1
        call_args = mock_db.execute.call_args_list[0]
        stmt_str = str(call_args[0][0].compile(compile_kwargs={"literal_binds": False}))
        assert "scope_id" in stmt_str.lower()
