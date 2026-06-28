import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor

import cohere
from loguru import logger

from app.domain.rag.entities import DocumentChunk
from app.domain.rag.ports import RerankerPort
from app.shared.config import get_settings


class CohereReranker(RerankerPort):
    """
    Cohere Reranker using Cohere AsyncClientV2.
    Uses the rerank-multilingual-v3.0 model by default.
    """

    def __init__(self, model_name: str | None = None, api_key: str | None = None):
        settings = get_settings()
        self.model_name = model_name or settings.RERANKER_MODEL
        self.api_key = api_key or settings.COHERE_API_KEY
        
        if not self.api_key:
            raise ValueError("COHERE_API_KEY is required for CohereReranker")
            
        self._client = cohere.AsyncClientV2(api_key=self.api_key)
        logger.info(f"[Reranker] CohereReranker registered with model={self.model_name}")

    async def rerank(
        self, query: str, chunks: list[DocumentChunk], top_k: int = 5
    ) -> list[tuple[DocumentChunk, float]]:
        """Rerank chunks using Cohere's rerank endpoint."""
        if not chunks:
            return []

        try:
            # We must pass strings as documents to Cohere V2
            documents = [chunk.chunk_text for chunk in chunks]
            
            response = await self._client.rerank(
                model=self.model_name,
                query=query,
                documents=documents,
                top_n=top_k,
            )
            
            # Map back to chunks
            ranked = []
            for res in response.results:
                ranked.append((chunks[res.index], res.relevance_score))
                
            return ranked
        except Exception as e:
            logger.error(f"[Reranker] Cohere reranking failed: {e}")
            # Fallback to passthrough scoring
            return [(chunk, 1.0 - i * 0.01) for i, chunk in enumerate(chunks[:top_k])]


class CrossEncoderReranker(RerankerPort):
    """
    Cross-encoder reranker backed by sentence-transformers.

    **Lazy loading**: the heavy ``sentence_transformers`` import (and
    transitively ``torchaudio`` / ``transformers``) is deferred until the
    first ``rerank()`` call.  This means a broken native shared library
    (e.g. ``_torchaudio_sox.so``) will NOT crash startup — the reranker
    simply falls back to passthrough scoring at rerank-time.
    """

    _model_instance = None
    _model_name_cache: str | None = None
    _init_lock = threading.Lock()
    _executor: ThreadPoolExecutor | None = None
    # Set to True once we have confirmed the import works
    _import_failed: bool = False

    @classmethod
    def get_executor(cls) -> ThreadPoolExecutor:
        if cls._executor is None:
            with cls._init_lock:
                if cls._executor is None:
                    cls._executor = ThreadPoolExecutor(
                        max_workers=4, thread_name_prefix="crossencoder"
                    )
        return cls._executor

    @classmethod
    def shutdown_executor(cls) -> None:
        with cls._init_lock:
            if cls._executor is not None:
                cls._executor.shutdown(wait=True)
                cls._executor = None

    def __init__(self, model_name: str | None = None) -> None:
        """
        Cheap constructor — no imports, no model download.
        The model is loaded on the first call to rerank().
        """
        self.model_name = model_name or get_settings().CROSS_ENCODER_MODEL
        self.model = None  # populated lazily by _ensure_model()
        logger.info(
            f"[Reranker] CrossEncoderReranker registered (model will be loaded on first use: {self.model_name})"
        )

    def _ensure_model(self) -> bool:
        """
        Attempt to load the CrossEncoder model if not already loaded.

        Returns True if the model is ready, False if the import/load failed
        (in which case the caller should degrade gracefully).
        """
        if self.model is not None:
            return True
        if CrossEncoderReranker._import_failed:
            return False

        with self._init_lock:
            # Double-checked locking
            if self.model is not None:
                return True
            if CrossEncoderReranker._import_failed:
                return False

            # Re-use a previously loaded singleton for the same model
            if (
                CrossEncoderReranker._model_instance is not None
                and CrossEncoderReranker._model_name_cache == self.model_name
            ):
                self.model = CrossEncoderReranker._model_instance
                logger.debug("[Reranker] CrossEncoder loaded from singleton cache.")
                return True

            try:
                from sentence_transformers import CrossEncoder

                logger.info(f"[Reranker] Loading CrossEncoder model={self.model_name}")
                self.model = CrossEncoder(self.model_name)
                CrossEncoderReranker._model_instance = self.model
                CrossEncoderReranker._model_name_cache = self.model_name
                logger.info(f"[Reranker] Successfully loaded {self.model_name}")
                return True
            except Exception as exc:
                CrossEncoderReranker._import_failed = True
                logger.warning(
                    f"[Reranker] Failed to load CrossEncoder ({type(exc).__name__}: {exc}). "
                    "Reranker will use passthrough scoring for this session. "
                    "Check that torchaudio native libraries are present in the container."
                )
                return False

    def _rerank_sync(
        self, query: str, chunks: list[DocumentChunk], top_k: int
    ) -> list[tuple[DocumentChunk, float]]:
        if not chunks:
            return []

        if not self._ensure_model():
            logger.error("CrossEncoder model unavailable. Using passthrough scoring.")
            return [(chunk, 1.0 - i * 0.01) for i, chunk in enumerate(chunks[:top_k])]

        pairs = [[query, chunk.chunk_text] for chunk in chunks]
        scores = self.model.predict(pairs)
        ranked = sorted(
            zip(chunks, (float(s) for s in scores), strict=False), key=lambda x: x[1], reverse=True
        )
        return ranked[:top_k]

    async def rerank(
        self, query: str, chunks: list[DocumentChunk], top_k: int = 5
    ) -> list[tuple[DocumentChunk, float]]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            self.get_executor(), self._rerank_sync, query, chunks, top_k
        )
