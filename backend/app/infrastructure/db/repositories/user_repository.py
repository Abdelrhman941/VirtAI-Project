from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.user.entities import AuthProvider, UserEntity
from app.domain.user.ports import UserRepositoryPort
from app.infrastructure.db.models import User
from app.shared.ids import require_uuid


class UserRepository(UserRepositoryPort):
    def __init__(self, db: AsyncSession | None):
        if db is None:
            raise RuntimeError("Database session required")
        self.db = db

    async def get_by_id(self, user_id: UUID) -> UserEntity | None:
        user_uuid = require_uuid(user_id, field_name="user_id")
        result = await self.db.execute(select(User).where(User.id == user_uuid))
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def get_by_email(self, email: str) -> UserEntity | None:
        result = await self.db.execute(select(User).where(User.email == email))
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def get_by_google_id(self, google_id: str) -> UserEntity | None:
        result = await self.db.execute(select(User).where(User.google_id == google_id))
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def create(self, user: UserEntity) -> UserEntity:
        entity = user
        model = User(
            id=require_uuid(entity.id, field_name="user_id"),
            email=entity.email,
            full_name=entity.full_name,
            username=entity.username,
            password_hash=entity.password_hash,
            provider=entity.provider.value,
            google_id=entity.google_id,
            setup_complete=entity.setup_complete,
            is_active=entity.is_active,
        )
        try:
            self.db.add(model)
            await self.db.commit()
            await self.db.refresh(model)
            return self._to_entity(model)
        except IntegrityError:
            await self.db.rollback()
            raise ValueError("User already exists") from None

    async def update(self, user: UserEntity) -> UserEntity:
        entity = user
        """
        Update user fields.
        WARNING: Not safe for concurrent version bumps —
        use increment_refresh_token_version() for token version changes.
        """
        user_uuid = require_uuid(entity.id, field_name="user_id")
        model = await self.db.get(User, user_uuid)
        if not model:
            raise ValueError("User not found")
        model.email = entity.email
        model.full_name = entity.full_name
        model.username = entity.username
        model.password_hash = entity.password_hash
        model.provider = entity.provider.value
        model.google_id = entity.google_id
        model.setup_complete = entity.setup_complete
        model.is_active = entity.is_active
        model.refresh_token_version = entity.refresh_token_version
        model.updated_at = entity.updated_at
        await self.db.commit()
        await self.db.refresh(model)
        return self._to_entity(model)

    async def increment_refresh_token_version(
        self, user_id: UUID, expected_version: int
    ) -> UserEntity | None:
        """Atomically rotate a user's refresh-token version."""
        stmt = (
            update(User)
            .where(User.id == user_id, User.refresh_token_version == expected_version)
            .values(refresh_token_version=User.refresh_token_version + 1)
            .returning(User)
        )
        result = await self.db.execute(stmt)
        model = result.scalar_one_or_none()
        if model is None:
            return None
        await self.db.commit()
        await self.db.refresh(model)
        return self._to_entity(model)

    async def force_increment_refresh_token_version(self, user_id: UUID) -> UserEntity | None:
        """Increment token version without an expected-version guard."""
        user_uuid = require_uuid(user_id, field_name="user_id")
        stmt = (
            update(User)
            .where(User.id == user_uuid)
            .values(refresh_token_version=User.refresh_token_version + 1)
            .returning(User)
        )
        result = await self.db.execute(stmt)
        model = result.scalar_one_or_none()
        if model is None:
            return None
        await self.db.commit()
        await self.db.refresh(model)
        return self._to_entity(model)

    def _to_entity(self, model: User) -> UserEntity:
        return UserEntity(
            id=model.id,
            email=model.email,
            full_name=model.full_name,
            username=model.username,
            password_hash=model.password_hash,
            provider=AuthProvider(model.provider),
            google_id=model.google_id,
            setup_complete=model.setup_complete,
            is_active=model.is_active,
            refresh_token_version=model.refresh_token_version,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )
