from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db.models import ChatSession, Document

logger = logging.getLogger(__name__)

# TODO (BATCH 8): Wire this cleanup job into the application lifecycle (e.g., main.py lifespan)
# or a task scheduler (e.g., APScheduler/Celery) so it runs periodically in the background.
async def cleanup_orphaned_and_stuck_documents(db: AsyncSession, stuck_timeout_minutes: int = 30) -> dict[str, int]:
    """
    Deletes documents that are orphaned (their session no longer exists)
    or stuck in a non-terminal state for too long.
    """
    deleted_orphans_count = 0
    deleted_stuck_count = 0
    
    async with db.begin():
        # 1. Delete documents whose session no longer exists
        # Document.scope_id is the session_id when retrieval_scope == "SESSION"
        orphan_stmt = select(Document.id).where(
            Document.retrieval_scope == "SESSION",
            Document.scope_id.isnot(None),
            ~Document.scope_id.in_(select(ChatSession.id))
        )
        
        orphan_result = await db.execute(orphan_stmt)
        orphan_ids = [row[0] for row in orphan_result.all()]
        
        if orphan_ids:
            del_stmt = delete(Document).where(Document.id.in_(orphan_ids))
            await db.execute(del_stmt)
            deleted_orphans_count = len(orphan_ids)
            logger.info(f"Deleted {deleted_orphans_count} orphaned documents: {orphan_ids}")

        # 2. Delete stuck documents
        cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=stuck_timeout_minutes)
        terminal_statuses = ["COMPLETE", "FAILED", "CANCELLED"]
        
        stuck_stmt = select(Document.id).where(
            Document.current_stage.notin_(terminal_statuses),
            Document.upload_date < cutoff_time
        )
        
        stuck_result = await db.execute(stuck_stmt)
        stuck_ids = [row[0] for row in stuck_result.all()]
        
        if stuck_ids:
            del_stmt = delete(Document).where(Document.id.in_(stuck_ids))
            await db.execute(del_stmt)
            deleted_stuck_count = len(stuck_ids)
            logger.info(f"Deleted {deleted_stuck_count} stuck documents: {stuck_ids}")
            
        # 3. Delete orphaned sessions (0 messages and older than 7 days)
        session_cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        empty_session_stmt = select(ChatSession.id).where(
            ChatSession.message_count == 0,
            ChatSession.created_at < session_cutoff
        )
        empty_result = await db.execute(empty_session_stmt)
        empty_ids = [row[0] for row in empty_result.all()]
        
        deleted_sessions_count = 0
        if empty_ids:
            del_session_stmt = delete(ChatSession).where(ChatSession.id.in_(empty_ids))
            await db.execute(del_session_stmt)
            deleted_sessions_count = len(empty_ids)
            logger.info(f"Deleted {deleted_sessions_count} orphaned sessions: {empty_ids}")

    return {
        "orphans_deleted": deleted_orphans_count,
        "stuck_deleted": deleted_stuck_count,
        "sessions_deleted": deleted_sessions_count
    }
