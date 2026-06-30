import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.application.rag.visualization_use_case import (
    VisualizationDomainException,
    VisualizationUseCase,
)
from app.infrastructure.db.models import Message


class MockVisualizationProvider:
    def __init__(self, return_val=None):
        self.generate_diagram_mock = AsyncMock(return_value=return_val)

    async def generate_diagram(self, text: str) -> dict:
        return await self.generate_diagram_mock(text)


@pytest.mark.asyncio
async def test_visualization_use_case_not_found():
    db = AsyncMock()
    mock_result = MagicMock()
    # Cache miss
    mock_result.scalar_one_or_none.side_effect = [None, None]
    db.execute.return_value = mock_result

    provider = MockVisualizationProvider()
    use_case = VisualizationUseCase(provider)

    with pytest.raises(VisualizationDomainException, match="Message not found"):
        await use_case.get_visualization(db, str(uuid.uuid4()), str(uuid.uuid4()))


@pytest.mark.asyncio
async def test_visualization_use_case_sentinel_pattern_unavailable():
    db = AsyncMock()
    db.add = MagicMock()

    msg = Message(content="some text", id=uuid.uuid4(), session_id=uuid.uuid4())

    mock_result_cache_miss = MagicMock()
    mock_result_cache_miss.scalar_one_or_none.return_value = None

    mock_result_message = MagicMock()
    mock_result_message.scalar_one_or_none.return_value = msg

    db.execute.side_effect = [mock_result_cache_miss, mock_result_message]

    provider = MockVisualizationProvider({"unavailable": True, "reason": "quota_exceeded"})
    use_case = VisualizationUseCase(provider)

    res = await use_case.get_visualization(db, str(uuid.uuid4()), str(uuid.uuid4()))

    assert res["unavailable"] is True
    assert res["reason"] == "quota_exceeded"
    assert res["image_url"] is None

    assert provider.generate_diagram_mock.call_count == 1
    assert db.add.call_count == 1


@pytest.mark.asyncio
async def test_visualization_use_case_success():
    db = AsyncMock()
    db.add = MagicMock()

    msg = Message(content="some text", id=uuid.uuid4(), session_id=uuid.uuid4())

    mock_result_cache_miss = MagicMock()
    mock_result_cache_miss.scalar_one_or_none.return_value = None

    mock_result_message = MagicMock()
    mock_result_message.scalar_one_or_none.return_value = msg

    db.execute.side_effect = [mock_result_cache_miss, mock_result_message]

    provider = MockVisualizationProvider({"image_url": "https://example.com/img.png"})
    use_case = VisualizationUseCase(provider)

    res = await use_case.get_visualization(db, str(uuid.uuid4()), str(uuid.uuid4()))

    assert res["unavailable"] is False
    assert res["image_url"].startswith("/api/v1/rag/visualization/")

    assert provider.generate_diagram_mock.call_count == 1
    assert db.add.call_count == 1
