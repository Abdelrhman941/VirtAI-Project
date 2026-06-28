import time
from collections.abc import Awaitable, Callable
from contextlib import AbstractAsyncContextManager
from typing import Any

from loguru import logger
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.rag.entities import DocumentChunk
from app.domain.rag.normalization import compute_content_hash, normalize_text
from app.domain.rag.ports import (
    ChunkingStrategy,
    DocumentParser,
    EmbeddingProvider,
    VisionPort,
)
from app.domain.storage.ports import StorageProvider
from app.infrastructure.db.models import Document
from app.infrastructure.db.repositories.document_repository import (
    DocumentRepository,
    DocumentStatus,
    DomainEvent,
)
from app.shared.config import get_settings
from app.shared.errors import (
    ChunkLimitExceeded,
    EmptyDocumentError,
    IngestionCancelledException,
    RAGException,
)
from app.shared.ids import require_uuid
import uuid

async def chunk_document(
    normalized_text: str,
    chunker: ChunkingStrategy,
    settings: Any,
) -> list[str]:
    import asyncio
    chunks_text = await asyncio.to_thread(chunker.chunk, normalized_text)
    total_chunks = len(chunks_text)
    if total_chunks == 0:
        raise EmptyDocumentError("Document chunked to 0 chunks")
    if total_chunks > settings.MAX_CHUNKS_PER_DOCUMENT:
        raise ChunkLimitExceeded(
            f"Document exceeds {settings.MAX_CHUNKS_PER_DOCUMENT} chunks"
        )
    return chunks_text

async def embed_and_index_chunks(
    doc_uuid: uuid.UUID,
    filename: str,
    retrieval_scope: str,
    scope_id: uuid.UUID | None,
    chunks_text: list[str],
    embedder: EmbeddingProvider,
    db_session_factory: Callable[[], AbstractAsyncContextManager[AsyncSession]],
    vector_store_factory: Callable[[AsyncSession], Any],
    batch_size: int,
    progress_callback: Callable[[str, int, int, int], Awaitable[None]],
    cancellation_check: Callable[[], Awaitable[bool]],
) -> None:
    total_chunks = len(chunks_text)
    processed = 0

    for i in range(0, total_chunks, batch_size):
        if await cancellation_check():
            raise IngestionCancelledException()

        batch_texts = chunks_text[i : i + batch_size]
        embeddings = await embedder.embed_batch(batch_texts)

        chunks_to_store = []
        for j, (text, emb) in enumerate(zip(batch_texts, embeddings, strict=False)):
            chunk_metadata = {"source": filename}
            if "[Visual content:" in text:
                chunk_metadata["source_type"] = "vision"
                
            chunk = DocumentChunk(
                id=None,
                document_id=doc_uuid,
                chunk_text=text,
                chunk_order=i + j,
                embedding=emb,
                metadata=chunk_metadata,
                chunk_version=1,
                is_active=True,
                retrieval_scope=retrieval_scope,
                scope_id=scope_id,
            )
            chunks_to_store.append(chunk)

        async with db_session_factory() as db:
            vector_store = vector_store_factory(db)
            await vector_store.store_chunks_batch(chunks_to_store, embeddings)
            await db.commit()

        processed += len(batch_texts)
        progress = 50 + int((processed / total_chunks) * 35)
        await progress_callback("EMBEDDING", progress, processed, total_chunks)


class IngestDocumentUseCase:
    def __init__(
        self,
        storage: StorageProvider,
        parser: DocumentParser | None,
        chunker: ChunkingStrategy | None,
        embedder: EmbeddingProvider | None,
        vision_provider: VisionPort | None,
        db_session_factory: Callable[[], AbstractAsyncContextManager[AsyncSession]],
        document_repo_factory: Callable[[AsyncSession], DocumentRepository],
        vector_store_factory: Callable[[AsyncSession], Any],
        event_publisher: Callable[[DomainEvent], Awaitable[None]] | None = None,
    ):
        self.storage = storage
        self.parser = parser
        self.chunker = chunker
        self.embedder = embedder
        self.vision_provider = vision_provider
        self.db_session_factory = db_session_factory
        self.document_repo_factory = document_repo_factory
        self.vector_store_factory = vector_store_factory
        self.event_publisher = event_publisher
        self.settings = get_settings()

    async def execute(
        self,
        doc_id: str,
        user_id: str,
        filename: str,
        file_type: str,
        storage_key: str,
        progress_callback: Callable[[str, int, int, int], Awaitable[None]],
        cancellation_check: Callable[[], Awaitable[bool]],
        log_ctx: dict[str, Any],
    ) -> None:
        doc_uuid = require_uuid(doc_id, field_name="document_id")
        require_uuid(user_id, field_name="user_id")
        doc_id = str(doc_uuid)

        # 0. Get Scope (in case of retries)
        async with self.db_session_factory() as db:
            doc = (await db.execute(select(Document).where(Document.id == doc_uuid))).scalar_one_or_none()
            if doc is None:
                raise RAGException(f"Document not found: {doc_id}")
            retrieval_scope = getattr(doc, "retrieval_scope", "GLOBAL") or "GLOBAL"
            scope_id = getattr(doc, "scope_id", None)
            
            # Transition to PROCESSING using new DocumentRepository
            doc_repo = self.document_repo_factory(db)
            _, events = await doc_repo.update_status(doc_id, DocumentStatus.PROCESSING)
            await db.commit()
            
            if self.event_publisher:
                for event in events:
                    await self.event_publisher(event)

        try:
            # 1. UPLOADING
            await progress_callback("UPLOADING", 5, 0, 0)
            file_bytes = await self.storage.get_bytes(storage_key)

            # 2. PARSING
            t_parse = time.monotonic()
            await progress_callback("PARSING", 10, 0, 0)
            if not self.parser:
                raise ValueError("Parser is required for this stage")
            raw_text = await self.parser.parse_bytes(file_bytes, file_type)

            # 3. NORMALIZATION
            normalized = normalize_text(raw_text)

            if len(normalized.strip()) == 0:
                raise EmptyDocumentError("Document parsed to empty text")

            content_hash = compute_content_hash(normalized)

            async with self.db_session_factory() as db:
                await db.execute(update(Document).where(Document.id == doc_uuid).values(content_hash=content_hash))
                await db.commit()

            logger.info(
                {
                    **log_ctx,
                    "event": "stage_complete",
                    "stage": "PARSING",
                    "duration_ms": int((time.monotonic() - t_parse) * 1000),
                }
            )

            # 3. CHUNKING
            t_chunk = time.monotonic()
            await progress_callback("CHUNKING", 25, 0, 0)
            if not self.chunker:
                raise ValueError("Chunker is required for this stage")
            
            chunks_text = await chunk_document(normalized, self.chunker, self.settings)
            total_chunks = len(chunks_text)

            logger.info(
                {
                    **log_ctx,
                    "event": "stage_complete",
                    "stage": "CHUNKING",
                    "duration_ms": int((time.monotonic() - t_chunk) * 1000),
                    "total_chunks": total_chunks,
                }
            )

            # 4. EMBEDDING + INDEXING
            t_embed = time.monotonic()
            await progress_callback("EMBEDDING", 50, 0, total_chunks)

            if not self.embedder:
                raise ValueError("Embedder is required for this stage")

            await embed_and_index_chunks(
                doc_uuid=doc_uuid,
                filename=filename,
                retrieval_scope=retrieval_scope,
                scope_id=scope_id,
                chunks_text=chunks_text,
                embedder=self.embedder,
                db_session_factory=self.db_session_factory,
                vector_store_factory=self.vector_store_factory,
                batch_size=self.settings.EMBEDDING_BATCH_SIZE,
                progress_callback=progress_callback,
                cancellation_check=cancellation_check,
            )

            logger.info(
                {
                    **log_ctx,
                    "event": "stage_complete",
                    "stage": "EMBEDDING",
                    "duration_ms": int((time.monotonic() - t_embed) * 1000),
                    "throughput_cps": round(total_chunks / (time.monotonic() - t_embed), 2),
                }
            )

            # 5. COMPLETE
            async with self.db_session_factory() as db:
                doc_repo = self.document_repo_factory(db)
                _, events = await doc_repo.update_status(doc_id, DocumentStatus.COMPLETED)
                await db.commit()
                
                if self.event_publisher:
                    for event in events:
                        await self.event_publisher(event)

        except Exception as e:
            await self.cleanup_failed_job(doc_id, storage_key, str(e))
            raise

    async def cleanup_failed_job(self, doc_id: str, storage_key: str, error_message: str) -> None:
        """Cleans up and marks document as failed using the new unified repository."""
        async with self.db_session_factory() as db:
            doc_repo = self.document_repo_factory(db)
            _, events = await doc_repo.mark_failed(doc_id, error_message)
            await db.commit()
            
            if self.event_publisher:
                for event in events:
                    await self.event_publisher(event)

        if await self.storage.exists(storage_key):
            await self.storage.delete(storage_key)
