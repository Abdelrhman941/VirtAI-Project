import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import WebSocket
from app.presentation.ws.connection_manager import WSConnectionManager

@pytest.mark.asyncio
async def test_ws_connection_manager_no_memory_leak():
    manager = WSConnectionManager(history_size=10)
    ws = AsyncMock(spec=WebSocket)
    
    session_id = "test-session-id"
    user_id = "test-user-id"
    family_id = "test-family-id"
    
    # Register the websocket
    await manager.register(session_id, ws, user_id=user_id, family_id=family_id)
    
    # Verify metadata is populated
    assert session_id in manager._active
    assert user_id in manager._user_to_ws
    assert family_id in manager._family_to_ws
    assert ws in manager._user_to_ws[user_id]
    assert ws in manager._family_to_ws[family_id]
    
    # Add history
    await manager.stamp_and_record(session_id, {"type": "chat"})
    
    assert session_id in manager._seq
    assert session_id in manager._history
    
    # Unregister the websocket
    # This should remove the active session mapping and the empty sets for user_id/family_id
    was_active = await manager.unregister(session_id, ws)
    
    assert was_active is True
    assert session_id not in manager._active
    
    # MEMORY LEAK FIX VERIFICATION 1: Empty sets are deleted
    assert user_id not in manager._user_to_ws
    assert family_id not in manager._family_to_ws
    
    # Note: unregister does NOT clean up history.
    assert session_id in manager._seq
    assert session_id in manager._history
    
    # cleanup_session is called by SessionManager when the session is completely discarded
    await manager.cleanup_session(session_id)
    
    # MEMORY LEAK FIX VERIFICATION 2: History is wiped
    assert session_id not in manager._seq
    assert session_id not in manager._history
    assert session_id not in manager._acked
