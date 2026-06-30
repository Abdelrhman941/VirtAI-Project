from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import Conversation


class ConversationRepository:
    """Repository for managing RAG Conversations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def save_message(
        self,
        session_id: str,
        project_id: int,
        role: str,
        content: str,
        vector_collection: str | None = None,
        metadata: dict | None = None,
    ) -> Conversation:
        record = Conversation(
            session_id=session_id,
            conversation_project_id=project_id,
            role=role,
            content=content,
            vector_collection=vector_collection,
            conv_metadata=metadata or {},
        )
        self.db.add(record)
        await self.db.flush()
        await self.db.refresh(record)
        return record

    async def get_session_history(
        self, session_id: str, project_id: int, last_n: int = 20
    ) -> list[Conversation]:
        stmt = (
            select(Conversation)
            .where(
                Conversation.session_id == session_id,
                Conversation.conversation_project_id == project_id,
            )
            .order_by(Conversation.created_at.desc())
            .limit(last_n)
        )
        result = await self.db.execute(stmt)
        rows = result.scalars().all()
        # Reverse to return oldest first
        return list(reversed(rows))

    async def get_session_count(self, session_id: str, project_id: int) -> int:
        stmt = select(func.count(Conversation.conversation_id)).where(
            Conversation.session_id == session_id,
            Conversation.conversation_project_id == project_id,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one()

    async def delete_session(self, session_id: str, project_id: int) -> int:
        stmt = delete(Conversation).where(
            Conversation.session_id == session_id,
            Conversation.conversation_project_id == project_id,
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        from typing import cast

        from sqlalchemy import CursorResult

        return cast("CursorResult", result).rowcount

    async def get_all_sessions(self, project_id: int) -> Sequence[str]:
        stmt = (
            select(Conversation.session_id)
            .where(Conversation.conversation_project_id == project_id)
            .distinct()
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()
