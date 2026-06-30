from uuid import UUID, uuid4

from unittest.mock import AsyncMock

import pytest

from app.application.rag.retrieval_use_case import RetrievalUseCase
from app.application.rag.token_budget import TokenBudgetManager
from app.domain.rag.entities import DocumentChunk, RetrievedDocument
from app.domain.rag.ports import EmbeddingProvider, VectorStore


def test_token_budget_accepts_retrieved_documents() -> None:
    budget = TokenBudgetManager()
    chunks = [
        RetrievedDocument(
            text="Lecture notes about arithmetic and functions.",
            score=0.9,
            metadata={"source": "Sec_1.pdf"},
            id="chunk-1",
        )
    ]

    fitted = budget.fit_chunks_to_budget(
        chunks=chunks,
        system_prompt="You are a tutor.",
        user_query="Summarize this lecture",
        max_context_tokens=200,
    )

    assert fitted == chunks
    assert fitted[0].chunk_text == chunks[0].text


@pytest.mark.asyncio
async def test_retrieval_uses_session_scope_and_source_metadata() -> None:
    session_id = str(uuid4())

    class FakeEmbedder(EmbeddingProvider):
        async def embed(self, text: str) -> list[float]:
            return [0.1, 0.2]

        async def embed_batch(self, texts: list[str]) -> list[list[float]]:
            return [[0.1, 0.2] for _ in texts]

        async def close(self) -> None:
            pass

    class FakeVectorStore(VectorStore):
        def __init__(self) -> None:
            self.scope: str | None = None
            self.scope_id: UUID | None = None

        async def store_chunks_batch(
            self, chunks: list[DocumentChunk], embeddings: list[list[float]]
        ) -> None:
            pass

        async def search(
            self,
            query_vector: list[float],
            limit: int = 5,
            document_id: UUID | None = None,
            scope: str | None = None,
            scope_id: UUID | None = None,
            min_dense_score: float = 0.5,
            metadata_filter: dict | None = None,
            user_id: UUID | None = None,
        ) -> list[tuple[DocumentChunk, float]]:
            return []

        async def hybrid_search(
            self,
            query_text: str,
            query_vector: list[float],
            limit: int = 10,
            document_id: UUID | None = None,
            scope: str | None = None,
            scope_id: UUID | None = None,
            min_hybrid_score: float = 0.015,
            min_dense_score: float = 0.5,
            metadata_filter: dict | None = None,
            user_id: UUID | None = None,
        ) -> list[tuple[DocumentChunk, float]]:
            self.scope = scope
            self.scope_id = scope_id
            return [
                (
                    DocumentChunk(
                        id=uuid4(),
                        document_id=uuid4(),
                        chunk_text="Lecture section content.",
                        chunk_order=0,
                        embedding=None,
                        metadata={"source": "Sec_1.pdf"},
                    ),
                    1.0,
                )
            ]

    class FakeReranker:
        async def rerank(self, query: str, chunks: list, top_k: int = 5):
            return [(chunk, 1.0) for chunk in chunks[:top_k]]

    vector_store = FakeVectorStore()
    retrieval = RetrievalUseCase(embedder=FakeEmbedder(), vector_store=vector_store, reranker=FakeReranker())

    context = await retrieval.execute("summarize it", session_id=session_id, user_id=str(uuid4()))

    assert vector_store.scope == "SESSION"
    assert str(vector_store.scope_id) == session_id
    assert "--- Document: Sec_1.pdf ---" in context
    assert "Lecture section content." in context
