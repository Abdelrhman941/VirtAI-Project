"""
Chat repository using SQLAlchemy async.

Implements ChatRepositoryPort interface.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.chat.entities import ChatMessageDict, ChatSessionDict
from app.domain.chat.ports import ChatRepositoryPort
from app.infrastructure.db.models import ChatSession, Message
from app.shared.ids import require_uuid


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _derive_session_title(content: str, max_len: int = 30) -> str:
    return content.strip()[:max_len]


from app.domain.storage.ports import StorageProvider


class ChatRepository(ChatRepositoryPort):
    """SQLAlchemy implementation of chat repository."""

    def __init__(self, db: AsyncSession, storage_provider: StorageProvider):
        self.db = db
        self.storage_provider = storage_provider

    async def create_chat_session(
        self, user_id: str, title: str = "New Chat", session_id: str | None = None
    ) -> ChatSessionDict:
        """Create a new chat session."""
        session_uuid = require_uuid(session_id, field_name="session_id") if session_id else None
        user_uuid = require_uuid(user_id, field_name="user_id")
        session = ChatSession(
            id=session_uuid,
            user_id=user_uuid,
            title=title,
        )
        self.db.add(session)
        await self.db.flush()
        await self.db.refresh(session)
        return self._serialize_session(session)

    async def get_chat_session(self, session_id: str) -> ChatSessionDict | None:
        """Get a chat session by ID."""
        sid = require_uuid(session_id, field_name="session_id")
        stmt = select(ChatSession).where(ChatSession.id == sid)
        result = await self.db.execute(stmt)
        session = result.scalar_one_or_none()
        return self._serialize_session(session) if session else None

    async def update_chat_session_title(
        self, session_id: str, title: str
    ) -> ChatSessionDict | None:
        """Update a chat session title."""
        sid = require_uuid(session_id, field_name="session_id")
        cleaned_title = title.strip()[:255]
        if not cleaned_title:
            return await self.get_chat_session(session_id)

        await self.db.execute(
            update(ChatSession)
            .where(ChatSession.id == sid)
            .values(title=cleaned_title, updated_at=_now())
        )
        await self.db.flush()
        return await self.get_chat_session(session_id)

    async def list_user_sessions(self, user_id: str, limit: int = 50) -> list[ChatSessionDict]:
        """List sessions for a user, ordered by last_message_at desc.

        Phase 1: switched from updated_at to last_message_at so that title
        renames no longer corrupt session ordering.  updated_at is still
        stamped and kept — this change only affects the ORDER BY clause.
        """
        stmt = (
            select(ChatSession)
            .where(ChatSession.user_id == require_uuid(user_id, field_name="user_id"))
            .order_by(ChatSession.last_message_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        sessions = result.scalars().all()

        session_dicts = [self._serialize_session(s) for s in sessions]

        if not session_dicts:
            return session_dicts

        # Fetch documents tied to these sessions
        from app.infrastructure.db.models import Document

        session_ids = [s.id for s in sessions]
        doc_stmt = select(Document).where(
            Document.retrieval_scope == "SESSION", Document.scope_id.in_(session_ids)
        )
        doc_result = await self.db.execute(doc_stmt)
        documents = doc_result.scalars().all()

        # Group documents by scope_id
        from collections import defaultdict

        docs_by_session = defaultdict(list)
        for doc in documents:
            docs_by_session[str(doc.scope_id)].append(
                {
                    "id": str(doc.id),
                    "filename": doc.filename,
                    "file_type": doc.file_type,
                    "status": doc.status,
                }
            )

        for s_dict in session_dicts:
            s_dict["documents"] = docs_by_session.get(s_dict["id"], [])

        return session_dicts

    async def delete_chat_session(self, session_id: str) -> bool:
        """Delete a session, its messages, and any scoped documents."""
        sid = require_uuid(session_id, field_name="session_id")

        # Delete scoped documents associated with this session
        from app.infrastructure.db.models import Document

        stmt_docs = select(Document.storage_key).where(
            Document.retrieval_scope == "SESSION", Document.scope_id == sid
        )
        result_docs = await self.db.execute(stmt_docs)
        storage_keys = result_docs.scalars().all()

        await self.db.execute(
            delete(Document).where(Document.retrieval_scope == "SESSION", Document.scope_id == sid)
        )

        for key in storage_keys:
            if key:
                try:
                    await self.storage_provider.delete(key)
                except Exception as e:
                    import logging

                    logging.getLogger(__name__).warning(
                        f"Failed to delete orphaned file {key}: {e}"
                    )

        # Delete messages first
        await self.db.execute(delete(Message).where(Message.session_id == sid))

        # Delete session
        result = await self.db.execute(delete(ChatSession).where(ChatSession.id == sid))
        await self.db.flush()
        from typing import cast

        from sqlalchemy import CursorResult

        return cast("CursorResult", result).rowcount > 0

    async def delete_all_user_sessions(self, user_id: str) -> None:
        """Delete all chat sessions for a given user."""
        uid = require_uuid(user_id, field_name="user_id")

        # Because we're using SQLAlchemy, we first need to find all sessions for the user
        stmt = select(ChatSession.id).where(ChatSession.user_id == uid)
        result = await self.db.execute(stmt)
        session_ids = result.scalars().all()

        if not session_ids:
            return

        # Delete messages for all those sessions
        await self.db.execute(delete(Message).where(Message.session_id.in_(session_ids)))

        # Delete the sessions themselves
        await self.db.execute(delete(ChatSession).where(ChatSession.id.in_(session_ids)))

        # We also need to delete scoped documents because they are linked to the session
        from app.infrastructure.db.models import Document

        stmt_docs = select(Document.storage_key).where(
            Document.retrieval_scope == "SESSION", Document.scope_id.in_(session_ids)
        )
        result_docs = await self.db.execute(stmt_docs)
        storage_keys = result_docs.scalars().all()

        await self.db.execute(
            delete(Document).where(
                Document.retrieval_scope == "SESSION", Document.scope_id.in_(session_ids)
            )
        )

        for key in storage_keys:
            if key:
                try:
                    await self.storage_provider.delete(key)
                except Exception as e:
                    import logging

                    logging.getLogger(__name__).warning(
                        f"Failed to delete orphaned file {key}: {e}"
                    )

        await self.db.flush()

    async def save_message(
        self,
        session_id: str,
        role: str,
        content: str,
        input_type: str = "text",
        tts_cache_key: str | None = None,
        sources: list[dict] | None = None,
        message_id: str | None = None,
    ) -> ChatMessageDict:
        """Save a message and update session counters."""
        sid = require_uuid(session_id, field_name="session_id")
        
        message_kwargs = {
            "session_id": sid,
            "role": role,
            "content": content,
            "input_type": input_type,
            "tts_cache_key": tts_cache_key,
            "sources": sources or [],
        }
        
        is_existing = False
        if message_id:
            mid = require_uuid(message_id, field_name="message_id")
            message_kwargs["id"] = mid
            existing = await self.db.execute(select(Message.id).where(Message.id == mid))
            if existing.scalar_one_or_none() is not None:
                is_existing = True
            
        from sqlalchemy.dialects.postgresql import insert as pg_insert
        stmt = pg_insert(Message).values(**message_kwargs)
        stmt = stmt.on_conflict_do_update(
            index_elements=["id"],
            set_={
                "content": stmt.excluded.content,
                "tts_cache_key": stmt.excluded.tts_cache_key,
                "sources": stmt.excluded.sources,
                "timestamp": stmt.excluded.timestamp,
                "role": stmt.excluded.role,
                "input_type": stmt.excluded.input_type,
            }
        ).returning(Message)
        
        result = await self.db.execute(stmt)
        message = result.scalars().first()

        # Update session message_count, updated_at, and last_message_at.
        # Phase 1: last_message_at is stamped here alongside updated_at so both
        # fields are kept current.  updated_at is unchanged (still set) for
        # backward compatibility; last_message_at is the canonical sort key.
        if not is_existing:
            now = _now()
            await self.db.execute(
                update(ChatSession)
                .where(ChatSession.id == sid)
                .values(
                    message_count=ChatSession.message_count + 1,
                    updated_at=now,
                    last_message_at=now,
                )
            )

        # If this is first user message and title is still "New Chat", update title
        if role == "user":
            # Check if this is the first message in the session
            count_stmt = select(func.count(Message.id)).where(Message.session_id == sid)
            count_result = await self.db.execute(count_stmt)
            msg_count = count_result.scalar()
            if msg_count == 1:  # this is the first message
                new_title = _derive_session_title(content)
                if new_title:
                    await self.db.execute(
                        update(ChatSession)
                        .where(ChatSession.id == sid, ChatSession.title == "New Chat")
                        .values(title=new_title)
                    )

        await self.db.flush()
        await self.db.refresh(message)
        return self._serialize_message(message)

    async def get_session_messages(self, session_id: str, limit: int = 50) -> list[ChatMessageDict]:
        """Get last N messages for a session, ordered by timestamp asc."""
        stmt = (
            select(Message)
            .where(Message.session_id == require_uuid(session_id, field_name="session_id"))
            .order_by(Message.timestamp.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        messages = result.scalars().all()
        return [self._serialize_message(m) for m in reversed(messages)]

    async def get_message_count(self, session_id: str) -> int:
        """Get total message count for a session."""
        stmt = select(func.count(Message.id)).where(
            Message.session_id == require_uuid(session_id, field_name="session_id")
        )
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    # ── Serialization helpers ─────────────────────────────────────────────
    def _serialize_session(self, session: ChatSession) -> ChatSessionDict:
        return {
            "id": str(session.id),
            "user_id": str(session.user_id),
            "title": session.title,
            "created_at": session.created_at.isoformat() if session.created_at else None,
            "message_count": session.message_count,
            # Phase 1: new canonical field.  Always present after Phase 0 backfill.
            "last_message_at": (
                session.last_message_at.isoformat() if session.last_message_at else None
            ),
        }

    def _serialize_message(self, message: Message) -> ChatMessageDict:
        return {
            "id": str(message.id),
            "session_id": str(message.session_id),
            "role": message.role,
            "content": message.content,
            "input_type": message.input_type,
            "tts_cache_key": message.tts_cache_key,
            "sources": message.sources,
            "created_at": message.timestamp.isoformat() if message.timestamp else None,
        }
