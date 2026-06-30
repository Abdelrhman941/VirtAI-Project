"""
Tests for SessionManager persistence logic.

Updated to match the current architecture where SessionManager uses
an injected chat_repository_factory (not module-level functions).
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from uuid import uuid4

import pytest

from app.application.chat.session_manager import SessionManager


def _make_manager(get_session=None, create_session=None) -> SessionManager:
    """Build a SessionManager with a fake repository factory."""

    from app.domain.chat.ports import ChatRepositoryPort

    class FakeRepo(ChatRepositoryPort):
        async def create_chat_session(
            self, user_id: str, title: str = "New Chat", session_id: str | None = None
        ) -> dict:
            if create_session:
                return await create_session(user_id=user_id, title=title, session_id=session_id)
            return {"id": session_id}

        async def get_chat_session(self, session_id: str) -> dict | None:
            if get_session:
                return await get_session(session_id)
            return None

        async def list_user_sessions(self, user_id: str, limit: int = 50) -> list[dict]:
            return []

        async def delete_chat_session(self, session_id: str) -> bool:
            return True

        async def update_chat_session_title(self, session_id: str, title: str) -> bool:
            return True

        async def save_message(
            self,
            session_id: str,
            role: str,
            content: str,
            input_type: str = "text",
            tts_cache_key: str | None = None,
            sources: list[dict] | None = None,
        ) -> dict:
            return {}

        async def get_session_messages(self, session_id: str, limit: int = 50) -> list[dict]:
            return []

        async def get_message_count(self, session_id: str) -> int:
            return 0

    class FakeSession:
        pass

    @asynccontextmanager
    async def factory():
        yield FakeRepo()

    manager = SessionManager(
        chat_repository_factory=factory,
        session_timeout_sec=300,
        session_cleanup_interval=60,
    )
    return manager


@pytest.mark.asyncio
async def test_create_session_reuses_persisted_session_without_creating_new_doc() -> None:
    created_calls = 0
    user_id = str(uuid4())
    session_id = str(uuid4())

    async def _get_chat_session(_session_id: str):
        return {"id": session_id, "user_id": user_id, "title": "Persisted"}

    async def _create_chat_session(**kwargs):
        nonlocal created_calls
        created_calls += 1
        return {"id": kwargs.get("session_id")}

    manager = _make_manager(get_session=_get_chat_session, create_session=_create_chat_session)
    session = await manager.create_session(user_id=user_id, session_id=session_id)

    assert session.session_id == session_id
    assert created_calls == 0


@pytest.mark.asyncio
async def test_create_session_rejects_attaching_to_other_users_session() -> None:
    user_id = str(uuid4())
    other_user_id = str(uuid4())
    session_id = str(uuid4())

    async def _get_chat_session(_session_id: str):
        return {"id": session_id, "user_id": other_user_id, "title": "Persisted"}

    manager = _make_manager(get_session=_get_chat_session)

    with pytest.raises(PermissionError):
        await manager.create_session(user_id=user_id, session_id=session_id)
