import uuid
from unittest.mock import AsyncMock

import pytest

from app.application.rag.retrieval_use_case import RetrievalUseCase
from app.domain.rag.entities import DocumentChunk, RetrievalStatus
from app.domain.rag.task_types import TaskType


@pytest.mark.asyncio
async def test_retrieval_task_aware_simple_qa():
    vector_store = AsyncMock()
    reranker = AsyncMock()

    # Mock embedder to return a dummy vector
    embedder = AsyncMock()
    embedder.embed.return_value = [0.1] * 1536

    # Return 30 chunks from hybrid_search
    chunks = [
        (
            DocumentChunk(
                id=uuid.uuid4(),
                document_id=uuid.uuid4(),
                chunk_text=f"text {i}",
                chunk_order=i,
                embedding=None,
            ),
            0.9,
        )
        for i in range(30)
    ]
    vector_store.hybrid_search.return_value = chunks

    async def mock_rerank(query, chunks, top_k):
        return [(c, 0.9) for c in chunks[:top_k]]

    reranker.rerank.side_effect = mock_rerank

    use_case = RetrievalUseCase(embedder=embedder, vector_store=vector_store, reranker=reranker)

    result = await use_case.retrieve(
        "test query", user_id=uuid.uuid4(), task_type=TaskType.SIMPLE_QA
    )

    assert result.status == RetrievalStatus.SUCCESS
    assert len(result.documents) == 5  # top_n for SIMPLE_QA is 5
    assert len(result.documents) <= 20

    # Check limit passed to hybrid_search
    _, kwargs = vector_store.hybrid_search.call_args
    assert kwargs["limit"] == 15


@pytest.mark.asyncio
async def test_retrieval_task_aware_summary():
    vector_store = AsyncMock()
    reranker = AsyncMock()

    embedder = AsyncMock()
    embedder.embed.return_value = [0.1] * 1536

    # Return 100 chunks from hybrid_search
    chunks = [
        (
            DocumentChunk(
                id=uuid.uuid4(),
                document_id=uuid.uuid4(),
                chunk_text=f"text {i}",
                chunk_order=i,
                embedding=None,
            ),
            0.9,
        )
        for i in range(100)
    ]
    vector_store.hybrid_search.return_value = chunks

    async def mock_rerank(query, chunks, top_k):
        return [(c, 0.9) for c in chunks[:top_k]]

    reranker.rerank.side_effect = mock_rerank

    use_case = RetrievalUseCase(embedder=embedder, vector_store=vector_store, reranker=reranker)

    result = await use_case.retrieve("test query", user_id=uuid.uuid4(), task_type=TaskType.SUMMARY)

    assert result.status == RetrievalStatus.SUCCESS
    assert len(result.documents) >= 20  # 20 is the top_n for SUMMARY
    assert len(result.documents) == 20

    # Check limit passed to hybrid_search
    _, kwargs = vector_store.hybrid_search.call_args
    assert kwargs["limit"] == 60
