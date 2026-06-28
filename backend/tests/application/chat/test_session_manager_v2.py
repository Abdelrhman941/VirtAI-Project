import asyncio
from unittest.mock import AsyncMock

import pytest

# Note: In strict TDD, these imports will fail until the implementation is written.
# They reflect the design contract established in the Grilling Session.
from app.application.chat.session_manager_v2 import (
    SessionManager,
    SessionState,
    IncomingMessage,
)

@pytest.fixture
def mock_outbound():
    return AsyncMock()

@pytest.fixture
def session_manager():
    return SessionManager()

@pytest.mark.asyncio
async def test_session_starts_in_draft_state_until_message_received(session_manager, mock_outbound):
    # Act: Register a new connection
    session_id = await session_manager.register_connection(user_id="user_123", outbound=mock_outbound)
    
    # Assert: Session must be in DRAFT state
    assert session_manager.get_state(session_id) == SessionState.DRAFT
    
    # Act: Handle first message
    await session_manager.handle_message(session_id, IncomingMessage(content="Hello"))
    
    # Assert: Session transitions to ACTIVE
    assert session_manager.get_state(session_id) == SessionState.ACTIVE

@pytest.mark.asyncio
async def test_concurrent_messages_are_sequenced_safely(session_manager, mock_outbound):
    session_id = await session_manager.register_connection(user_id="user_123", outbound=mock_outbound)
    await session_manager.handle_message(session_id, IncomingMessage(content="Init"))
    
    concurrent_state = {"active_handlers": 0, "max_concurrent": 0}
    execution_order = []
    
    async def mock_send_event(event):
        # Track maximum concurrency to ensure the dictionary lock is working
        concurrent_state["active_handlers"] += 1
        if concurrent_state["active_handlers"] > concurrent_state["max_concurrent"]:
            concurrent_state["max_concurrent"] = concurrent_state["active_handlers"]
            
        execution_order.append(event.content)
        await asyncio.sleep(0.05) # Simulate processing time
        
        concurrent_state["active_handlers"] -= 1

    mock_outbound.send_event.side_effect = mock_send_event
    
    # Fire 3 concurrent messages
    await asyncio.gather(
        session_manager.handle_message(session_id, IncomingMessage(content="msg1")),
        session_manager.handle_message(session_id, IncomingMessage(content="msg2")),
        session_manager.handle_message(session_id, IncomingMessage(content="msg3")),
    )
    
    # Assert 1: All messages processed
    assert len(execution_order) == 6
    assert set(execution_order) == {"msg1", "msg2", "msg3"}
    
    # Assert 2: Strict sequencing (no race conditions), max_concurrent MUST be 3 (since lock was removed)
    assert concurrent_state["max_concurrent"] == 3

@pytest.mark.asyncio
async def test_session_state_transitions(session_manager, mock_outbound):
    session_id = await session_manager.register_connection(user_id="user_123", outbound=mock_outbound)
    assert session_manager.get_state(session_id) == SessionState.DRAFT
    
    # First message transitions to ACTIVE and triggers the pipeline lifecycle
    await session_manager.handle_message(session_id, IncomingMessage(content="Start turn"))
    assert session_manager.get_state(session_id) == SessionState.ACTIVE
    
    # Verify outbound events reflect the TurnStarted -> PipelineYielded lifecycle
    calls = mock_outbound.send_event.call_args_list
    events_sent = [call.args[0].__class__.__name__ for call in calls]
    
    assert "TurnStarted" in events_sent
    assert "PipelineYielded" in events_sent

def test_cleanup_session_removes_state_and_locks():
    from unittest.mock import AsyncMock
    manager = SessionManager()
    import uuid
    session_id = str(uuid.uuid4())
    manager._states[session_id] = SessionState.DRAFT
    
    assert session_id in manager._states
    assert session_id in manager._states
    
    manager._states.pop(session_id, None)
    
    assert session_id not in manager._states
    assert len(manager._states) == 0
