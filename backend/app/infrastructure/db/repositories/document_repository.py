from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Protocol
from uuid import UUID

from sqlalchemy import update, select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import Document, DocumentChunk
from app.shared.ids import require_uuid


class DocumentStatus(str, Enum):
    QUEUED = "QUEUED"
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class DomainEvent(Protocol):
    pass


@dataclass
class DocumentStateChanged:
    document_id: UUID
    new_status: DocumentStatus
    timestamp: datetime


@dataclass
class DocumentFailed:
    document_id: UUID
    error_message: str
    timestamp: datetime


def _now() -> datetime:
    return datetime.now(timezone.utc)


class DocumentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_document(
        self,
        user_id: UUID | str,
        filename: str,
        file_type: str,
        retrieval_scope: str = "GLOBAL",
    ) -> tuple[Document, list[DomainEvent]]:
        uid = require_uuid(user_id)
        
        doc = Document(
            user_id=uid,
            filename=filename,
            file_type=file_type,
            status=DocumentStatus.PENDING.value,
            retrieval_scope=retrieval_scope,
            upload_date=_now(),
        )
        self.db.add(doc)
        await self.db.flush()
        
        event = DocumentStateChanged(
            document_id=doc.id,
            new_status=DocumentStatus.PENDING,
            timestamp=_now()
        )
        return doc, [event]

    async def create(
        self,
        id: str,
        user_id: str,
        filename: str,
        file_type: str,
        session_id: str | None,
        document_sha256: str,
        file_size: int,
        storage_key: str,
    ) -> Document:
        doc = Document(
            id=require_uuid(id),
            user_id=require_uuid(user_id),
            filename=filename,
            file_type=file_type,
            document_sha256=document_sha256,
            file_size=file_size,
            storage_key=storage_key,
            status=DocumentStatus.QUEUED.value,
            current_stage=DocumentStatus.QUEUED.value,
            upload_date=_now(),
        )
        if session_id:
            doc.scope_id = require_uuid(session_id)
            doc.retrieval_scope = "SESSION"
        else:
            doc.retrieval_scope = "GLOBAL"
            
        self.db.add(doc)
        await self.db.flush()
        return doc

    async def update_status(
        self, document_id: UUID | str, new_status: DocumentStatus
    ) -> tuple[Document, list[DomainEvent]]:
        doc_uuid = require_uuid(document_id)
        
        stmt = (
            update(Document)
            .where(Document.id == doc_uuid)
            .values(status=new_status.value)
            .returning(Document)
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        
        doc = result.scalar_one_or_none()
        if not doc:
            raise ValueError(f"Document {doc_uuid} not found")
            
        doc.status = new_status
            
        event = DocumentStateChanged(
            document_id=doc_uuid,
            new_status=new_status,
            timestamp=_now()
        )
        return doc, [event]

    async def mark_failed(
        self, document_id: UUID | str, error_message: str, is_retryable: bool = False
    ) -> tuple[Document, list[DomainEvent]]:
        doc_uuid = require_uuid(document_id)
        
        stmt = (
            update(Document)
            .where(Document.id == doc_uuid)
            .values(status=DocumentStatus.FAILED.value, error_message=error_message)
            .returning(Document)
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        
        doc = result.scalar_one_or_none()
        if not doc:
            raise ValueError(f"Document {doc_uuid} not found")
            
        doc.status = DocumentStatus.FAILED
        doc.error_message = error_message
            
        event = DocumentFailed(
            document_id=doc_uuid,
            error_message=error_message,
            timestamp=_now()
        )
        return doc, [event]

    async def get(self, document_id: UUID | str) -> Document | None:
        doc_uuid = require_uuid(document_id)
        stmt = select(Document).where(Document.id == doc_uuid)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_user(self, user_id: UUID | str, session_id: str | None = None) -> list[Document]:
        uid = require_uuid(user_id)
        stmt = select(Document).where(Document.user_id == uid)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def find_by_sha256(self, user_id: UUID | str, file_sha256: str, session_id: str | None = None) -> Document | None:
        uid = require_uuid(user_id)
        stmt = select(Document).where(
            Document.user_id == uid,
            Document.document_sha256 == file_sha256
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_active(self, user_id: UUID | str, session_id: str | None = None) -> list[Document]:
        uid = require_uuid(user_id)
        stmt = select(Document).where(
            Document.user_id == uid,
            Document.status.in_([DocumentStatus.PENDING.value, DocumentStatus.PROCESSING.value, DocumentStatus.QUEUED.value])
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_status(self, document_id: UUID | str, user_id: UUID | str) -> dict | None:
        doc_uuid = require_uuid(document_id)
        uid = require_uuid(user_id)
        stmt = select(Document).where(Document.id == doc_uuid, Document.user_id == uid)
        result = await self.db.execute(stmt)
        doc = result.scalar_one_or_none()
        if not doc:
            return None
        return {
            "status": doc.status,
            "current_stage": getattr(doc, "current_stage", doc.status),
            "progress_pct": getattr(doc, "progress_pct", 0)
        }

    async def count_active_jobs(self, user_id: UUID | str) -> int:
        uid = require_uuid(user_id)
        stmt = select(func.count(Document.id)).where(
            Document.user_id == uid,
            Document.status.in_([DocumentStatus.PENDING.value, DocumentStatus.PROCESSING.value, DocumentStatus.QUEUED.value])
        )
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    async def count_active_jobs_in_scope(
        self, user_id: UUID | str, session_id: str | None = None
    ) -> int:
        """Count active ingestion jobs for a user, scoped to a session if provided.

        When session_id is given, counts only SESSION-scoped documents whose
        scope_id matches the session.  Falls back to the global user-level count
        when session_id is None.
        """
        uid = require_uuid(user_id)
        active_statuses = [
            DocumentStatus.PENDING.value,
            DocumentStatus.PROCESSING.value,
            DocumentStatus.QUEUED.value,
        ]

        if session_id:
            sid = require_uuid(session_id)
            stmt = select(func.count(Document.id)).where(
                Document.user_id == uid,
                Document.retrieval_scope == "SESSION",
                Document.scope_id == sid,
                Document.status.in_(active_statuses),
            )
        else:
            stmt = select(func.count(Document.id)).where(
                Document.user_id == uid,
                Document.status.in_(active_statuses),
            )

        result = await self.db.execute(stmt)
        return result.scalar() or 0

    async def mark_cancelled(self, document_id: UUID | str) -> None:
        doc_uuid = require_uuid(document_id)
        stmt = update(Document).where(Document.id == doc_uuid).values(
            status=DocumentStatus.FAILED.value,
            current_stage="CANCELLED"
        )
        await self.db.execute(stmt)

    async def update_progress(self, document_id: UUID | str, stage: str, pct: int, processed: int, total: int) -> None:
        doc_uuid = require_uuid(document_id)
        stmt = update(Document).where(Document.id == doc_uuid).values(
            current_stage=stage,
            progress_pct=pct,
            processed_chunks=processed,
            total_chunks=total
        )
        await self.db.execute(stmt)

    async def delete_all_chunks(self, document_id: UUID | str) -> None:
        doc_uuid = require_uuid(document_id)
        stmt = delete(DocumentChunk).where(DocumentChunk.document_id == doc_uuid)
        await self.db.execute(stmt)

    async def delete_chunks_by_version(self, document_id: UUID | str, version: int) -> None:
        doc_uuid = require_uuid(document_id)
        stmt = delete(DocumentChunk).where(
            DocumentChunk.document_id == doc_uuid,
            DocumentChunk.chunk_version == version
        )
        await self.db.execute(stmt)

    async def delete_with_cascade(self, document_id: UUID | str, user_id: UUID | str) -> str | None:
        doc_uuid = require_uuid(document_id)
        uid = require_uuid(user_id)
        stmt = select(Document).where(Document.id == doc_uuid, Document.user_id == uid)
        doc = (await self.db.execute(stmt)).scalar_one_or_none()
        if not doc:
            return None
        storage_key = getattr(doc, "storage_key", None)
        await self.delete_all_chunks(doc_uuid)
        await self.db.execute(delete(Document).where(Document.id == doc_uuid))
        return storage_key
