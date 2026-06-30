import asyncio
from typing import AsyncIterator, Protocol

from pydantic import BaseModel, Field

from app.domain.rag.normalization import normalize_text
from app.domain.rag.ports import ChunkingStrategy, DocumentParser, EmbeddingProvider
from app.shared.errors import ChunkLimitExceeded, EmptyDocumentError


class IndexableChunk(BaseModel):
    chunk_text: str = Field(..., min_length=1)
    chunk_order: int = Field(..., ge=0)
    embedding: list[float] = Field(..., min_length=1)
    metadata: dict[str, str] = Field(default_factory=dict)


class PipelineInput(BaseModel):
    file_bytes: bytes
    file_type: str = Field(..., min_length=2)
    filename: str
    max_chunks: int = Field(default=1000, gt=0)


class IngestionPipeline(Protocol):
    async def run(self, payload: PipelineInput) -> AsyncIterator[list[IndexableChunk]]: ...


class DefaultIngestionPipeline:
    """
    Pure domain module for transforming raw document bytes into embeddable chunks.
    Completely isolated from database and infrastructure pub/sub.
    """

    def __init__(
        self,
        parser: DocumentParser,
        chunker: ChunkingStrategy,
        embedder: EmbeddingProvider,
        batch_size: int = 100,
    ):
        self.parser = parser
        self.chunker = chunker
        self.embedder = embedder
        self.batch_size = batch_size

    async def run(self, payload: PipelineInput) -> AsyncIterator[list[IndexableChunk]]:
        # 1. Parse
        raw_text = await self.parser.parse_bytes(payload.file_bytes, payload.file_type)

        # 2. Normalize
        normalized = normalize_text(raw_text)
        if not normalized.strip():
            raise EmptyDocumentError("Document parsed to empty text")

        # 3. Chunk
        chunks_text = await asyncio.to_thread(self.chunker.chunk, normalized)
        total_chunks = len(chunks_text)

        if total_chunks == 0:
            raise EmptyDocumentError("Document chunked to 0 chunks")

        if total_chunks > payload.max_chunks:
            raise ChunkLimitExceeded(f"Document exceeds {payload.max_chunks} chunks")

        # 4. Embed and Yield in Batches
        for i in range(0, total_chunks, self.batch_size):
            batch_texts = chunks_text[i : i + self.batch_size]

            embeddings = await self.embedder.embed_batch(batch_texts)

            batch_chunks = []
            for j, (text, emb) in enumerate(zip(batch_texts, embeddings, strict=False)):
                metadata = {"source": payload.filename}
                if "[Visual content:" in text:
                    metadata["source_type"] = "vision"

                chunk = IndexableChunk(
                    chunk_text=text,
                    chunk_order=i + j,
                    embedding=emb,
                    metadata=metadata,
                )
                batch_chunks.append(chunk)

            yield batch_chunks
