import cohere
from loguru import logger

from app.domain.rag.ports import EmbeddingProvider


class CohereEmbedder(EmbeddingProvider):
    """
    Cohere embeddings provider.
    Automatically routes embed() to search_query and embed_batch() to search_document.
    """

    def __init__(self, model_name: str, api_key: str):
        self.model_name = model_name
        self._client = cohere.AsyncClientV2(api_key=api_key)

    async def embed(self, text: str) -> list[float]:
        """
        Embeds a single string, typically a search query.
        """
        try:
            response = await self._client.embed(
                texts=[text],
                model=self.model_name,
                input_type="search_query",
                embedding_types=["float"]
            )
            return response.embeddings.float_[0]
        except Exception as e:
            logger.error(f"Cohere single embedding failed: {e}")
            raise RuntimeError(f"Cohere embedding failed: {e}") from e

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """
        Embeds a list of strings, typically documents.
        """
        if not texts:
            return []
        try:
            response = await self._client.embed(
                texts=texts,
                model=self.model_name,
                input_type="search_document",
                embedding_types=["float"]
            )
            return response.embeddings.float_
        except Exception as e:
            logger.error(f"Cohere batch embedding failed: {e}")
            raise RuntimeError(f"Cohere batch embedding failed: {e}") from e

    async def close(self) -> None:
        """Close resources."""
        pass
