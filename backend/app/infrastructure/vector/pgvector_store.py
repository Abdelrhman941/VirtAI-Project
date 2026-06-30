from uuid import UUID
import re

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.rag.entities import DocumentChunk
from app.domain.rag.ports import VectorStore
from app.infrastructure.db.database import AsyncSessionLocal
from app.infrastructure.db.models import DocumentChunk as ChunkModel
from app.shared.config import get_settings
from app.shared.errors import VectorDimensionMismatch

settings = get_settings()


class PGVectorStore(VectorStore):
    def __init__(self, db_session: AsyncSession):
        self.db = db_session

    async def store_chunks_batch(
        self, chunks: list[DocumentChunk], embeddings: list[list[float]]
    ) -> None:
        if not chunks:
            return

        expected = settings.EMBEDDING_DIMENSION
        for emb in embeddings:
            if len(emb) != expected:
                raise VectorDimensionMismatch(expected=expected, actual=len(emb))

        models = [
            ChunkModel(
                id=chunk.id,
                document_id=chunk.document_id,
                chunk_text=chunk.chunk_text,
                chunk_order=chunk.chunk_order,
                embedding=emb,
                chunk_metadata=chunk.metadata,
                chunk_version=chunk.chunk_version,
                is_active=chunk.is_active,
                retrieval_scope=chunk.retrieval_scope,
                scope_id=chunk.scope_id,
            )
            for chunk, emb in zip(chunks, embeddings, strict=False)
        ]
        self.db.add_all(models)
        await self.db.flush()

    async def search(
        self,
        query_vector: list[float],
        limit: int = 5,
        document_id: UUID | None = None,
        scope: str | None = None,
        scope_id: UUID | None = None,
        min_dense_score: float | None = None,
        user_id: UUID | None = None,
        metadata_filter: dict | None = None,
    ) -> list[tuple[DocumentChunk, float]]:
        if min_dense_score is None:
            min_dense_score = settings.RAG_MIN_DENSE_SCORE
        from app.infrastructure.db.models import Document

        if not user_id:
            logger.warning(
                "[VectorStore] search aborted: user_id is required to prevent data leaks."
            )
            return []

        stmt = (
            select(
                ChunkModel,
                (1 - ChunkModel.embedding.cosine_distance(query_vector)).label("similarity"),
            )
            .join(Document, ChunkModel.document_id == Document.id)
            .where(ChunkModel.is_active == True)
            .where(Document.user_id == user_id)
            .order_by(ChunkModel.embedding.cosine_distance(query_vector))
            .limit(limit)
        )

        if document_id:
            stmt = stmt.where(ChunkModel.document_id == document_id)

        if metadata_filter:
            if "slide_index" in metadata_filter:
                stmt = stmt.where(ChunkModel.chunk_order == metadata_filter["slide_index"])
            else:
                stmt = stmt.where(ChunkModel.chunk_metadata.contains(metadata_filter))

        from sqlalchemy import or_

        if scope == "SESSION" and scope_id:
            stmt = stmt.where(
                or_(
                    ChunkModel.retrieval_scope == "GLOBAL",
                    (ChunkModel.retrieval_scope == "SESSION") & (ChunkModel.scope_id == scope_id),
                )
            )
        elif scope:
            stmt = stmt.where(ChunkModel.retrieval_scope == scope)
            if scope_id:
                stmt = stmt.where(ChunkModel.scope_id == scope_id)
            else:
                stmt = stmt.where(ChunkModel.scope_id.is_(None))

        result = await self.db.execute(stmt)
        rows = result.all()
        output = []
        for row in rows:
            model = row[0]
            similarity = row[1]
            if similarity < min_dense_score:
                continue
            chunk = DocumentChunk(
                id=model.id,
                document_id=model.document_id,
                chunk_text=model.chunk_text,
                chunk_order=model.chunk_order,
                embedding=model.embedding,
                metadata=model.chunk_metadata,
                created_at=model.created_at,
                chunk_version=model.chunk_version,
                is_active=model.is_active,
                retrieval_scope=model.retrieval_scope,
                scope_id=model.scope_id,
            )
            output.append((chunk, float(similarity)))

        # Retrieval instrumentation
        if output:
            avg_sim = sum(sim for _, sim in output) / len(output)
            logger.debug(
                f"[VectorStore] Dense search found {len(output)} chunks | avg_sim={avg_sim:.3f}"
            )
        else:
            logger.debug("[VectorStore] Dense search found 0 chunks above threshold")

        return output

    async def hybrid_search(
        self,
        query_text: str,
        query_vector: list[float],
        limit: int = 10,
        document_id: UUID | None = None,
        scope: str | None = None,
        scope_id: UUID | None = None,
        min_hybrid_score: float | None = None,
        min_dense_score: float | None = None,
        user_id: UUID | None = None,
        metadata_filter: dict | None = None,
    ) -> list[tuple[DocumentChunk, float]]:
        if min_hybrid_score is None:
            min_hybrid_score = settings.RAG_MIN_HYBRID_SCORE
        if min_dense_score is None:
            min_dense_score = settings.RAG_MIN_DENSE_SCORE
        from app.infrastructure.db.models import Document

        if not user_id:
            logger.warning(
                "[VectorStore] hybrid_search aborted: user_id is required to prevent data leaks."
            )
            return []

        # Dense query
        stmt_dense = (
            select(
                ChunkModel,
                (1 - ChunkModel.embedding.cosine_distance(query_vector)).label("similarity"),
            )
            .join(Document, ChunkModel.document_id == Document.id)
            .where(ChunkModel.is_active == True)
            .where(Document.user_id == user_id)
        )
        if document_id:
            stmt_dense = stmt_dense.where(ChunkModel.document_id == document_id)
        if metadata_filter:
            if "slide_index" in metadata_filter:
                stmt_dense = stmt_dense.where(
                    ChunkModel.chunk_order == metadata_filter["slide_index"]
                )
            else:
                stmt_dense = stmt_dense.where(ChunkModel.chunk_metadata.contains(metadata_filter))
        from sqlalchemy import or_

        if scope == "SESSION" and scope_id:
            stmt_dense = stmt_dense.where(
                or_(
                    ChunkModel.retrieval_scope == "GLOBAL",
                    (ChunkModel.retrieval_scope == "SESSION") & (ChunkModel.scope_id == scope_id),
                )
            )
        elif scope:
            stmt_dense = stmt_dense.where(ChunkModel.retrieval_scope == scope)
            if scope_id:
                stmt_dense = stmt_dense.where(ChunkModel.scope_id == scope_id)
            else:
                stmt_dense = stmt_dense.where(ChunkModel.scope_id.is_(None))
        stmt_dense = stmt_dense.order_by(ChunkModel.embedding.cosine_distance(query_vector)).limit(
            limit * 2
        )

        # Lexical query
        ts_config = "english"
        if re.search(r'[\u0600-\u06FF]', query_text):
            ts_config = "simple"

        text_query = func.websearch_to_tsquery(ts_config, query_text)
        text_vector = func.to_tsvector(ts_config, ChunkModel.chunk_text)
        stmt_lexical = (
            select(
                ChunkModel,
                func.ts_rank(text_vector, text_query).label("ts_rank"),
            )
            .join(Document, ChunkModel.document_id == Document.id)
            .where(ChunkModel.is_active == True)
            .where(Document.user_id == user_id)
            .where(text_vector.op("@@")(text_query))
        )
        if document_id:
            stmt_lexical = stmt_lexical.where(ChunkModel.document_id == document_id)
        if metadata_filter:
            if "slide_index" in metadata_filter:
                stmt_lexical = stmt_lexical.where(
                    ChunkModel.chunk_order == metadata_filter["slide_index"]
                )
            else:
                stmt_lexical = stmt_lexical.where(
                    ChunkModel.chunk_metadata.contains(metadata_filter)
                )
        if scope == "SESSION" and scope_id:
            stmt_lexical = stmt_lexical.where(
                or_(
                    ChunkModel.retrieval_scope == "GLOBAL",
                    (ChunkModel.retrieval_scope == "SESSION") & (ChunkModel.scope_id == scope_id),
                )
            )
        elif scope:
            stmt_lexical = stmt_lexical.where(ChunkModel.retrieval_scope == scope)
            if scope_id:
                stmt_lexical = stmt_lexical.where(ChunkModel.scope_id == scope_id)
            else:
                stmt_lexical = stmt_lexical.where(ChunkModel.scope_id.is_(None))
        stmt_lexical = stmt_lexical.order_by(func.ts_rank(text_vector, text_query).desc()).limit(
            limit * 2
        )

        res_dense = await self.db.execute(stmt_dense)
        res_lexical = await self.db.execute(stmt_lexical)

        dense_rows = res_dense.all()
        lexical_rows = res_lexical.all()

        rrf_k = 60
        scores: dict[UUID, float] = {}
        models: dict[UUID, ChunkModel] = {}

        for rank, row in enumerate(dense_rows):
            model = row[0]
            sim = float(row[1])
            if sim < min_dense_score:
                continue
            models[model.id] = model
            scores[model.id] = 1.0 / (rrf_k + rank + 1)

        for rank, row in enumerate(lexical_rows):
            model = row[0]
            models[model.id] = model
            scores[model.id] = scores.get(model.id, 0.0) + (1.0 / (rrf_k + rank + 1))

        # Sort and threshold
        sorted_results = sorted(scores.items(), key=lambda x: x[1], reverse=True)

        output = []
        for chunk_id, hybrid_score in sorted_results:
            if hybrid_score < min_hybrid_score:
                break
            if len(output) >= limit:
                break
            model = models[chunk_id]
            chunk = DocumentChunk(
                id=model.id,
                document_id=model.document_id,
                chunk_text=model.chunk_text,
                chunk_order=model.chunk_order,
                embedding=model.embedding,
                metadata=model.chunk_metadata,
                created_at=model.created_at,
                chunk_version=model.chunk_version,
                is_active=model.is_active,
                retrieval_scope=model.retrieval_scope,
                scope_id=model.scope_id,
            )
            output.append((chunk, float(hybrid_score)))

        if output:
            avg_score = sum(score for _, score in output) / len(output)
            logger.debug(
                f"[VectorStore] Hybrid search (RRF) found {len(output)} chunks | avg_score={avg_score:.3f}"
            )
        else:
            logger.debug("[VectorStore] Hybrid search found 0 chunks above threshold")

        return output


class SessionManagedPGVectorStore(VectorStore):
    """
    A VectorStore adapter that manages its own database session.
    Ideal for injection into long-lived application services.
    """

    async def store_chunks_batch(
        self, chunks: list[DocumentChunk], embeddings: list[list[float]]
    ) -> None:
        async with AsyncSessionLocal() as db:
            store = PGVectorStore(db)
            await store.store_chunks_batch(chunks, embeddings)
            await db.commit()

    async def search(
        self,
        query_vector: list[float],
        limit: int = 5,
        document_id: UUID | None = None,
        scope: str | None = None,
        scope_id: UUID | None = None,
        min_dense_score: float | None = None,
        user_id: UUID | None = None,
        metadata_filter: dict | None = None,
    ) -> list[tuple[DocumentChunk, float]]:
        async with AsyncSessionLocal() as db:
            store = PGVectorStore(db)
            return await store.search(
                query_vector,
                limit,
                document_id,
                scope,
                scope_id,
                min_dense_score,
                user_id=user_id,
                metadata_filter=metadata_filter,
            )

    async def hybrid_search(
        self,
        query_text: str,
        query_vector: list[float],
        limit: int = 10,
        document_id: UUID | None = None,
        scope: str | None = None,
        scope_id: UUID | None = None,
        min_hybrid_score: float | None = None,
        min_dense_score: float | None = None,
        user_id: UUID | None = None,
        metadata_filter: dict | None = None,
    ) -> list[tuple[DocumentChunk, float]]:
        async with AsyncSessionLocal() as db:
            store = PGVectorStore(db)
            return await store.hybrid_search(
                query_text,
                query_vector,
                limit,
                document_id,
                scope,
                scope_id,
                min_hybrid_score,
                min_dense_score,
                user_id=user_id,
                metadata_filter=metadata_filter,
            )
