"""Local filesystem audio storage (stub for future cloud storage swap)."""

from __future__ import annotations

import asyncio
from pathlib import Path

from app.shared.config import get_settings


class LocalAudioStorage:
    """Stores audio files under backend/.data/sessions/{session_id}/."""

    def __init__(self, base_path: str | None = None) -> None:
        settings = get_settings()
        self._base = Path(base_path or settings.AUDIO_STORAGE_PATH)

    async def save(self, session_id: str, filename: str, data: bytes) -> Path:
        dest = self._base / session_id
        await asyncio.to_thread(dest.mkdir, parents=True, exist_ok=True)
        path = dest / filename
        await asyncio.to_thread(path.write_bytes, data)
        return path

    async def load(self, session_id: str, filename: str) -> bytes:
        return await asyncio.to_thread((self._base / session_id / filename).read_bytes)

    async def exists(self, session_id: str, filename: str) -> bool:
        return await asyncio.to_thread((self._base / session_id / filename).exists)
