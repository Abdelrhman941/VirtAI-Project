from loguru import logger
from openai import AsyncOpenAI

from app.domain.rag.ports import EmbeddingProvider
from app.shared.config import get_settings


class OpenAIEmbedder(EmbeddingProvider):
    """Provides vector embeddings using OpenAI's embedding models."""

    def __init__(self):
        settings = get_settings()
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not configured")

        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = "text-embedding-3-small"
        self.dimension = settings.EMBEDDING_DIMENSION

    async def embed(self, text: str) -> list[float]:
        try:
            response = await self.client.embeddings.create(
                input=[text], model=self.model, dimensions=self.dimension
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"OpenAI embedding failed: {e}")
            raise RuntimeError(f"Embedding generation failed: {e}") from e

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        try:
            response = await self.client.embeddings.create(
                input=texts, model=self.model, dimensions=self.dimension
            )
            return [data.embedding for data in response.data]
        except Exception as e:
            logger.error(f"OpenAI batch embedding failed: {e}")
            raise RuntimeError(f"Batch embedding generation failed: {e}") from e

    async def close(self) -> None:
        await self.client.close()
