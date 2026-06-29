"""
Tests for the complete WebSocket gateway lifecycle.
"""
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi import WebSocket, WebSocketDisconnect

from app.presentation.ws.gateway import WebSocketHandler


class FakePipeline:
    def __init__(self):
        self.process_message_calls = []
        self.abort_called = False

    def abort(self):
        self.abort_called = True

    async def process_message(
        self,
        message_id: str,
        text: str,
        session_id: str,
        send_callback,
        send_binary_callback=None,
        trace_id=None,
        user_id=None,
    ):
        self.process_message_calls.append({"message_id": message_id, "text": text})


class FakeSession:
    def __init__(self, session_id):
        self.session_id = session_id
        self.pipeline = FakePipeline()


class FakeSessionManager:
    def __init__(self):
        self.created = False
        self._last_session: FakeSession | None = None

    async def create_session(self, user_id, avatar_id, voice_id):
        self.created = True
        self._last_session = FakeSession("lazy-session-123")
        return self._last_session

    async def get_session(self, session_id: str):
        """Return the last created session (simulates the session being alive)."""
        if self._last_session and self._last_session.session_id == session_id:
            return self._last_session
        return None

    async def connect_existing_session(self, session_id, user_id=None, avatar_id=None, voice_id=None):
        self._last_session = FakeSession(session_id)
        return self._last_session


class FakeConnectionManager:
    def __init__(self):
        self.registered = False
        self.unregistered_called = False

    async def register(self, session_id, websocket, user_id, family_id):
        self.registered = True

    async def unregister(self, session_id, websocket):
        self.unregistered_called = True


@pytest.mark.asyncio
async def test_websocket_handler_lifecycle():
    ws = AsyncMock(spec=WebSocket)
    session_manager = FakeSessionManager()
    connection_manager = FakeConnectionManager()

    # Sequence of messages: ping -> chat -> disconnect
    messages = [
        '{"type": "ping"}',
        '{"type": "chat.user_message", "data": {"text": "hello", "message_id": "123e4567-e89b-12d3-a456-426614174000"}}',
        WebSocketDisconnect()
    ]
    
    async def mock_receive():
        if not messages:
            await asyncio.sleep(0.01)
            raise asyncio.exceptions.IncompleteReadError(b'', None)
        msg = messages.pop(0)
        if isinstance(msg, Exception):
            await asyncio.sleep(0.01)
            raise msg
        return {"type": "websocket.receive", "text": msg}

    ws.receive = mock_receive
    
    # Track sent messages
    sent_messages = []
    async def mock_send_json(data):
        sent_messages.append(data)
        
    ws.send_json = mock_send_json

    handler = WebSocketHandler(
        websocket=ws,
        user_id="user-123",
        session=None,
        session_manager=session_manager,
        connection_manager=connection_manager,
        avatar_id="avatar-1",
        voice_id="voice-1"
    )

    # Pre-conditions
    assert handler.session_id is None

    # Run the loop (it will hit WebSocketDisconnect and exit gracefully)
    await handler.run()
    
    # Wait for generation task if it exists
    if hasattr(handler, "_generation_task") and handler._generation_task:
        await asyncio.wait([handler._generation_task], timeout=1.0)

    # Verify Ping/Pong
    assert len(sent_messages) == 1
    assert sent_messages[0] == {"type": "pong"}

    # Verify Lazy Session Creation
    assert session_manager.created is True
    assert connection_manager.registered is True
    assert handler.session_id == "lazy-session-123"
    assert handler.session.session_id == "lazy-session-123"

    # Verify Pipeline received message
    assert len(handler.session.pipeline.process_message_calls) == 1
    payload = handler.session.pipeline.process_message_calls[0]
    assert payload["text"] == "hello"
    assert str(payload["message_id"]) == "123e4567-e89b-12d3-a456-426614174000"

    # Verify Teardown Guarantee on Disconnect
    assert connection_manager.unregistered_called is True
    assert handler.session.pipeline.abort_called is True

