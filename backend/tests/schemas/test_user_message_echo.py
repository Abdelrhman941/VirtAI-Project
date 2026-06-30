from app.schemas.ws_messages import make_user_message_echo


def test_make_user_message_echo_payload() -> None:
    message = make_user_message_echo(
        session_id="session-123",
        message_id="message-456",
        text="hello",
        conversation_id="conv-789",
    )

    dumped = message.model_dump()
    assert dumped["session_id"] == "session-123"
    assert dumped["message_id"] == "message-456"
    assert dumped["text"] == "hello"
    assert dumped["conversation_id"] == "conv-789"
    # Phase 2: created_at is additive; defaults to None when not provided.
    assert dumped["created_at"] is None


def test_make_user_message_echo_with_created_at() -> None:
    """Phase 2: created_at is forwarded when the persist layer supplies it."""
    ts = "2026-06-25T10:00:00+00:00"
    message = make_user_message_echo(
        session_id="session-123",
        message_id="message-456",
        text="hello",
        conversation_id="conv-789",
        created_at=ts,
    )

    dumped = message.model_dump()
    assert dumped["created_at"] == ts
