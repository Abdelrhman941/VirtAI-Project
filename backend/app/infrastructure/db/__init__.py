"""
Infrastructure DB package.

PostgreSQL + SQLAlchemy 2.0 async.
Exports database session, models, and repositories.
"""

from app.infrastructure.db.database import AsyncSessionLocal, Base, close_db, get_db, init_db
from app.infrastructure.db.models import (
    Avatar,
    ChatSession,
    Document,
    DocumentChunk,
    Message,
    User,
)
from app.infrastructure.db.repositories.avatar_repository import AvatarRepository
from app.infrastructure.db.repositories.chat_repository import ChatRepository
from app.infrastructure.db.repositories.document_repository import DocumentRepository
from app.infrastructure.db.repositories.user_repository import UserRepository

__all__ = [
    # database
    "AsyncSessionLocal",
    "Base",
    "get_db",
    "init_db",
    "close_db",
    # models
    "User",
    "ChatSession",
    "Message",
    "Avatar",
    "Document",
    "DocumentChunk",
    # repositories
    "UserRepository",
    "ChatRepository",
    "AvatarRepository",
    "DocumentRepository",
]
