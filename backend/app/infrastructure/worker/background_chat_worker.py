"""Background workers for chat-related operations."""

import logging

from app.infrastructure.db.database import AsyncSessionLocal
from app.infrastructure.db.repositories.chat_repository import ChatRepository
from app.infrastructure.storage.local_storage import LocalStorageProvider
from app.shared.config import get_settings

logger = logging.getLogger(__name__)


async def save_conversation_background_task(session_id: str, query: str, response: str) -> None:
    """Saves conversation to the database using an independent session for zero-latency background execution."""
    async with AsyncSessionLocal() as db_session:
        try:
            settings = get_settings()
            storage = LocalStorageProvider(settings.UPLOAD_DIR)
            bg_repo = ChatRepository(db_session, storage)

            await bg_repo.save_message(session_id, "user", query)
            await bg_repo.save_message(session_id, "assistant", response)
            await db_session.commit()
        except Exception as e:
            logger.error(f"Background task failed to save messages: {e}")
            await db_session.rollback()
