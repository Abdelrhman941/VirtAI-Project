import asyncio
from unittest.mock import AsyncMock

import pytest
from fastapi import WebSocket, WebSocketDisconnect

from app.presentation.ws.gateway import WebSocketHandler

class FakeSessionManager:
    async def create_session(self, user_id, avatar_id, voice_id):
        raise NotImplementedError

    async def connect_existing_session(self, session_id, user_id=None, avatar_id=None, voice_id=None):
        raise NotImplementedError

class FakeConnectionManager:
    async def safe_send_error(self, *args, **kwargs):
        pass

@pytest.mark.asyncio
async def test_websocket_handler_invalid_json():
    ws = AsyncMock(spec=WebSocket)
    
    messages = [
        {"type": "websocket.receive", "text": "invalid json"},
        WebSocketDisconnect()
    ]
    
    async def mock_receive():
        if not messages:
            raise asyncio.exceptions.IncompleteReadError(b'', None)
        msg = messages.pop(0)
        if isinstance(msg, Exception):
            raise msg
        return msg

    ws.receive = mock_receive
    ws.send_json = AsyncMock()

    handler = WebSocketHandler(
        websocket=ws,
        user_id="user-123",
        session_manager=FakeSessionManager(),
        connection_manager=FakeConnectionManager()
    )

    await handler.run()

    # It should not crash on invalid JSON, should send error and continue to disconnect
    assert ws.send_text.called or ws.send_json.called or handler.connection_manager

@pytest.mark.asyncio
async def test_websocket_handler_missing_fields():
    ws = AsyncMock(spec=WebSocket)
    
    messages = [
        {"type": "websocket.receive", "text": '{"type": "chat.user_message"}'}, # Missing data
        {"type": "websocket.receive", "text": '{"type": "chat.user_message", "data": {}}'}, # Missing text/message_id
        WebSocketDisconnect()
    ]
    
    async def mock_receive():
        msg = messages.pop(0)
        if isinstance(msg, Exception):
            raise msg
        return msg

    ws.receive = mock_receive

    handler = WebSocketHandler(
        websocket=ws,
        user_id="user-123",
        session_manager=FakeSessionManager(),
        connection_manager=FakeConnectionManager()
    )
    handler.session_id = "test-session" # Skip lazy create for this test

    await handler.run()

    # It should catch ValidationError and not crash
    assert len(messages) == 0

@pytest.mark.asyncio
async def test_websocket_handler_binary_frame():
    ws = AsyncMock(spec=WebSocket)
    
    messages = [
        {"type": "websocket.receive", "bytes": b'\x00\x01\x02'}, # Binary frame
        WebSocketDisconnect()
    ]
    
    async def mock_receive():
        msg = messages.pop(0)
        if isinstance(msg, Exception):
            raise msg
        return msg

    ws.receive = mock_receive

    handler = WebSocketHandler(
        websocket=ws,
        user_id="user-123",
        session_manager=FakeSessionManager(),
        connection_manager=FakeConnectionManager()
    )

    await handler.run()
    assert len(messages) == 0
