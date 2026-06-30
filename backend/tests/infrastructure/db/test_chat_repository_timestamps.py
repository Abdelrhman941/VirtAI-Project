from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.infrastructure.db.models import ChatSession, Message
from app.infrastructure.db.repositories.chat_repository import ChatRepository


def test_serialize_message_uses_created_at_not_legacy_timestamp() -> None:
    message = Message(
        id=uuid4(),
        session_id=uuid4(),
        role="assistant",
        content="hello",
        timestamp=datetime(2026, 6, 25, 10, 0, tzinfo=timezone.utc),
    )

    serialized = ChatRepository._serialize_message(ChatRepository.__new__(ChatRepository), message)

    assert serialized["created_at"] == "2026-06-25T10:00:00+00:00"
    assert "timestamp" not in serialized


def test_serialize_session_uses_last_message_at_not_legacy_updated_at() -> None:
    session = ChatSession(
        id=uuid4(),
        user_id=uuid4(),
        title="Session",
        created_at=datetime(2026, 6, 25, 9, 0, tzinfo=timezone.utc),
        updated_at=datetime(2026, 6, 25, 11, 0, tzinfo=timezone.utc),
        last_message_at=datetime(2026, 6, 25, 10, 0, tzinfo=timezone.utc),
        message_count=2,
    )

    serialized = ChatRepository._serialize_session(ChatRepository.__new__(ChatRepository), session)

    assert serialized["last_message_at"] == "2026-06-25T10:00:00+00:00"
    assert "updated_at" not in serialized
