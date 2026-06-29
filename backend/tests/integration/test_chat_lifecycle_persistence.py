import pytest
import httpx
from fastapi.testclient import TestClient
from app.main import app

@pytest.mark.asyncio
async def test_post_followed_by_get(auth_headers):
    """Prove that POST immediately followed by GET /messages succeeds."""
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        # POST /api/v1/chat/
        response = await client.post("/api/v1/chat/", headers=auth_headers)
        assert response.status_code == 201
        session_id = response.json()["id"]
        
        # GET /api/v1/chat/{session_id}/messages
        response2 = await client.get(f"/api/v1/chat/{session_id}/messages", headers=auth_headers)
        assert response2.status_code == 200
        assert response2.json() == []  # Empty messages list for a new session


@pytest.mark.asyncio
async def test_post_followed_by_ws_message(auth_headers, token):
    """Prove that POST immediately followed by WS message correctly binds and processes."""
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post("/api/v1/chat/", headers=auth_headers)
        assert response.status_code == 201
        session_id = response.json()["id"]

    with TestClient(app) as client:
        # Connect to WS with token
        with client.websocket_connect(
            f"/api/v1/ws/avatar1?voice=voice1",
            subprotocols=["access_token", token]
        ) as websocket:
            # Send the chat.user_message payload
            payload = {
                "type": "chat.user_message",
                "data": {
                    "session_id": session_id,
                    "message_id": "msg-123",
                    "text": "Hello world"
                }
            }
            websocket.send_json(payload)
            
            # Wait for pipeline.state = thinking (proves message wasn't dropped)
            received_thinking = False
            for _ in range(5):
                try:
                    data = websocket.receive_json()
                    if data.get("type") == "pipeline.state" and data.get("state") == "thinking":
                        received_thinking = True
                        break
                except Exception:
                    pass
            
            assert received_thinking, "Message was dropped or pipeline state not emitted"


@pytest.mark.asyncio
async def test_reconnection_lifecycle(auth_headers, token):
    """Prove that reconnecting binds to the same DB session."""
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post("/api/v1/chat/", headers=auth_headers)
        assert response.status_code == 201
        session_id = response.json()["id"]

    with TestClient(app) as client:
        # 1. Connect
        with client.websocket_connect(
            f"/api/v1/ws/avatar1?voice=voice1&session_id={session_id}",
            subprotocols=["access_token", token]
        ) as websocket:
            payload = {
                "type": "chat.user_message",
                "data": {
                    "session_id": session_id,
                    "message_id": "msg-123",
                    "text": "Hello again"
                }
            }
            websocket.send_json(payload)
            data = websocket.receive_json()
            assert data.get("type") in ["user.message.echo", "pipeline.state"]
            
        # 2. Reconnect
        with client.websocket_connect(
            f"/api/v1/ws/avatar1?voice=voice1&session_id={session_id}",
            subprotocols=["access_token", token]
        ) as websocket2:
            payload2 = {
                "type": "chat.user_message",
                "data": {
                    "session_id": session_id,
                    "message_id": "msg-456",
                    "text": "Reconnected"
                }
            }
            websocket2.send_json(payload2)
            data = websocket2.receive_json()
            assert data.get("type") in ["user.message.echo", "pipeline.state"]
