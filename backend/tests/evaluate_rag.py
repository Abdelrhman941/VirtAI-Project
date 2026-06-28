import asyncio
import yaml
import sys
from loguru import logger
from app.shared.config import get_settings
from app.infrastructure.rag.cohere_embedder import CohereEmbedder
from app.infrastructure.db.database import AsyncSessionLocal
from app.application.rag.retrieval_use_case import RetrievalUseCase
from app.infrastructure.db.repositories.document_repository import DocumentRepository
from app.infrastructure.rag.pgvector_store import PgVectorStore

async def evaluate():
    settings = get_settings()
    
    logger.info("Initializing embedding provider...")
    if settings.EMBEDDING_PROVIDER == "cohere":
        from app.infrastructure.rag.cached_embedder import CachedEmbedder
        from app.infrastructure.cache.redis_client import init_redis, get_redis
        await init_redis()
        base_embedder = CohereEmbedder(
            model_name=settings.EMBEDDING_MODEL,
            api_key=settings.COHERE_API_KEY
        )
        embedder = CachedEmbedder(base_embedder, get_redis(), settings.EMBEDDING_MODEL)
    else:
        logger.error(f"Provider {settings.EMBEDDING_PROVIDER} not supported by evaluator")
        sys.exit(1)
        
    try:
        with open("tests/golden_queries.yaml", "r") as f:
            data = yaml.safe_load(f)
            queries = data.get("queries", [])
    except Exception as e:
        logger.error(f"Failed to load golden_queries.yaml: {e}")
        sys.exit(1)
        
    logger.info(f"Loaded {len(queries)} golden queries. Starting evaluation...")
    
    hits = 0
    total = len(queries)
    
    async with AsyncSessionLocal() as db:
        doc_repo = DocumentRepository(db)
        vector_store = PgVectorStore(db)
        
        # We need a proper user_id and doc contexts for real evaluation.
        # But this is a basic harness structure.
        for q in queries:
            query = q["query"]
            expected = q["expected_document"]
            
            logger.info(f"Evaluating: '{query}' (Expected: {expected})")
            
            # Simple vector search simulation
            try:
                emb = await embedder.embed(query)
                results = await vector_store.search(
                    query_embedding=emb,
                    limit=5,
                    user_id=None,
                    scope_id=None
                )
                
                # Check if expected document name matches any of the result document names
                found = False
                for r in results:
                    doc = await doc_repo.get(r.document_id)
                    if doc and doc.filename == expected:
                        found = True
                        break
                        
                if found:
                    hits += 1
                    logger.success(f"Hit! Found '{expected}' in top 5")
                else:
                    logger.warning(f"Miss! Did not find '{expected}' in top 5")
            except Exception as e:
                logger.error(f"Search failed for '{query}': {e}")
                
    hit_rate = (hits / total) * 100 if total > 0 else 0
    logger.info(f"Evaluation complete. Hit Rate: {hit_rate:.2f}% ({hits}/{total})")

if __name__ == "__main__":
    asyncio.run(evaluate())
