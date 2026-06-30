from abc import ABC, abstractmethod
from collections.abc import Sequence
from typing import Any
from uuid import UUID

from app.domain.rag.entities import Document, DocumentChunk, DocumentStatusDict

# ── Existing Ingestion Pipeline Ports ────────────────────────────────────────


class EmbeddingProvider(ABC):
    @abstractmethod
    async def embed(self, text: str) -> list[float]:
        pass

    @abstractmethod
    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        pass

    @abstractmethod
    async def close(self) -> None:
        """Close resources."""
        pass


class VectorStore(ABC):

    @abstractmethod
    async def store_chunks_batch(
        self, chunks: list[DocumentChunk], embeddings: list[list[float]]
    ) -> None:
        pass

    @abstractmethod
    async def search(
        self,
        query_vector: list[float],
        limit: int = 5,
        document_id: UUID | None = None,
        scope: str | None = None,
        scope_id: UUID | None = None,
        min_dense_score: float = 0.5,
        user_id: UUID | None = None,
        metadata_filter: dict[str, Any] | None = None,
    ) -> list[tuple[DocumentChunk, float]]:
        pass

    @abstractmethod
    async def hybrid_search(
        self,
        query_text: str,
        query_vector: list[float],
        limit: int = 10,
        document_id: UUID | None = None,
        scope: str | None = None,
        scope_id: UUID | None = None,
        min_hybrid_score: float = 0.015,
        min_dense_score: float = 0.5,
        user_id: UUID | None = None,
        metadata_filter: dict[str, Any] | None = None,
    ) -> list[tuple[DocumentChunk, float]]:
        pass


class RerankerPort(ABC):
    """Abstract interface for a document reranker (e.g., Cross-Encoder)."""

    @abstractmethod
    async def rerank(
        self, query: str, chunks: list[DocumentChunk], top_k: int = 5
    ) -> list[tuple[DocumentChunk, float]]:
        pass


class DocumentParser(ABC):
    @abstractmethod
    async def parse(self, file_path: str, file_type: str) -> str:
        pass

    @abstractmethod
    async def parse_bytes(self, data: bytes, file_type: str) -> str:
        pass


class ChunkingStrategy(ABC):
    @abstractmethod
    def chunk(self, text: str) -> list[str]:
        pass


class DocumentRepositoryPort(ABC):
    """Abstract interface for the unified document write-model."""

    @abstractmethod
    async def create_document(
        self,
        user_id: str | UUID,
        filename: str,
        file_type: str,
        retrieval_scope: str = "GLOBAL",
    ) -> tuple[Document, list[Any]]:
        pass

    @abstractmethod
    async def update_status(
        self, document_id: str | UUID, new_status: str
    ) -> tuple[Document, list[Any]]:
        pass

    @abstractmethod
    async def mark_failed(
        self, document_id: str | UUID, error_message: str
    ) -> tuple[Document, list[Any]]:
        pass


class VisualizationProviderPort(ABC):
    """Abstract interface for external visual generation APIs (like Napkin)."""

    @abstractmethod
    async def generate_diagram(self, text: str) -> dict[str, str | bool]:
        """
        Takes raw text and generates an image URL.
        Returns a dictionary implementing the Sentinel pattern:
        e.g., {"image_url": "https/..."} OR {"unavailable": True, "reason": "timeout"}
        """
        pass

class VisionPort(ABC):
    """Abstract interface for image understanding/OCR."""

    @abstractmethod
    async def health_check(self) -> bool:
        """Returns True if the vision provider is accessible and healthy."""
        pass

    @abstractmethod
    async def describe(self, image_b64: str) -> str:
        """Takes a base64 encoded image string and returns a textual description."""
        pass

    @abstractmethod
    async def describe_batch(self, images: list[bytes]) -> list[str]:
        """Takes a list of raw image bytes and returns textual descriptions."""
        pass
