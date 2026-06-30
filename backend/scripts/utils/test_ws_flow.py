import asyncio
import json
import websockets

async def main():
    uri = "ws://localhost:8000/api/v1/chat/ws/test-session"
    print(f"Connecting to {uri}")
    try:
        async with websockets.connect(uri) as websocket:
            # Send a user message
            msg = {
                "type": "user_message",
                "text": "Hello, this is a test to trigger the pipeline.",
                "trace_id": "test_trace_123"
            }
            await websocket.send(json.dumps(msg))
            print("Sent message. Waiting for responses...")

            # Wait for some responses
            for _ in range(5):
                response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                print(f"Received: {response[:100]}...")
                if "idle" in response or "tts_ready" in response:
                    pass
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
