from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Protocol
from uuid import UUID

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import Document
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
        self, document_id: UUID | str, error_message: str
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
