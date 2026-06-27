from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import Document
from app.shared.ids import require_uuid


@dataclass
class DomainDocument:
    id: UUID | None
    user_id: UUID
    filename: str
    file_type: str
    upload_date: datetime
    chunk_count: int
    status: str
    current_stage: str
    storage_key: str | None
    progress_pct: int
    processed_chunks: int
    total_chunks: int
    error_message: str | None
    retrieval_scope: str
    scope_id: UUID | None
    file_size: int


def _to_domain(doc: Document) -> DomainDocument:
    return DomainDocument(
        id=doc.id,
        user_id=doc.user_id,
        filename=doc.filename,
        file_type=doc.file_type,
        upload_date=doc.upload_date,
        chunk_count=doc.chunk_count,
        status=doc.status,
        current_stage=getattr(doc, "current_stage", "QUEUED"),
        storage_key=getattr(doc, "storage_key", None),
        progress_pct=getattr(doc, "progress_pct", 0),
        processed_chunks=getattr(doc, "processed_chunks", 0),
        total_chunks=getattr(doc, "total_chunks", 0),
        error_message=getattr(doc, "error_message", None),
        retrieval_scope=getattr(doc, "retrieval_scope", "GLOBAL"),
        scope_id=getattr(doc, "scope_id", None),
        file_size=getattr(doc, "file_size", 0),
    )


def _now() -> datetime:
    return datetime.now(timezone.utc)


class DocumentCrudRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        user_id: str,
        filename: str,
        file_type: str,
        session_id: str | None = None,
        id: str | None = None,
        document_sha256: str | None = None,
        file_size: int = 0,
        storage_key: str | None = None,
    ) -> DomainDocument:

        scope = "SESSION" if session_id else "GLOBAL"
        s_id = require_uuid(session_id, field_name="session_id") if session_id else None
        doc_id = require_uuid(id, field_name="id") if id else None

        async with self.db.begin():
            doc = Document(
                id=doc_id,
                user_id=require_uuid(user_id, field_name="user_id"),
                filename=filename,
                file_type=file_type,
                status="QUEUED",
                current_stage="QUEUED",
                upload_date=_now(),
                started_at=_now(),
                retrieval_scope=scope,
                scope_id=s_id,
                document_sha256=document_sha256,
                file_size=file_size,
                storage_key=storage_key,
            )
            self.db.add(doc)
            await self.db.flush()
            await self.db.refresh(doc)
            return _to_domain(doc)

    async def get(self, document_id: str) -> DomainDocument | None:
        stmt = select(Document).where(
            Document.id == require_uuid(document_id, field_name="document_id")
        )
        result = await self.db.execute(stmt)
        doc = result.scalar_one_or_none()
        return _to_domain(doc) if doc else None

    async def list_by_user(
        self,
        user_id: str,
        status: str | None = None,
        limit: int = 100,
        session_id: str | None = None,
    ) -> Sequence[DomainDocument]:
        uid = require_uuid(user_id, field_name="user_id")
        stmt = select(Document).where(Document.user_id == uid)
        if status:
            stmt = stmt.where(Document.status == status)
        if session_id:
            s_id = require_uuid(session_id, field_name="session_id")
            stmt = stmt.where(Document.retrieval_scope == "SESSION", Document.scope_id == s_id)
        else:
            stmt = stmt.where(Document.retrieval_scope == "GLOBAL")

        stmt = stmt.order_by(Document.upload_date.desc()).limit(limit)
        result = await self.db.execute(stmt)
        return [_to_domain(d) for d in result.scalars().all()]

    async def delete(self, document_id: str) -> bool:
        async with self.db.begin():
            stmt = select(Document).where(
                Document.id == require_uuid(document_id, field_name="document_id")
            )
            result = await self.db.execute(stmt)
            doc = result.scalar_one_or_none()
            if doc:
                await self.db.delete(doc)
                await self.db.flush()
                return True
            return False

    async def delete_with_cascade(self, document_id: str, user_id: str) -> str | None:
        """Deletes a document explicitly. Returns the storage_key to be deleted from storage."""
        async with self.db.begin():
            stmt = select(Document).where(
                Document.id == require_uuid(document_id, field_name="document_id"),
                Document.user_id == require_uuid(user_id, field_name="user_id"),
            )
            result = await self.db.execute(stmt)
            doc = result.scalar_one_or_none()
            if not doc:
                return None
            storage_key = doc.storage_key
            await self.db.delete(doc)
            return storage_key

    async def find_by_sha256(
        self, user_id: str, sha256: str, session_id: str | None = None
    ) -> Document | None:
        stmt = select(Document).where(
            Document.user_id == require_uuid(user_id, field_name="user_id"),
            Document.document_sha256 == sha256,
        )
        if session_id:
            s_id = require_uuid(session_id, field_name="session_id")
            stmt = stmt.where(Document.retrieval_scope == "SESSION", Document.scope_id == s_id)
        else:
            stmt = stmt.where(Document.retrieval_scope == "GLOBAL")

        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def update_content_hash(self, document_id: str, content_hash: str) -> None:
        async with self.db.begin():
            stmt = (
                update(Document)
                .where(Document.id == require_uuid(document_id, field_name="document_id"))
                .values(normalized_content_hash=content_hash)
            )
            await self.db.execute(stmt)

    async def list_active(self, user_id: str, session_id: str | None = None) -> list[Document]:
        terminal = ["COMPLETE", "FAILED", "CANCELLED"]
        stmt = (
            select(Document)
            .where(Document.user_id == require_uuid(user_id, field_name="user_id"))
            .where(Document.current_stage.notin_(terminal))
        )
        if session_id:
            s_id = require_uuid(session_id, field_name="session_id")
            stmt = stmt.where(Document.retrieval_scope == "SESSION", Document.scope_id == s_id)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())
