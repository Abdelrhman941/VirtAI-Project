import asyncio
import inspect
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastembed import TextEmbedding
from loguru import logger

from app.domain.rag.ports import EmbeddingProvider
from app.shared.config import get_settings


class FastEmbedProvider(EmbeddingProvider):
    _model_instance = None
    _model_name_cache = None
    _init_lock = threading.Lock()
    _executor: ThreadPoolExecutor | None = None

    @classmethod
    def get_executor(cls) -> ThreadPoolExecutor:
        if cls._executor is None:
            with cls._init_lock:
                if cls._executor is None:
                    cls._executor = ThreadPoolExecutor(
                        max_workers=4, thread_name_prefix="fastembed"
                    )
        return cls._executor

    @classmethod
    def shutdown_executor(cls) -> None:
        with cls._init_lock:
            if cls._executor is not None:
                cls._executor.shutdown(wait=True)
                cls._executor = None

    def __init__(self, model_name: str | None = None, cache_dir: str | None = None):
        settings = get_settings()
        self.model_name = model_name or settings.EMBEDDING_MODEL
        self.cache_dir = cache_dir or settings.FASTEMBED_CACHE_DIR
        self.lazy_load = settings.FASTEMBED_LAZY_LOAD
        Path(self.cache_dir).mkdir(parents=True, exist_ok=True)
        self.model = None

    def _ensure_model(self):
        with self._init_lock:
            if (
                FastEmbedProvider._model_instance is not None
                and FastEmbedProvider._model_name_cache == self.model_name
            ):
                self.model = FastEmbedProvider._model_instance
                logger.debug("FastEmbed model loaded from class singleton cache.")
                return

            logger.info(
                {
                    "event": "fastembed_load_start",
                    "model": self.model_name,
                    "cache_dir": self.cache_dir,
                }
            )
            from typing import Any

            kwargs: dict[str, Any] = {"model_name": self.model_name}
            signature = inspect.signature(TextEmbedding)
            if "cache_dir" in signature.parameters:
                kwargs["cache_dir"] = self.cache_dir
            if "lazy_load" in signature.parameters:
                kwargs["lazy_load"] = self.lazy_load

            self.model = TextEmbedding(**kwargs)
            FastEmbedProvider._model_instance = self.model
            FastEmbedProvider._model_name_cache = self.model_name
            logger.info("FastEmbed model loaded successfully.")

    def _embed_sync(self, texts: list[str]) -> list[list[float]]:
        if self.model is None:
            self._ensure_model()
        # FastEmbed returns a generator of numpy arrays, we convert to list of floats
        embeddings_gen = self.model.embed(texts)
        return [list(vec) for vec in embeddings_gen]

    async def embed(self, text: str) -> list[float]:
        try:
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(self.get_executor(), self._embed_sync, [text])
            return result[0]
        except Exception as e:
            logger.error(f"FastEmbed generation failed: {e}")
            raise RuntimeError(f"Embedding generation failed: {e}") from e

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        try:
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(self.get_executor(), self._embed_sync, texts)
        except Exception as e:
            logger.error(f"FastEmbed batch generation failed: {e}")
            raise RuntimeError(f"Batch embedding generation failed: {e}") from e

    async def close(self) -> None:
        self.shutdown_executor()
