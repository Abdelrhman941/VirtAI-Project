# We will test the WebSocket via FastAPI's TestClient
# We need to mock the DB to provide exactly 3 chunks for the document.
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient


@pytest.mark.asyncio
async def test_explain_ws_flow(app_fixture, mock_db_session):
    """
    Connect WS -> walk through 3 slides auto-advancing (B1 fix: no AwaitInputEvent between slides)
    -> inject a question mid-presentation -> verify the answer is received.

    After B1 fix: start_or_resume auto-advances through ALL slides without waiting.
    AwaitInputEvent is only emitted by handle_user_input (after a Q&A response).
    The end-of-presentation sentinel is SlideEndEvent(slide_index=-1).
    """
    from app.infrastructure.db.models import DocumentChunk, Document

    doc_id = str(uuid4())
    user_id = str(uuid4())

    mock_document = MagicMock(spec=Document)
    mock_document.id = doc_id
    mock_document.user_id = user_id
    mock_document.retrieval_scope = "DOCUMENT"
    mock_document.scope_id = None

    # Mock chunks
    mock_chunks = [
        DocumentChunk(chunk_order=0, chunk_text="Slide 0 Content"),
        DocumentChunk(chunk_order=1, chunk_text="Slide 1 Content"),
        DocumentChunk(chunk_order=2, chunk_text="Slide 2 Content"),
    ]

    # Mock DB execution
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = mock_chunks
    mock_db_session.execute = AsyncMock(return_value=mock_result)
    mock_db_session.scalar = AsyncMock(return_value=mock_document)

    # Mock ChatUseCase to return a deterministic answer
    mock_chat_use_case = AsyncMock()
    mock_chat_use_case.execute_rag_query.return_value = "This is the answer."
    
    from app.domain.chat.entities import LLMChunk
    async def mock_stream(*args, **kwargs):
        yield LLMChunk(token="Slide ", sentence="")
        yield LLMChunk(token="Content", sentence="")
    
    mock_chat_use_case.llm = MagicMock()
    mock_chat_use_case.llm.stream = mock_stream

    # Override dependencies
    from app.infrastructure.db.database import get_db
    from app.presentation.http.v1.dependencies import get_chat_use_case

    app_fixture.dependency_overrides[get_chat_use_case] = lambda: mock_chat_use_case
    app_fixture.dependency_overrides[get_db] = lambda: mock_db_session

    # Mock get_redis in the module where it's used
    mock_redis = AsyncMock()
    redis_store = {}

    async def mock_get(key):
        return redis_store.get(key)

    async def mock_setex(key, ttl, value):
        redis_store[key] = value

    mock_redis.get.side_effect = mock_get
    mock_redis.setex.side_effect = mock_setex
    
    mock_payload = MagicMock()
    mock_payload.user_id = user_id
    
    with patch("app.application.explain.explain_use_case.get_redis", return_value=mock_redis), \
         patch("app.presentation.http.v1.router.decode_auth_token", return_value=mock_payload):

        client = TestClient(app_fixture)

        with client.websocket_connect(f"/api/v1/rag/explain/{doc_id}?token=fake_token", subprotocols=["access_token", "fake_token"]) as websocket:
            # Expect 'ready' first
            data = websocket.receive_json()
            assert data["type"] == "ready"

            # B1 fix: start_or_resume now auto-advances ALL slides without AwaitInputEvent between them.
            # Drain all auto-advancing slide events until we see the end-of-presentation sentinel
            # or decide to interrupt.
            slides_seen = []
            found_end_sentinel = False
            while True:
                data = websocket.receive_json()
                if data["type"] == "SlideStartEvent":
                    slides_seen.append(data["slide_index"])
                elif data["type"] == "SlideEndEvent":
                    if data["slide_index"] == -1:
                        found_end_sentinel = True
                        break
                elif data["type"] in ("SlideContentTokens", "done"):
                    continue

            # Verify all 3 slides were seen in order
            assert slides_seen == [0, 1, 2], f"Expected slides [0,1,2], got {slides_seen}"
            assert found_end_sentinel, "Did not receive end-of-presentation sentinel SlideEndEvent(slide_index=-1)"
            print("Passed: All 3 slides auto-advanced and end sentinel received")

            # Now send a question mid-session (interrupts to Q&A mode)
            websocket.send_json({"type": "chat.user_message", "data": {"message_id": str(uuid4()), "text": "What does this mean?"}})

            # Drain events until we see the answer
            found_answer = False
            while True:
                data = websocket.receive_json()
                if data["type"] == "SlideContentTokens" and "This is the answer." in data["tokens"]:
                    found_answer = True
                    break
                if data["type"] == "SlideEndEvent" and data["slide_index"] == -1:
                    # Restarted from the top, answer not yet received
                    break

            assert found_answer, "Did not receive the answer to the interruption question"
            print("Passed: Q&A interruption answer received")

        print("Test context exited successfully!")
