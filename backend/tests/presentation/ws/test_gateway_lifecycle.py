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

    async def create_session(self, user_id, avatar_id, voice_id):
        self.created = True
        return FakeSession("lazy-session-123")


class FakeConnectionManager:
    def __init__(self):
        self.registered = False

    async def register(self, session_id, websocket, user_id, family_id):
        self.registered = True


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
            raise asyncio.exceptions.IncompleteReadError(b'', None)
        msg = messages.pop(0)
        if isinstance(msg, Exception):
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

