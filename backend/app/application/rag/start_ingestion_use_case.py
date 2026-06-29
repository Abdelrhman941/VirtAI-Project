import asyncio
import uuid
from collections.abc import AsyncIterable
from datetime import datetime, timedelta, timezone
from typing import Any

from loguru import logger
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.rag.stage_machine import IngestionStage
from app.domain.storage.ports import StorageProvider
from app.infrastructure.db.models import Document, DocumentChunk
from app.infrastructure.db.repositories.document_repository import DocumentRepository
from app.shared.ids import parse_uuid


class StartIngestionUseCase:
    def __init__(self, db: AsyncSession, storage: StorageProvider, arq_pool: Any) -> None:
        self.db = db
        self.storage = storage
        self.arq_pool = arq_pool

    async def execute(
        self,
        user_id: str,
        session_id: str | None,
        file_sha256: str,
        file_size: int,
        safe_filename: str,
        ext: str,
        file_stream: AsyncIterable[bytes],
    ) -> dict[str, Any]:
        crud_repo = DocumentRepository(self.db)
        state_repo = DocumentRepository(self.db)

        # 1. Check dedup and stale logic
        existing = await crud_repo.find_by_sha256(user_id, file_sha256, session_id)
        if existing:
            is_stale = False
            if existing.upload_date:
                upload_dt = existing.upload_date
                if upload_dt.tzinfo is None:
                    upload_dt = upload_dt.replace(tzinfo=timezone.utc)
                if (
                    datetime.now(timezone.utc) - upload_dt > timedelta(minutes=5)
                    and existing.current_stage != IngestionStage.COMPLETE
                ):
                    is_stale = True

            if existing.current_stage == IngestionStage.FAILED or is_stale:
                logger.info(f"Deleting dead/failed document {existing.id} for fresh re-upload")
                old_storage_key = await crud_repo.delete_with_cascade(str(existing.id), user_id)
                await self.db.commit()
                if old_storage_key and await self.storage.exists(old_storage_key):
                    await self.storage.delete(old_storage_key)
                existing = None
            elif existing.current_stage == IngestionStage.COMPLETE:
                if session_id and str(existing.scope_id) != session_id:
                    parsed_session_id = parse_uuid(session_id)
                    if parsed_session_id:
                        await self.db.execute(
                            update(Document)
                            .where(Document.id == existing.id)
                            .values(scope_id=parsed_session_id, retrieval_scope="SESSION")
                        )
                        await self.db.execute(
                            update(DocumentChunk)
                            .where(DocumentChunk.document_id == existing.id)
                            .values(scope_id=parsed_session_id, retrieval_scope="SESSION")
                        )
                        await self.db.commit()

                return {
                    "id": str(existing.id),
                    "status": "COMPLETE",
                    "message": "Document already ingested",
                    "http_status_code": 200,
                }
            elif existing:
                return {
                    "id": str(existing.id),
                    "status": existing.current_stage,
                    "message": "Document currently processing",
                    "http_status_code": 202,
                }

        # 2. Create DB record (QUEUED) ATOMICALLY
        doc_id_val = str(uuid.uuid4())
        storage_key = f"{user_id}/{doc_id_val}.{ext}"

        try:
            doc = await crud_repo.create(
                id=doc_id_val,
                user_id=user_id,
                filename=safe_filename,
                file_type=ext,
                session_id=session_id,
                document_sha256=file_sha256,
                file_size=file_size,
                storage_key=storage_key,
            )
            await self.db.commit()
        except IntegrityError as e:
            await self.db.rollback()
            logger.info(f"Concurrent duplicate detected for SHA256 {file_sha256[:12]}…")
            winner = await crud_repo.find_by_sha256(user_id, file_sha256, session_id)
            if winner:
                return {
                    "id": str(winner.id),
                    "status": winner.current_stage,
                    "message": "Document already exists (concurrent upload resolved)",
                    "http_status_code": 200,
                }
            raise ValueError(
                "Conflict: A document with this SHA256 already exists in the requested scope."
            ) from e

        # 3. Write to storage
        try:
            await self.storage.save(
                storage_key, file_stream, content_type="application/octet-stream"
            )
        except asyncio.CancelledError:
            logger.warning(f"Client disconnected while saving file {doc.id}")
            raise
        except Exception as e:
            logger.error(f"Storage failed for {doc.id}: {e}")
            await state_repo.mark_failed(str(doc.id), f"Storage error: {e!s}")
            await self.db.commit()
            raise RuntimeError("Internal server error saving file") from e

        # 4. Enqueue to ARQ
        try:
            job = await self.arq_pool.enqueue_job(
                "run_ingestion_task",
                _queue_name="ingestion",
                doc_id=str(doc.id),
                user_id=user_id,
                filename=safe_filename,
                file_type=ext,
                upload_source="SETUP",
                storage_key=storage_key,
            )
            if not job:
                raise RuntimeError("Job enqueue returned None")
        except asyncio.CancelledError:
            logger.warning(f"Client disconnected while enqueueing job for {doc.id}")
            try:
                await self.storage.delete(storage_key)
            except Exception:
                pass
            raise
        except Exception as e:
            logger.error(f"Failed to enqueue job for {doc.id}: {e}")
            await state_repo.mark_failed(str(doc.id), f"Queue error: {e!s}")
            await self.db.commit()
            await self.storage.delete(storage_key)
            raise RuntimeError("Internal server error enqueueing job") from e

        return {
            "id": str(doc.id),
            "status": "QUEUED",
            "message": "Document ingestion started",
            "http_status_code": 202,
        }
