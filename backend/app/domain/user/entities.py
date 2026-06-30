"""
User domain entity — pure dataclass representation of a user.

This is the domain entity; the ORM model lives in infrastructure/db/models.py.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import TypedDict
from uuid import UUID


class AuthProvider(str, Enum):
    LOCAL = "local"
    GOOGLE = "google"


@dataclass
class UserEntity:
    """Pure domain representation of a user (no ORM dependency)."""

    id: UUID
    email: str
    full_name: str
    username: str | None = None
    password_hash: str | None = None
    provider: AuthProvider = AuthProvider.LOCAL
    google_id: str | None = None
    setup_complete: bool = False
    is_active: bool = True
    refresh_token_version: int = 0
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class AvatarDict(TypedDict):
    id: str
    user_id: str
    avatar_url: str
    voice_id: str
    language: str
    persona_prompt: str
    updated_at: str | None
