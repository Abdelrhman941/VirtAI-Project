import asyncio
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, cast

import httpx
import redis.asyncio as redis
from arq import Retry  # type: ignore[import-not-found]
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.rag.stage_machine import IngestionStage
from app.infrastructure.db.database import AsyncSessionLocal
from app.infrastructure.db.repositories.document_repository import DocumentRepository
from app.infrastructure.vector.pgvector_store import PGVectorStore
from app.infrastructure.worker.retry_classifier import classify
from app.shared.errors import IngestionCancelledException
from app.application.rag.ingest_document import IngestDocumentUseCase
from app.infrastructure.rag.pdf_markdown_extractor import PDFMarkdownExtractor
from app.infrastructure.rag.smart_chunker import SmartChunker
from app.infrastructure.rag.image_markdown_extractor import ImageMarkdownExtractor
from app.infrastructure.rag.text_extractor import TextExtractor
from app.shared.config import get_settings
from app.infrastructure.db.models import Document
from sqlalchemy import select
from app.infrastructure.cache.pubsub import publish_doc_progress

LOCK_TTL = 620  # job_timeout (600) + 20s buffer


@asynccontextmanager
async def get_short_session() -> AsyncGenerator[AsyncSession, None]:
    """Helper to get a short-lived database session without FastAPI dependency injection."""
    async with AsyncSessionLocal() as session:
        yield session


async def run_ingestion_task(
    ctx: dict,
    doc_id: str,
    user_id: str,
    filename: str,
    file_type: str,
    upload_source: str,
    storage_key: str,
) -> None:
    job_id = ctx["job_id"]
    redis_client: redis.Redis = ctx["redis"]
    lock_key = f"ingestion_lock:{doc_id}"

    log_ctx = {
        "ingestion_job_id": job_id,
        "document_id": doc_id,
        "user_id": user_id,
        "request_id": job_id,  # ARQ jobs have their own IDs, we use it as request_id if none exists
    }

    try:
        acquired = await redis_client.set(lock_key, job_id, nx=True, ex=LOCK_TTL)
        if not acquired:
            logger.warning({**log_ctx, "event": "job_skipped_duplicate"})
            return  # Another worker holds the lock — silent exit

        await _run_ingestion(ctx, doc_id, user_id, filename, file_type, storage_key, log_ctx)

    except asyncio.CancelledError as e:
        logger.warning({**log_ctx, "event": "ingestion_cancelled_by_arq", "error": str(e)})
        try:
            use_case = IngestDocumentUseCase(
                storage=ctx["storage"],
                parser=None,
                chunker=None,
                embedder=None,
                vision_provider=None,
                db_session_factory=cast("Any", get_short_session),
                document_repo_factory=DocumentRepository,
                vector_store_factory=PGVectorStore,
            )
            await use_case.cleanup_failed_job(doc_id, None, storage_key)
        except Exception as cleanup_err:
            logger.error({**log_ctx, "event": "cleanup_failed", "error": str(cleanup_err)})

        async with get_short_session() as db:
            doc_repo = DocumentRepository(db)
            await doc_repo.mark_failed(doc_id, "Job timed out or was cancelled by worker", False)
            await db.commit()
        raise

    except IngestionCancelledException:
        logger.info({**log_ctx, "event": "ingestion_cancelled"})
        # The usecase already cleans up. We just mark as CANCELLED.
        async with get_short_session() as db:
            doc_repo = DocumentRepository(db)
            await doc_repo.mark_cancelled(doc_id)
            await db.commit()

    except Exception as e:
        is_retryable, reason = classify(e)

        error_msg = str(e)
        if reason == "Quota_Exhausted_Fatal":
            error_msg = "AI Quota Exhausted (Limit Reached). Please try again later."
        elif reason == "Invalid_PDF_Format":
            error_msg = "The file appears to be corrupted, empty, or not a valid PDF. Please check the file and try again."

        logger.error(
            {
                **log_ctx,
                "event": "ingestion_failed",
                "retryable": is_retryable,
                "reason": reason,
                "error": error_msg,
            }
        )

        # If not retryable or we are aborting, clean up first
        if not is_retryable:
            logger.warning({**log_ctx, "event": "cleaning_up_failed_job"})
            try:
                # Instantiate use case just to call cleanup_failed_job
                use_case = IngestDocumentUseCase(
                    storage=ctx["storage"],
                    parser=None,
                    chunker=None,
                    embedder=None,
                    vision_provider=None,
                    db_session_factory=cast("Any", get_short_session),
                    document_repo_factory=DocumentRepository,
                    vector_store_factory=PGVectorStore,
                )
                await use_case.cleanup_failed_job(doc_id, None, storage_key)
            except Exception as cleanup_err:
                logger.error({**log_ctx, "event": "cleanup_failed", "error": str(cleanup_err)})

        async with get_short_session() as db:
            doc_repo = DocumentRepository(db)
            await doc_repo.mark_failed(doc_id, error_msg, is_retryable)
            await db.commit()

        if is_retryable:
            # Handle rate limiting / backoff explicitly
            if reason == "Rate_Limit_Retry":
                import random
                job_try = ctx.get("job_try", 1)
                # Exponential backoff: min(300, 15 * (2 ** (job_try - 1))) + jitter
                base_defer = min(300, 15 * (2 ** (job_try - 1)))
                jitter = random.uniform(0, 5)
                defer = int(base_defer + jitter)
                raise Retry(defer=defer) from e
            if isinstance(e, httpx.HTTPStatusError) and e.response.status_code in (429, 503):
                retry_after = e.response.headers.get("retry-after")
                defer = int(retry_after) if retry_after and retry_after.isdigit() else 30
                raise Retry(defer=defer) from e
            raise  # ARQ will retry
    finally:
        # Only release if we own the lock
        try:
            current = await redis_client.get(lock_key)
            if current and current.decode() == job_id:
                await redis_client.delete(lock_key)
        except Exception as e:
            logger.error({**log_ctx, "event": "lock_release_failed", "error": str(e)})


async def sweep_stalled_jobs(ctx: dict) -> None:
    """Cron task to identify and clean up orphaned jobs from ungracefully killed workers."""
    threshold = datetime.now(timezone.utc) - timedelta(seconds=LOCK_TTL)
    terminal = ["COMPLETE", "FAILED", "CANCELLED"]

    async with AsyncSessionLocal() as db:
        doc_repo = DocumentRepository(db)

        # Find all documents that are processing but haven't completed within TTL
        stmt = select(Document.id, Document.storage_key).where(
            Document.current_stage.notin_(terminal), Document.started_at < threshold
        )
        result = await db.execute(stmt)
        stalled_docs = result.all()

        for doc_id, storage_key in stalled_docs:
            logger.info(f"Sweeping stalled job for document {doc_id}")
            # Mark as failed
            await doc_repo.mark_failed(
                str(doc_id),
                error_msg="Job stalled and timed out (Worker crash/OOM).",
                is_retryable=False,
            )
            await doc_repo.delete_all_chunks(str(doc_id))

        await db.commit()


async def _run_ingestion(
    ctx: dict,
    doc_id: str,
    user_id: str,
    filename: str,
    file_type: str,
    storage_key: str,
    log_ctx: dict,
) -> None:
    embedder = ctx["embedder"]
    storage = ctx["storage"]

    async with get_short_session() as db:
        doc_repo = DocumentRepository(db)
        doc = await doc_repo.get(doc_id)
        if not doc:
            logger.warning({**log_ctx, "event": "document_not_found"})
            return

        if doc.current_stage == IngestionStage.CANCELLED:
            logger.info({**log_ctx, "event": "job_aborted_cancelled"})
            return

        if doc.current_stage == IngestionStage.COMPLETE:
            logger.info({**log_ctx, "event": "job_aborted_complete"})
            return

        queue_wait_ms = int((datetime.now(timezone.utc) - doc.upload_date).total_seconds() * 1000)
        logger.info({**log_ctx, "event": "job_started", "queue_wait_ms": queue_wait_ms})

        scope_id_str = str(doc.scope_id) if doc.scope_id else None

    t0 = time.monotonic()

    # Progress Callback
    async def progress_callback(stage: str, pct: int, processed: int, total: int) -> None:
        redis_client = ctx["redis"]
        await redis_client.set(f"doc_progress:{doc_id}", pct, ex=3600)
        async with get_short_session() as db:
            doc_repo = DocumentRepository(db)
            await doc_repo.update_progress(doc_id, stage, pct, processed, total)
            await db.commit()

        await publish_doc_progress(user_id, scope_id_str, doc_id, stage, pct)

    # Cancellation Check
    async def cancellation_check() -> bool:
        async with get_short_session() as db:
            doc_repo = DocumentRepository(db)
            doc = await doc_repo.get(doc_id)
            return doc is not None and getattr(doc, "current_stage", None) == IngestionStage.CANCELLED.value

    settings = get_settings()
    chunker = SmartChunker(chunk_size=settings.CHUNK_SIZE, overlap_size=settings.CHUNK_OVERLAP)

    if file_type in ("png", "jpg", "jpeg", "webp"):
        parser = ImageMarkdownExtractor(vision_provider=ctx.get("vision_provider"))
    elif file_type in ("txt", "md", "csv", "json"):
        parser = TextExtractor()
    elif file_type == "pdf":
        parser = PDFMarkdownExtractor()
    else:
        logger.error(f"Unsupported file type detected: {file_type}")
        raise ValueError(f"Unsupported file format: {file_type}")

    # Instantiate use case
    use_case = IngestDocumentUseCase(
        storage=storage,
        parser=parser,
        chunker=cast("Any", chunker),
        embedder=embedder,
        vision_provider=ctx.get("vision_provider"),
        db_session_factory=cast("Any", get_short_session),
        document_repo_factory=DocumentRepository,
        vector_store_factory=PGVectorStore,
    )

    # Execute
    await use_case.execute(
        doc_id=doc_id,
        user_id=user_id,
        filename=filename,
        file_type=file_type,
        storage_key=storage_key,
        progress_callback=progress_callback,
        cancellation_check=cancellation_check,
        log_ctx=log_ctx,
    )

    duration_ms = int((time.monotonic() - t0) * 1000)
    logger.info({**log_ctx, "event": "ingestion_complete", "duration_ms": duration_ms})
