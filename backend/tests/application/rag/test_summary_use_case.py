import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.application.rag.summary_use_case import SummaryUseCase
from app.domain.chat.entities import LLMChunk
from app.domain.rag.task_types import Locale
from app.infrastructure.db.models import DocumentChunk, SummaryCache


class MockLLMProvider:
    def __init__(self):
        self.complete_mock = AsyncMock()
        self.stream_mock = MagicMock()
        self.stream_chunks = []

    async def complete(self, history, **kwargs):
        return await self.complete_mock(history, **kwargs)

    async def stream(self, history, on_sentence=None, trace_id=None, **kwargs):
        for chunk in self.stream_chunks:
            yield chunk


@pytest.mark.asyncio
async def test_summary_use_case_no_chunks():
    db = AsyncMock()
    db.add = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_result.scalars.return_value.all.return_value = []
    db.execute.return_value = mock_result

    llm = MockLLMProvider()
    use_case = SummaryUseCase(llm)

    result = []
    async for chunk in use_case.summarize_document(db, str(uuid.uuid4()), Locale.EN):
        result.append(chunk)

    assert result == ["No content found to summarize."]


@pytest.mark.asyncio
async def test_summary_use_case_cache_hit():
    db = AsyncMock()
    db.add = MagicMock()
    cached = SummaryCache(summary_text="Cached Summary")
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = cached
    db.execute.return_value = mock_result

    llm = MockLLMProvider()
    use_case = SummaryUseCase(llm)

    result = []
    async for chunk in use_case.summarize_document(db, str(uuid.uuid4()), Locale.EN):
        result.append(chunk)

    assert "".join(result) == "Cached Summary"


@pytest.mark.asyncio
async def test_summary_use_case_map_reduce_single_batch():
    db = AsyncMock()
    db.add = MagicMock()
    # No cache
    db.execute.return_value.scalar_one_or_none.return_value = None

    # 2 chunks => fits in single batch
    chunk1 = DocumentChunk(chunk_text="Intro", chunk_order=1)
    chunk2 = DocumentChunk(chunk_text="Details", chunk_order=2)

    # Needs a custom mock for the chained .scalars().all() calls since we use the same db.execute
    # We can mock side_effect for execute to return different things for cache vs chunks

    class ExecResult:
        def __init__(self, scalar=None, all_res=None):
            self._scalar = scalar
            self._all_res = all_res

        def scalar_one_or_none(self):
            return self._scalar

        def scalars(self):
            class Scalars:
                def __init__(self, items):
                    self.items = items

                def all(self):
                    return self.items

            return Scalars(self._all_res)

    def db_execute_mock(query):
        # super hacky way to differentiate queries
        q_str = str(query)
        if "summary_cache" in q_str:
            return ExecResult(scalar=None)
        return ExecResult(all_res=[chunk1, chunk2])

    db.execute = AsyncMock(side_effect=db_execute_mock)

    llm = MockLLMProvider()
    llm.stream_chunks = [LLMChunk(token="Final "), LLMChunk(token="Summary")]
    use_case = SummaryUseCase(llm)

    result = []
    async for chunk in use_case.summarize_document(db, str(uuid.uuid4()), Locale.EN):
        result.append(chunk)

    assert "".join(result) == "Final Summary"
    db.add.assert_called()
    db.commit.assert_awaited()
