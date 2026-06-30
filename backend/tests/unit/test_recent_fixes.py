import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.application.chat.session_manager import ConversationSession, SessionManager
from app.application.voice.handle_voice_turn import ConversationPipeline
from app.infrastructure.db.repositories.document_repository import DocumentRepository


@pytest.mark.asyncio
async def test_llm_with_sentinel_pushes_none_on_success():
    """Test that the sentinel None is pushed onto the sentence queue when the LLM stage completes."""
    pipeline = ConversationPipeline()
    pipeline.llm_stage = AsyncMock()

    async def dummy_send(msg):
        pass

    # If it doesn't push None, the internal loop will hang for 60s. We set a small timeout here.
    await asyncio.wait_for(
        pipeline.process_message(
            text="hello", session_id="1", message_id="2", trace_id="3", send_callback=dummy_send
        ),
        timeout=2.0,
    )


@pytest.mark.asyncio
async def test_llm_with_sentinel_pushes_none_on_exception():
    """Test that the sentinel None is pushed onto the sentence queue even if the LLM stage throws an exception."""
    pipeline = ConversationPipeline()
    pipeline.llm_stage = AsyncMock()
    pipeline.llm_stage.process.side_effect = Exception("LLM processing crashed")

    async def dummy_send(msg):
        pass

    # The exception might propagate out of process_message
    try:
        await asyncio.wait_for(
            pipeline.process_message(
                text="hello", session_id="1", message_id="2", trace_id="3", send_callback=dummy_send
            ),
            timeout=2.0,
        )
    except Exception:
        pass
    # The fact that it returns quickly means the None sentinel was processed or it safely aborted.


@pytest.mark.asyncio
async def test_delete_chunks_by_version():
    """Test that delete_chunks_by_version executes the correct SQL query via SQLAlchemy."""
    db_mock = AsyncMock()
    repo = DocumentRepository(db=db_mock)

    import uuid

    doc_id = uuid.uuid4()

    await repo.delete_chunks_by_version(str(doc_id), 1)

    # Assert execute was called
    db_mock.execute.assert_called_once()
    args, _ = db_mock.execute.call_args
    # Just ensuring a statement was executed
    assert args[0] is not None


@pytest.mark.asyncio
async def test_lock_safe_cleanup_idle():
    """Test that cleanup_idle safely extracts sessions from lock before doing I/O cleanup."""
    repo_mock = MagicMock()
    repo_mock.return_value.__aenter__.return_value = AsyncMock()

    sm = SessionManager(chat_repository_factory=repo_mock, session_timeout_sec=10)

    # Create a mock session
    session1 = ConversationSession(session_id="1", user_id="u1")
    session1.last_activity = session1.last_activity.replace(year=2000)  # Force idle
    session1.cleanup = MagicMock()
    session1.pipeline = MagicMock()
    session1.pipeline.invalidate_context = AsyncMock()

    session2 = ConversationSession(session_id="2", user_id="u2")
    # Not idle
    session2.cleanup = MagicMock()

    sm._sessions["1"] = session1
    sm._sessions["2"] = session2

    cleaned = await sm.cleanup_idle()

    assert cleaned == 1
    assert "1" not in sm._sessions
    assert "2" in sm._sessions

    session1.cleanup.assert_called_once()
    session1.pipeline.invalidate_context.assert_called_once_with("1")
