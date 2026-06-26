import hashlib
import json
import redis.asyncio as redis
from loguru import logger

from app.domain.rag.ports import EmbeddingProvider


class CachedEmbedder(EmbeddingProvider):
    """
    Decorator that wraps an EmbeddingProvider with Redis caching functionality.
    """

    def __init__(self, base_embedder: EmbeddingProvider, redis_client: redis.Redis | None = None, model_name: str = "default"):
        self.base_embedder = base_embedder
        self.redis = redis_client
        self.model_name = model_name
        
    def _hash_text(self, text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    async def embed(self, text: str) -> list[float]:
        """Embeds a single string, checking cache first."""
        if not text.strip():
            return []
            
        cache_key = ""
        if self.redis:
            cache_key = f"embed:{self.model_name}:query:{self._hash_text(text)}"
            try:
                cached = await self.redis.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception as e:
                logger.warning(f"Redis get failed for cached_embedder: {e}")

        emb = await self.base_embedder.embed(text)
        
        if self.redis:
            try:
                await self.redis.set(cache_key, json.dumps(emb), ex=86400 * 7)
            except Exception as e:
                logger.warning(f"Redis set failed for cached_embedder: {e}")
                
        return emb

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embeds a list of strings, fetching cached ones and sending only missing ones to base embedder."""
        if not texts:
            return []
            
        results = [None] * len(texts)
        missing_indices = []
        missing_texts = []
        
        if self.redis:
            keys = [f"embed:{self.model_name}:doc:{self._hash_text(t)}" for t in texts]
            try:
                cached_values = await self.redis.mget(keys)
                for i, val in enumerate(cached_values):
                    if val:
                        results[i] = json.loads(val)
                    else:
                        missing_indices.append(i)
                        missing_texts.append(texts[i])
            except Exception as e:
                logger.warning(f"Redis mget failed for cached_embedder: {e}")
                missing_indices = list(range(len(texts)))
                missing_texts = texts
        else:
            missing_indices = list(range(len(texts)))
            missing_texts = texts
            
        if missing_texts:
            embs = await self.base_embedder.embed_batch(missing_texts)
            
            if self.redis:
                try:
                    to_cache = {}
                    for idx, emb in zip(missing_indices, embs):
                        results[idx] = emb
                        cache_key = f"embed:{self.model_name}:doc:{self._hash_text(texts[idx])}"
                        to_cache[cache_key] = json.dumps(emb)
                    if to_cache:
                        await self.redis.mset(to_cache)
                        pipe = self.redis.pipeline()
                        for k in to_cache:
                            pipe.expire(k, 86400 * 30)
                        await pipe.execute()
                except Exception as e:
                    logger.warning(f"Redis mset failed for cached_embedder: {e}")
            else:
                for idx, emb in zip(missing_indices, embs):
                    results[idx] = emb
                    
        # Type checker assurance since results initialized with None
        return [r for r in results if r is not None]  # type: ignore

    async def close(self) -> None:
        """Close resources."""
        await self.base_embedder.close()
