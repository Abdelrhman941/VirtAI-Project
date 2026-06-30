"""Tests for ChatFinal WS schema — Phase 2 created_at field."""

from app.schemas.ws_messages import make_chat_final


def test_make_chat_final_defaults_created_at_to_none() -> None:
    """created_at is additive; existing callers that omit it receive None."""
    message = make_chat_final(
        session_id="session-abc",
        message_id="message-def",
        text="Hello from the AI",
    )

    dumped = message.model_dump()
    assert dumped["session_id"] == "session-abc"
    assert dumped["message_id"] == "message-def"
    assert dumped["text"] == "Hello from the AI"
    assert dumped["emotion"] is None
    # Phase 2: created_at is new and optional.
    assert dumped["created_at"] is None


def test_make_chat_final_with_created_at() -> None:
    """Phase 2: created_at is forwarded when the persist layer supplies it."""
    ts = "2026-06-25T10:05:00+00:00"
    message = make_chat_final(
        session_id="session-abc",
        message_id="message-def",
        text="Hello from the AI",
        emotion="happy",
        created_at=ts,
    )

    dumped = message.model_dump()
    assert dumped["created_at"] == ts
    assert dumped["emotion"] == "happy"
