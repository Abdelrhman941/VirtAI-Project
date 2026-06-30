import asyncio
import json
from unittest.mock import AsyncMock

import pytest
from fastapi import WebSocket, WebSocketDisconnect

from app.presentation.ws.gateway import WebSocketHandler
from app.schemas.ws_messages import ChatDelta


class SlowFakePipeline:
    def __init__(self):
        self.process_message_calls = []
        self.abort_called = False
        self.started_processing = asyncio.Event()

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
        self.started_processing.set()
        await asyncio.sleep(0.1) # Simulate slow LLM TTFT
        print("[TEST LOG] Emitted chat.delta")
        delta = ChatDelta(session_id=session_id, message_id=message_id, delta="hello")
        await send_callback(delta)
        print("[TEST LOG] Emitted chat.delta")
        
        # Simulate long generation (LLM + TTS)
        await asyncio.sleep(0.5)
        
        from app.schemas.ws_messages import ChatFinal
        final = ChatFinal(session_id=session_id, message_id=message_id, text="done")
        await send_callback(final)
        print("[TEST LOG] Emitted chat.final")
        
        self.process_message_calls.append({"message_id": message_id, "text": text})


class FakeSession:
    def __init__(self, session_id):
        self.session_id = session_id
        self.pipeline = SlowFakePipeline()


class FakeSessionManager:
    def __init__(self):
        self.created = False
        self._last_session = None

    async def create_session(self, user_id, avatar_id, voice_id):
        self.created = True
        self._last_session = FakeSession("lazy-session-123")
        return self._last_session

    async def get_session(self, session_id: str):
        if self._last_session and self._last_session.session_id == session_id:
            return self._last_session
        return None

    async def connect_existing_session(self, session_id, user_id=None, avatar_id=None, voice_id=None):
        self._last_session = FakeSession(session_id)
        return self._last_session


@pytest.mark.asyncio
async def test_websocket_heartbeat_survival_during_generation():
    """
    Proves that the WebSocket gateway remains responsive to 'ping' heartbeats
    even while the pipeline is generating a long response.
    """
    ws = AsyncMock(spec=WebSocket)
    session_manager = FakeSessionManager()
    
    msg_queue = asyncio.Queue()
    pong_received = asyncio.Event()
    
    # 1. Send the user message that triggers long generation
    msg_queue.put_nowait('{"type": "chat.user_message", "data": {"text": "hello", "message_id": "123e4567-e89b-12d3-a456-426614174000"}}')

    async def mock_receive():
        try:
            msg = await msg_queue.get()
            if isinstance(msg, Exception):
                raise msg
            return {"type": "websocket.receive", "text": msg}
        except asyncio.CancelledError:
            raise WebSocketDisconnect(1000)

    ws.receive = mock_receive
    
    sent_messages = []
    async def mock_send_json(data):
        sent_messages.append(data)
        if data.get("type") == "pong":
            pong_received.set()
        
    async def mock_send_text(text_data):
        data = json.loads(text_data)
        sent_messages.append(data)
        if data.get("type") == "pong":
            pong_received.set()
            
    ws.send_text = mock_send_text
    ws.send_json = mock_send_json

    class FakeConnectionManager:
        async def stamp_and_record(self, session_id, envelope):
            return json.dumps(envelope)
        
        async def register(self, session_id, ws, user_id, family_id):
            pass
            
        async def unregister(self, session_id, ws):
            pass

    handler = WebSocketHandler(
        websocket=ws,
        user_id="user-123",
        session=None,
        session_manager=session_manager,
        connection_manager=FakeConnectionManager(),
    )

    handler_task = asyncio.create_task(handler.run())
    
    # Wait until the pipeline actually starts processing
    await asyncio.sleep(0.1)
    
    assert session_manager._last_session is not None
    assert session_manager._last_session.pipeline.started_processing.is_set()

    # Now, WHILE it is processing, we send a ping!
    msg_queue.put_nowait('{"type": "ping"}')
    
    # Client waits for pong. If it doesn't get it within 0.2s, it times out and drops connection
    try:
        await asyncio.wait_for(pong_received.wait(), timeout=0.2)
        # We got the pong in time! 
        # Wait for the pipeline to finish its generation before disconnecting
        await asyncio.sleep(0.6)
        msg_queue.put_nowait(WebSocketDisconnect(1000))
    except asyncio.TimeoutError:
        # Starvation occurred! Client timed out waiting for pong.
        msg_queue.put_nowait(WebSocketDisconnect(1006))
    
    await handler_task
    
    assert {"type": "pong"} in sent_messages, "Heartbeat starved! The gateway blocked the receive loop."
    
    # Assert that chat.delta and chat.final were emitted concurrently
    assert any(msg.get("type") == "chat.delta" for msg in sent_messages), "chat.delta was not emitted"
    assert any(msg.get("type") == "chat.final" for msg in sent_messages), "chat.final was not emitted"
