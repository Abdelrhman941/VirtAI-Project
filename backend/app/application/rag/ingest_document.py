import time
from collections.abc import Awaitable, Callable
from contextlib import AbstractAsyncContextManager
from typing import Any

from loguru import logger
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
from app.shared.config import get_settings
from app.shared.errors import (
    ChunkLimitExceeded,
    EmptyDocumentError,
    IngestionCancelledException,
    RAGException,
)
from app.shared.ids import require_uuid


class IngestDocumentUseCase:
    def __init__(
        self,
        storage: StorageProvider,
        parser: DocumentParser | None,
        chunker: ChunkingStrategy | None,
        embedder: EmbeddingProvider | None,
        vision_provider: VisionPort | None,
        db_session_factory: Callable[[], AbstractAsyncContextManager[AsyncSession]],
        crud_repo_factory: Callable[[AsyncSession], Any],
        state_repo_factory: Callable[[AsyncSession], Any],
        integrity_repo_factory: Callable[[AsyncSession], Any],
        vector_store_factory: Callable[[AsyncSession], Any],
    ):
        self.storage = storage
        self.parser = parser
        self.chunker = chunker
        self.embedder = embedder
        self.vision_provider = vision_provider
        self.db_session_factory = db_session_factory
        self.crud_repo_factory = crud_repo_factory
        self.state_repo_factory = state_repo_factory
        self.integrity_repo_factory = integrity_repo_factory
        self.vector_store_factory = vector_store_factory
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
            crud_repo = self.crud_repo_factory(db)
            doc = await crud_repo.get(doc_id)
            if doc is None:
                raise RAGException(f"Document not found: {doc_id}")
            retrieval_scope = getattr(doc, "retrieval_scope", "GLOBAL") or "GLOBAL"
            scope_id = getattr(doc, "scope_id", None)
            await db.commit()

        # 1. UPLOADING
        await progress_callback("UPLOADING", 5, 0, 0)
        file_bytes = await self.storage.get_bytes(storage_key)

        # 2. PARSING
        t_parse = time.monotonic()
        await progress_callback("PARSING", 10, 0, 0)
        if not self.parser:
            raise ValueError("Parser is required for this stage")
        raw_text = await self.parser.parse_bytes(file_bytes, file_type)

        # 2.5 VISION PROCESSING (MUST BE DONE BEFORE NORMALIZATION!)
        import re
        import base64
        
        # Regex to find ![image_base64_extract](data:image/ext;base64,...)
        img_pattern = re.compile(r'!\[image_base64_extract\]\(data:image/[^;]+;base64,([^)]+)\)')
        matches = img_pattern.findall(raw_text)
        
        if matches and self.vision_provider:
            max_images = self.settings.VISION_MAX_IMAGES_PER_DOC
            process_matches = matches[:max_images]
                
            image_bytes_list = []
            for b64 in process_matches:
                try:
                    image_bytes_list.append(base64.b64decode(b64))
                except Exception as e:
                    logger.warning(f"Failed to decode base64 image: {e}")
            
            if image_bytes_list:
                descriptions = await self.vision_provider.describe_batch(image_bytes_list)
                
                # Replace the matches in the raw string before normalization
                def replace_img(match):
                    b64 = match.group(1)
                    if b64 in process_matches:
                        idx = process_matches.index(b64)
                        desc = descriptions[idx]
                        return f"\n[Visual content: {desc}]\n"
                    return "[Image omitted - exceeded max limit]"
                
                raw_text = img_pattern.sub(replace_img, raw_text)

        # Remove any remaining raw base64 images that lacked provider or exceeded max
        raw_text = img_pattern.sub("[Image omitted]", raw_text)
        
        # 3. NORMALIZATION (Safe to do now, no Base64 to corrupt or explode tokens)
        normalized = normalize_text(raw_text)

        if len(normalized.strip()) == 0:
            raise EmptyDocumentError("Document parsed to empty text")

        content_hash = compute_content_hash(normalized)

        async with self.db_session_factory() as db:
            crud_repo = self.crud_repo_factory(db)
            await crud_repo.update_content_hash(doc_id, content_hash)
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
        import asyncio

        t_chunk = time.monotonic()
        await progress_callback("CHUNKING", 25, 0, 0)
        if not self.chunker:
            raise ValueError("Chunker is required for this stage")
        chunks_text = await asyncio.to_thread(self.chunker.chunk, normalized)

        total_chunks = len(chunks_text)
        if total_chunks == 0:
            raise EmptyDocumentError("Document chunked to 0 chunks")

        if total_chunks > self.settings.MAX_CHUNKS_PER_DOCUMENT:
            raise ChunkLimitExceeded(
                f"Document exceeds {self.settings.MAX_CHUNKS_PER_DOCUMENT} chunks"
            )

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

        async with self.db_session_factory() as db:
            integrity_repo = self.integrity_repo_factory(db)
            next_version = await integrity_repo.get_next_chunk_version(doc_id)

        processed = 0
        batch_size = self.settings.EMBEDDING_BATCH_SIZE

        for i in range(0, total_chunks, batch_size):
            if await cancellation_check():
                await self.cleanup_failed_job(doc_id, next_version, storage_key)
                raise IngestionCancelledException()

            batch_texts = chunks_text[i : i + batch_size]

            # Embed outside transaction
            if not self.embedder:
                raise ValueError("Embedder is required for this stage")
            embeddings = await self.embedder.embed_batch(batch_texts)

            # Index batch in short transaction
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
                    chunk_version=next_version,
                    is_active=False,  # Shadow indexing
                    retrieval_scope=retrieval_scope,
                    scope_id=scope_id,
                )
                chunks_to_store.append(chunk)

            async with self.db_session_factory() as db:
                vector_store = self.vector_store_factory(db)
                await vector_store.store_chunks_batch(chunks_to_store, embeddings)
                await db.commit()

            processed += len(batch_texts)
            progress = 50 + int((processed / total_chunks) * 35)
            await progress_callback("EMBEDDING", progress, processed, total_chunks)

        logger.info(
            {
                **log_ctx,
                "event": "stage_complete",
                "stage": "EMBEDDING",
                "duration_ms": int((time.monotonic() - t_embed) * 1000),
                "throughput_cps": round(total_chunks / (time.monotonic() - t_embed), 2),
            }
        )

        # 5. ATOMIC ACTIVATION
        t_activate = time.monotonic()
        await progress_callback("INDEXING", 90, processed, total_chunks)

        if await cancellation_check():
            await self.cleanup_failed_job(doc_id, next_version, storage_key)
            raise IngestionCancelledException()

        async with self.db_session_factory() as db:
            integrity_repo = self.integrity_repo_factory(db)
            rows = await integrity_repo.activate_chunk_version(doc_id, next_version, total_chunks)
            if rows == 0:
                # Activation aborted (e.g. document was CANCELLED mid-activation)
                await self.cleanup_failed_job(doc_id, next_version, storage_key)
                raise IngestionCancelledException()
            await db.commit()

        logger.info(
            {
                **log_ctx,
                "event": "stage_complete",
                "stage": "INDEXING",
                "duration_ms": int((time.monotonic() - t_activate) * 1000),
            }
        )

        # 6. COMPLETE
        async with self.db_session_factory() as db:
            integrity_repo = self.integrity_repo_factory(db)
            state_repo = self.state_repo_factory(db)
            await integrity_repo.delete_inactive_chunks(doc_id, active_version=next_version)
            await state_repo.update_progress(doc_id, "COMPLETE", 100, total_chunks, total_chunks)
            await state_repo.mark_completed(doc_id)
            await db.commit()

    async def cleanup_failed_job(self, doc_id: str, version: int | None, storage_key: str) -> None:
        """Cleans up completely on cancellation or permanent failure (zero retrieval pollution)."""
        has_other_chunks = False
        async with self.db_session_factory() as db:
            integrity_repo = self.integrity_repo_factory(db)
            if version is not None:
                await integrity_repo.delete_chunks_by_version(doc_id, version)
            else:
                await integrity_repo.delete_all_chunks(doc_id)
            has_other_chunks = await integrity_repo.has_any_chunks(doc_id)
            await db.commit()

        if not has_other_chunks and await self.storage.exists(storage_key):
            await self.storage.delete(storage_key)
