from typing import Any
from uuid import UUID

from loguru import logger

from app.application.rag.token_budget import TokenBudgetManager
from app.domain.rag.entities import (
    DocumentChunk,
    RetrievalResult,
    RetrievalStatus,
    RetrievedDocument,
)
from app.domain.rag.ports import EmbeddingProvider, RerankerPort, VectorStore
from app.domain.rag.task_types import TASK_RETRIEVAL_SIZES, TaskType
from app.shared.ids import parse_uuid


def _get_chunk_text(chunk: DocumentChunk | RetrievedDocument) -> str:
    """Return the text content regardless of whether chunk is a DocumentChunk or RetrievedDocument."""
    if isinstance(chunk, RetrievedDocument):
        return chunk.text
    return chunk.chunk_text


class RetrievalError(Exception):
    pass


def _source_name(metadata: dict[str, Any] | None) -> str:
    if not metadata:
        return "Unknown"
    return metadata.get("filename") or metadata.get("source") or "Unknown"


class RetrievalUseCase:
    """Orchestrates embedding the query and retrieving chunks via VectorStore."""

    def __init__(
        self,
        embedder: EmbeddingProvider,
        vector_store: VectorStore,
        reranker: RerankerPort,
        budget_manager: TokenBudgetManager | None = None,
    ):
        if not reranker:
            raise ValueError("RerankerPort is strictly required for RetrievalUseCase")
        self.embedder = embedder
        self.vector_store = vector_store
        self.reranker = reranker
        self.budget_manager = budget_manager

    async def retrieve(
        self,
        query: str,
        top_k: int = 5,
        session_id: str | None = None,
        user_id: str | UUID | None = None,
        task_type: TaskType = TaskType.SIMPLE_QA,
        document_id: str | UUID | None = None,
        metadata_filter: dict[str, Any] | None = None,
    ) -> RetrievalResult:
        """Retrieves relevant chunks via hybrid search and optional reranking."""
        if not query.strip():
            return RetrievalResult(status=RetrievalStatus.NO_RESULTS)

        try:
            logger.info(f"Retrieving chunks for query: {query[:50]}")
            query_vector = await self.embedder.embed(query)
            scope_uuid = parse_uuid(session_id) if session_id else None
            scope = "SESSION" if scope_uuid else "GLOBAL"

            user_uuid = parse_uuid(user_id) if user_id else None
            doc_uuid = parse_uuid(document_id) if document_id else None

            if not user_uuid:
                logger.warning("RAG retrieval aborted: user_id is required for all scopes.")
                return RetrievalResult(status=RetrievalStatus.NO_RESULTS)

            sizing = TASK_RETRIEVAL_SIZES.get(task_type, TASK_RETRIEVAL_SIZES[TaskType.SIMPLE_QA])
            actual_top_k = max(top_k, sizing.top_n)
            actual_fetch_limit = actual_top_k * 3

            # 1. Hybrid Search
            results = await self.vector_store.hybrid_search(
                query_text=query,
                query_vector=query_vector,
                limit=actual_fetch_limit,
                scope=scope,
                scope_id=scope_uuid,
                user_id=user_uuid,
                document_id=doc_uuid,
                metadata_filter=metadata_filter,
                min_dense_score=sizing.score_threshold,
                min_hybrid_score=0.0,
            )

            if not results:
                return RetrievalResult(status=RetrievalStatus.NO_RESULTS)

            chunks = [chunk for chunk, _ in results]

            try:
                # Mandatory reranking
                results = await self.reranker.rerank(
                    query=query, chunks=chunks, top_k=actual_top_k
                )
                used_reranker = True
            except Exception as e:
                logger.error(f"Reranker failed (Query: {query[:50]}): {e}", exc_info=True)
                raise  # Crash if reranker fails in mandatory mode

            # 3. Apply dynamic decay for source diversity
            source_counts: dict[str, int] = {}
            decayed_results = []
            for chunk, score in results:
                source = _source_name(chunk.metadata)
                count = source_counts.get(source, 0)
                decayed_score = score * (0.85**count)
                source_counts[source] = count + 1
                decayed_results.append((chunk, score, decayed_score))

            decayed_results.sort(key=lambda x: x[2], reverse=True)

            final_chunks = []
            for chunk, original_score, _ in decayed_results[:actual_top_k]:
                final_chunks.append(
                    RetrievedDocument(
                        text=chunk.chunk_text,
                        score=original_score,
                        metadata=chunk.metadata,
                        id=str(chunk.id),
                    )
                )

            status = RetrievalStatus.SUCCESS
            if len(final_chunks) == 0:
                status = RetrievalStatus.NO_RESULTS
            else:
                threshold = (
                    sizing.score_threshold
                    if not used_reranker
                    else max(sizing.score_threshold, 0.01)
                )
                if final_chunks[0].score < threshold:
                    status = RetrievalStatus.LOW_CONFIDENCE

            return RetrievalResult(status=status, documents=final_chunks)

        except Exception as e:
            logger.error(f"Retrieval failed: {e}")
            return RetrievalResult(status=RetrievalStatus.FAILED)

    async def get_formatted_context(
        self,
        query: str,
        top_k: int = 5,
        session_id: str | None = None,
        max_context_tokens: int = 4000,
        user_id: str | UUID | None = None,
        history_tokens: int = 0,
        system_prompt: str = "",
        task_type: TaskType = TaskType.SIMPLE_QA,
        document_id: str | UUID | None = None,
        metadata_filter: dict[str, Any] | None = None,
    ) -> str:
        """Retrieves and formats context chunks, respecting token budgets."""
        try:
            retrieval_result = await self.retrieve(
                query,
                top_k=top_k,
                session_id=session_id,
                user_id=user_id,
                task_type=task_type,
                document_id=document_id,
                metadata_filter=metadata_filter,
            )
            if retrieval_result.status in (RetrievalStatus.NO_RESULTS, RetrievalStatus.FAILED):
                return ""
            chunks = retrieval_result.documents
        except RetrievalError as e:
            logger.warning(f"Retrieval error: {e}", extra={"query": query})
            return ""

        if self.budget_manager and chunks:
            # Type ignore because fit_chunks_to_budget expects RetrievedDocument but returns sequence
            chunks = self.budget_manager.fit_chunks_to_budget(  # type: ignore
                chunks=chunks,
                system_prompt=system_prompt,
                user_query=query,
                max_context_tokens=max_context_tokens,
                history_tokens=history_tokens,
            )

        context_parts = []
        for chunk in chunks:
            source = _source_name(chunk.metadata)
            context_parts.append(f"--- Document: {source} ---\n{_get_chunk_text(chunk)}\n")

        return "\n".join(context_parts)

    async def inject_context(
        self,
        query: str,
        system_prompt: str,
        top_k: int = 5,
        session_id: str | None = None,
        max_context_tokens: int = 4000,
        user_id: str | UUID | None = None,
        history_tokens: int = 0,
        task_type: TaskType = TaskType.SIMPLE_QA,
        document_id: str | UUID | None = None,
        metadata_filter: dict[str, Any] | None = None,
    ) -> str:
        """Retrieves relevant chunks and injects them into the system prompt."""
        context_block = await self.get_formatted_context(
            query=query,
            top_k=top_k,
            session_id=session_id,
            max_context_tokens=max_context_tokens,
            user_id=user_id,
            history_tokens=history_tokens,
            system_prompt=system_prompt,
            task_type=task_type,
            document_id=document_id,
            metadata_filter=metadata_filter,
        )
        if not context_block:
            return system_prompt

        return (
            f"{system_prompt}\n\n"
            f"### Retrieved Context ###\n"
            f"{context_block.strip()}\n"
            f"### End Context ###\n\n"
            f"Use the above context to answer the user's question accurately. "
            f"Ground your answer in the provided context."
        )

    async def execute(
        self,
        query: str,
        limit: int = 5,
        session_id: str | None = None,
        user_id: str | UUID | None = None,
        history_tokens: int = 0,
        task_type: TaskType = TaskType.SIMPLE_QA,
        document_id: str | UUID | None = None,
        metadata_filter: dict[str, Any] | None = None,
    ) -> str:
        """Retrieves relevant chunks and formats them as a context string."""
        return await self.get_formatted_context(
            query=query,
            top_k=limit,
            session_id=session_id,
            max_context_tokens=3000,
            user_id=user_id,
            history_tokens=history_tokens,
            task_type=task_type,
            document_id=document_id,
            metadata_filter=metadata_filter,
        )
