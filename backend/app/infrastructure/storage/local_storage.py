import os
from collections.abc import AsyncIterable, AsyncIterator
from pathlib import Path

import aiofiles  # type: ignore[import-untyped]
import aiofiles.os  # type: ignore[import-untyped]

from app.domain.storage.ports import StorageProvider


class LocalStorageProvider(StorageProvider):
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _get_absolute_path(self, key: str) -> Path:
        # Prevent path traversal
        absolute_path = (self.base_path / key).resolve()
        if self.base_path.resolve() not in absolute_path.parents:
            raise ValueError("Invalid storage key: path traversal detected")
        return absolute_path

    async def save(
        self,
        key: str,
        data: bytes | AsyncIterable[bytes],
        content_type: str = "application/octet-stream",
    ) -> str:
        file_path = self._get_absolute_path(key)
        # Create parent directories if needed
        await aiofiles.os.makedirs(file_path.parent, exist_ok=True)

        async with aiofiles.open(file_path, "wb") as f:
            if isinstance(data, bytes):
                await f.write(data)
            else:
                async for chunk in data:
                    await f.write(chunk)
        return key

    async def delete(self, key: str) -> None:
        file_path = self._get_absolute_path(key)
        if await aiofiles.os.path.exists(file_path):
            await aiofiles.os.remove(file_path)

            # Attempt to remove empty parent directories
            try:
                parent = file_path.parent
                if parent != self.base_path.resolve() and not os.listdir(parent):
                    await aiofiles.os.rmdir(parent)
            except OSError:
                pass  # Ignore errors removing parent dirs

    async def exists(self, key: str) -> bool:
        file_path = self._get_absolute_path(key)
        return await aiofiles.os.path.exists(file_path)

    async def open(self, key: str) -> AsyncIterator[bytes]:
        file_path = self._get_absolute_path(key)
        if not await aiofiles.os.path.exists(file_path):
            raise FileNotFoundError(f"Key {key} not found in storage")

        async def _generator():
            async with aiofiles.open(file_path, "rb") as f:
                while chunk := await f.read(8192):
                    yield chunk

        return _generator()

    async def get_bytes(self, key: str) -> bytes:
        file_path = self._get_absolute_path(key)
        if not await aiofiles.os.path.exists(file_path):
            raise FileNotFoundError(f"Key {key} not found in storage")

        async with aiofiles.open(file_path, "rb") as f:
            return await f.read()
