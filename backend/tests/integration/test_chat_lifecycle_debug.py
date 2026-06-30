import pytest
import httpx
from fastapi.testclient import TestClient
from app.main import app

@pytest.mark.asyncio
async def test_chat_lifecycle_trace(auth_headers):
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        print("\n--- POST /api/v1/chat/ ---")
        response = await client.post("/api/v1/chat/", headers=auth_headers)
        assert response.status_code == 201
        session_id = response.json()["id"]
        print(f"\n--- CREATED SESSION: {session_id} ---")
        
        print(f"\n--- GET /api/v1/chat/{session_id}/messages ---")
        response2 = await client.get(f"/api/v1/chat/{session_id}/messages", headers=auth_headers)
        print(f"GET response status: {response2.status_code}")
        
        print("\n--- END TRACE ---")
