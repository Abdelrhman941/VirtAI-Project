import time
from typing import Any

from loguru import logger
from sqlalchemy import text

from app.infrastructure.cache.redis_client import get_redis, init_redis
from app.infrastructure.db.database import AsyncSessionLocal
from app.infrastructure.rag.fastembed_provider import FastEmbedProvider
from app.infrastructure.storage.local_storage import LocalStorageProvider
from app.shared.config import get_settings


async def worker_startup_validation(ctx: dict[Any, Any]) -> None:
    settings = get_settings()

    # 1. Ping Redis
    logger.info("Worker startup: Pinging Redis...")
    await init_redis()
    redis_client = get_redis()
    await redis_client.ping()  # type: ignore[misc]

    # 2. Test DB + pgvector
    logger.info("Worker startup: Testing DB and pgvector extension...")
    async with AsyncSessionLocal() as db:
        await db.execute(text("SELECT 1"))
        result = await db.execute(text("SELECT extname FROM pg_extension WHERE extname = 'vector'"))
        if not result.scalar_one_or_none():
            raise RuntimeError("pgvector extension is not installed in the database")

    # 2.5 Test Tesseract OCR
    logger.info("Worker startup: Testing Tesseract OCR languages...")
    try:
        import pytesseract
        langs = pytesseract.get_languages()
        if 'eng' not in langs:
            logger.warning("Tesseract 'eng' language pack missing")
        if 'ara' not in langs:
            logger.warning("Tesseract 'ara' language pack missing — Arabic OCR will fail")
    except Exception as e:
        logger.warning(f"Tesseract not available: {e}")

    # 3. Warm Embedding Provider (must match API server configuration)
    logger.info(
        {
            "event": "worker_embedding_provider_start",
            "provider": settings.EMBEDDING_PROVIDER,
            "model": settings.EMBEDDING_MODEL,
        }
    )
    t0 = time.monotonic()
    if settings.EMBEDDING_PROVIDER == "fastembed":
        embedder = FastEmbedProvider(
            model_name=settings.EMBEDDING_MODEL,
            cache_dir=settings.FASTEMBED_CACHE_DIR,
        )
    elif settings.EMBEDDING_PROVIDER == "openai":
        from app.infrastructure.rag.openai_embedder import OpenAIEmbedder
        embedder = OpenAIEmbedder()
    elif settings.EMBEDDING_PROVIDER == "cohere":
        if not settings.COHERE_API_KEY:
            raise ValueError("COHERE_API_KEY is required when EMBEDDING_PROVIDER=cohere")
        from app.infrastructure.rag.cohere_embedder import CohereEmbedder
        embedder = CohereEmbedder(
            model_name=settings.EMBEDDING_MODEL,
            api_key=settings.COHERE_API_KEY
        )
    else:
        raise ValueError(
            f"Unsupported EMBEDDING_PROVIDER: {settings.EMBEDDING_PROVIDER}. "
            f"Expected 'fastembed', 'openai', or 'cohere'."
        )
        
    from app.infrastructure.rag.cached_embedder import CachedEmbedder
    embedder = CachedEmbedder(
        base_embedder=embedder,
        redis_client=redis_client,
        model_name=settings.EMBEDDING_MODEL
    )
    warmup_ms = int((time.monotonic() - t0) * 1000)

    logger.info(
        {
            "event": "embedding_provider_ready",
            "provider": settings.EMBEDDING_PROVIDER,
            "model": settings.EMBEDDING_MODEL,
            "warmup_ms": warmup_ms,
        }
    )

    # 4. Vision Provider
    vision_provider = None
    if settings.VISION_PROVIDER == "gemini":
        from app.infrastructure.vision.gemini_vision import GeminiVisionProvider
        vision_provider = GeminiVisionProvider(
            api_key=settings.GOOGLE_API_KEY, 
            model=settings.VISION_MODEL
        )

    # Store in context
    ctx["embedder"] = embedder
    ctx["vision_provider"] = vision_provider
    ctx["storage"] = LocalStorageProvider(base_path=settings.UPLOAD_BASE_PATH)
    ctx["redis"] = redis_client
    logger.info("Worker startup: All checks passed. Ready to process jobs.")


async def worker_shutdown(ctx: dict[Any, Any]) -> None:
    logger.info("Worker shutting down...")
    redis_client = ctx.get("redis")
    if redis_client:
        await redis_client.aclose()
