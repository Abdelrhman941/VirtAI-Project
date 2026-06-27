from __future__ import annotations

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.rag.entities import DocumentStatusDict
from app.domain.rag.stage_machine import IngestionStage, assert_transition
from app.infrastructure.db.models import Document
from app.infrastructure.db.repositories.document_crud_repository import (
    DomainDocument,
    _now,
    _to_domain,
)
from app.shared.ids import require_uuid


class IngestionStateRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _emit_doc_status(self, doc_uuid: Any) -> None:
        from app.infrastructure.cache.redis_client import get_redis_or_none
        import json
        redis = get_redis_or_none()
        if not redis: return

        stmt = select(Document).where(Document.id == doc_uuid)
        result = await self.db.execute(stmt)
        doc = result.scalar_one_or_none()
        if not doc or not doc.scope_id: return

        payload = {
            "event": "doc_status",
            "session_id": str(doc.scope_id),
            "data": {
                "document_id": str(doc.id),
                "status": doc.status,
                "current_stage": doc.current_stage,
                "progress_pct": doc.progress_pct,
                "processed_chunks": doc.processed_chunks,
                "total_chunks": doc.total_chunks,
                "error_message": doc.error_message,
                "filename": doc.filename,
            }
        }
        await redis.publish("virtai:ws:events:doc_status", json.dumps(payload))

    async def update_status(
        self, document_id: str, status: str, chunk_count: int = 0
    ) -> DomainDocument | None:
        stmt = (
            update(Document)
            .where(Document.id == require_uuid(document_id, field_name="document_id"))
            .values(status=status, chunk_count=chunk_count)
            .returning(Document)
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        doc = result.scalar_one_or_none()
        if doc:
            await self._emit_doc_status(doc.id)
        return _to_domain(doc) if doc else None

    async def update_progress(
        self, document_id: str, stage: str, pct: int, processed: int, total: int
    ) -> None:
        doc_uuid = require_uuid(document_id, field_name="document_id")
        stmt_get = select(Document.current_stage).where(Document.id == doc_uuid)
        result = await self.db.execute(stmt_get)
        current_stage = result.scalar_one_or_none()
        if not current_stage:
            return

        if current_stage != stage:
            assert_transition(IngestionStage(current_stage), IngestionStage(stage))

        stmt = (
            update(Document)
            .where(Document.id == doc_uuid)
            .values(
                current_stage=stage,
                status=stage,
                progress_pct=pct,
                processed_chunks=processed,
                total_chunks=total,
            )
        )
        await self.db.execute(stmt)
        await self.db.flush()
        await self._emit_doc_status(doc_uuid)

    async def mark_failed(self, document_id: str, error_msg: str, is_retryable: bool) -> None:
        doc_uuid = require_uuid(document_id, field_name="document_id")
        stmt_get = select(Document.current_stage).where(Document.id == doc_uuid)
        result = await self.db.execute(stmt_get)
        current_stage = result.scalar_one_or_none()
        if not current_stage:
            return

        assert_transition(IngestionStage(current_stage), IngestionStage.FAILED)

        stmt = (
            update(Document)
            .where(Document.id == doc_uuid)
            .values(
                current_stage=IngestionStage.FAILED.value,
                status=IngestionStage.FAILED.value,
                error_message=error_msg,
                retry_count=Document.retry_count + (1 if is_retryable else 0),
            )
        )
        await self.db.execute(stmt)
        await self.db.flush()
        await self._emit_doc_status(doc_uuid)

    async def mark_cancelled(self, document_id: str) -> None:
        doc_uuid = require_uuid(document_id, field_name="document_id")
        stmt_get = select(Document.current_stage).where(Document.id == doc_uuid)
        result = await self.db.execute(stmt_get)
        current_stage = result.scalar_one_or_none()
        if not current_stage:
            return

        assert_transition(IngestionStage(current_stage), IngestionStage.CANCELLED)

        stmt = (
            update(Document)
            .where(Document.id == doc_uuid)
            .values(
                current_stage=IngestionStage.CANCELLED.value,
                status=IngestionStage.CANCELLED.value,
            )
        )
        await self.db.execute(stmt)
        await self.db.flush()
        await self._emit_doc_status(doc_uuid)

    async def mark_completed(self, document_id: str) -> None:
        stmt = (
            update(Document)
            .where(Document.id == require_uuid(document_id, field_name="document_id"))
            .values(completed_at=_now())
        )
        await self.db.execute(stmt)
        await self.db.flush()
        await self._emit_doc_status(require_uuid(document_id, field_name="document_id"))

    async def get_status(self, document_id: str, user_id: str) -> DocumentStatusDict | None:
        stmt = select(Document).where(
            Document.id == require_uuid(document_id, field_name="document_id"),
            Document.user_id == require_uuid(user_id, field_name="user_id"),
        )
        result = await self.db.execute(stmt)
        doc = result.scalar_one_or_none()
        if not doc:
            return None
        return {
            "id": str(doc.id),
            "filename": doc.filename,
            "status": doc.status,
            "current_stage": doc.current_stage,
            "progress_pct": doc.progress_pct,
            "processed_chunks": doc.processed_chunks,
            "total_chunks": doc.total_chunks,
            "started_at": doc.started_at.isoformat() if doc.started_at else None,
            "completed_at": doc.completed_at.isoformat() if doc.completed_at else None,
            "upload_source": doc.upload_source,
            "error_message": doc.error_message,
        }

    async def count_active_jobs(self, user_id: str) -> int:
        terminal = ["COMPLETE", "FAILED", "CANCELLED"]
        stmt = (
            select(func.count(Document.id))
            .where(Document.user_id == require_uuid(user_id, field_name="user_id"))
            .where(Document.current_stage.notin_(terminal))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one() or 0

    async def get_stage(self, document_id: str) -> str | None:
        stmt = select(Document.current_stage).where(
            Document.id == require_uuid(document_id, field_name="document_id")
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
