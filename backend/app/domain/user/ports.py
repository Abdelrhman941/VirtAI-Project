"""User domain ports — abstract interface for user persistence."""

from __future__ import annotations

from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.user.entities import UserEntity


class UserRepositoryPort(ABC):
    """Abstract interface for user storage operations."""

    @abstractmethod
    async def get_by_id(self, user_id: UUID) -> UserEntity | None: ...

    @abstractmethod
    async def get_by_email(self, email: str) -> UserEntity | None: ...

    @abstractmethod
    async def get_by_google_id(self, google_id: str) -> UserEntity | None: ...

    @abstractmethod
    async def create(self, user: UserEntity) -> UserEntity: ...

    @abstractmethod
    async def update(self, user: UserEntity) -> UserEntity: ...

    @abstractmethod
    async def increment_refresh_token_version(
        self, user_id: UUID, expected_version: int
    ) -> UserEntity | None: ...

    @abstractmethod
    async def force_increment_refresh_token_version(self, user_id: UUID) -> UserEntity | None: ...
