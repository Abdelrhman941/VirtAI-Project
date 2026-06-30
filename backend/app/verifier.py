import asyncio
import httpx
import websockets
import json
import logging
from app.infrastructure.db.database import AsyncSessionLocal
from app.infrastructure.db.models import User

async def run_verification(user_id):
    await asyncio.sleep(8)
    
    file_handler = logging.FileHandler("/app/app/verification_output5.log")
    file_handler.setFormatter(logging.Formatter('%(message)s'))
    logging.getLogger('sqlalchemy.engine').addHandler(file_handler)
    logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
    
    with open("/app/app/verification_output5.log", "a") as out:
        def log(msg):
            out.write(msg + "\n")
            out.flush()
            
        log("=== STARTING VERIFICATION ===")
        try:
            async with AsyncSessionLocal() as db:
                log(f"Creating dummy user in DB: {user_id}")
                user = User(id=user_id, email=f"{user_id}@test.com", full_name="Test", is_active=True, provider="local")
                db.add(user)
                await db.commit()
            
            async with httpx.AsyncClient(base_url="http://127.0.0.1:8000") as client:
                log("\n1. POST /api/v1/chat/")
                resp = await client.post("/api/v1/chat/", headers={"x-csrf-token": "dummy"}, cookies={"csrf_token": "dummy"})
                log(f"Status: {resp.status_code}")
                if resp.status_code != 201:
                    log(f"Response: {resp.text}")
                session_id = resp.json().get("id")
                if not session_id:
                    raise ValueError("No session id")
                log(f"Created session: {session_id}")
                
                log("\n2. GET /api/v1/chat/{session_id}/messages")
                resp2 = await client.get(f"/api/v1/chat/{session_id}/messages", headers={"x-csrf-token": "dummy"}, cookies={"csrf_token": "dummy"})
                log(f"Status: {resp2.status_code}")
                log(f"Response: {resp2.json()}")
                
                log("\n3. WebSocket Connection")
                uri = f"ws://127.0.0.1:8000/api/v1/ws/avatar1?voice=voice1"
                log(f"Connecting to {uri}")
                async with websockets.connect(uri) as ws:
                    payload = {
                        "type": "chat.user_message",
                        "data": {
                            "session_id": session_id,
                            "message_id": "msg-123",
                            "text": "Hello verification test"
                        }
                    }
                    await ws.send(json.dumps(payload))
                    log(f"Sent chat.user_message: {payload}")
                    
                    while True:
                        msg = await asyncio.wait_for(ws.recv(), timeout=15.0)
                        data = json.loads(msg)
                        log(f"WS Event: {data.get('type')}")
                        if data.get('type') == 'pipeline.state':
                            log(f"  -> State: {data.get('state')}")
                        elif data.get('type') == 'chat.delta':
                            log(f"  -> Delta: {data.get('delta')}")
                        elif data.get('type') == 'chat.final':
                            log(f"  -> Final Text: {data.get('text')}")
                            break
                            
                log("\n=== VERIFICATION SUCCESSFUL ===")
        except Exception as e:
            log(f"\n=== VERIFICATION ERROR: {e} ===")
