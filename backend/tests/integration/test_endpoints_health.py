from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.infrastructure.db.database import get_db
from app.main import app
from app.presentation.http.v1.dependencies import _current_user, get_session_manager


@pytest.fixture
def mock_user():
    user = MagicMock()
    user.id = "test-user-id"
    return user


@pytest.fixture
def client(mock_user):
    # Setup dummy app state to avoid lifespan execution
    app.state.storage = AsyncMock()
    app.state.model_policy = MagicMock()
    app.state.embedder = MagicMock()
    app.state.reranker = MagicMock()
    app.state.intent_classifier = MagicMock()

    # Override dependencies
    async def override_get_db():
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_result
        yield mock_db

    async def override_current_user():
        return mock_user

    def override_get_session_manager():
        return AsyncMock()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[_current_user] = override_current_user
    app.dependency_overrides[get_session_manager] = override_get_session_manager

    test_client = TestClient(app)
    yield test_client

    app.dependency_overrides.clear()


def test_documents_status_health(client):
    response = client.get(
        "/api/v1/documents/status?session_id=123e4567-e89b-12d3-a456-426614174000"
    )
    assert (
        response.status_code != 500
    ), f"Expected non-500 status, got {response.status_code}. Response: {response.text}"


def test_chat_messages_health(client):
    response = client.get("/api/v1/chat/123e4567-e89b-12d3-a456-426614174000/messages")
    assert (
        response.status_code != 500
    ), f"Expected non-500 status, got {response.status_code}. Response: {response.text}"
