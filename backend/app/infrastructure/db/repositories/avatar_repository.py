"""
Avatar repository using SQLAlchemy async.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.user.entities import AvatarDict
from app.infrastructure.db.models import Avatar
from app.shared.ids import require_uuid

Language = Literal["ar", "en"]


def _now() -> datetime:
    return datetime.now(timezone.utc)


class AvatarRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_user(self, user_id: str) -> AvatarDict | None:
        stmt = select(Avatar).where(Avatar.user_id == require_uuid(user_id, field_name="user_id"))
        result = await self.db.execute(stmt)
        avatar = result.scalar_one_or_none()
        return self._serialize(avatar) if avatar else None

    async def upsert(
        self,
        user_id: str,
        avatar_url: str = "",
        voice_id: str = "aria",
        language: Language = "en",
        persona_prompt: str = "",
    ) -> AvatarDict:
        """Create or update avatar config for a user."""
        uid = require_uuid(user_id, field_name="user_id")
        # Check existence
        stmt = select(Avatar).where(Avatar.user_id == uid)
        result = await self.db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            existing.avatar_url = avatar_url
            existing.voice_id = voice_id
            existing.language = language
            existing.persona_prompt = persona_prompt
            existing.updated_at = _now()
            await self.db.flush()
            await self.db.refresh(existing)
            return self._serialize(existing)
        else:
            new_avatar = Avatar(
                user_id=uid,
                avatar_url=avatar_url,
                voice_id=voice_id,
                language=language,
                persona_prompt=persona_prompt,
                updated_at=_now(),
            )
            self.db.add(new_avatar)
            await self.db.flush()
            await self.db.refresh(new_avatar)
            return self._serialize(new_avatar)

    async def delete(self, user_id: str) -> bool:
        result = await self.db.execute(
            delete(Avatar).where(Avatar.user_id == require_uuid(user_id, field_name="user_id"))
        )
        await self.db.flush()
        from typing import cast

        from sqlalchemy import CursorResult

        return cast("CursorResult", result).rowcount > 0

    def _serialize(self, avatar: Avatar) -> AvatarDict:
        return {
            "id": str(avatar.id),
            "user_id": str(avatar.user_id),
            "avatar_url": avatar.avatar_url,
            "voice_id": avatar.voice_id,
            "language": avatar.language,
            "persona_prompt": avatar.persona_prompt,
            "updated_at": avatar.updated_at.isoformat() if avatar.updated_at else None,
        }
