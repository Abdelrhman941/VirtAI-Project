"""FastAPI Application Entry Point."""

from __future__ import annotations

import asyncio
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from loguru import logger

from app.application.chat.session_manager import SessionManager
from app.infrastructure.cache.redis_client import close_redis, init_redis
from app.infrastructure.db.database import close_db, init_db
from app.presentation.http.v1.dependencies import init_session_manager, init_ws_connection_manager
from app.presentation.http.v1.router import router as api_v1_router
from app.presentation.ws.connection_manager import WSConnectionManager
from app.shared.config import get_settings
from app.shared.log_config import setup_logging

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup and shutdown logic.
    """
    background_tasks = set()

    # ── Startup ───────────────────────────────────────────────────────────────
    setup_logging()
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")

    # ── PostgreSQL + pgvector ────────────────────────────────────────────────
    await init_db()
    logger.info("PostgreSQL + pgvector initialised")

    # ── Redis ────────────────────────────────────────────────────────────────
    await init_redis()
    logger.info("Redis initialised")


    # ── RAG Infrastructure ───────────────────────────────────────────────────
    import time

    from arq import create_pool  # type: ignore[import-not-found]
    from arq.connections import RedisSettings  # type: ignore[import-not-found]

    from app.infrastructure.rag.fastembed_provider import FastEmbedProvider
    from app.infrastructure.rag.openai_embedder import OpenAIEmbedder
    from app.infrastructure.storage.local_storage import LocalStorageProvider

    t0 = time.monotonic()
    logger.info(
        {
            "event": "embedding_provider_start",
            "provider": settings.EMBEDDING_PROVIDER,
            "model": settings.EMBEDDING_MODEL,
        }
    )
    try:
        if settings.EMBEDDING_PROVIDER == "fastembed":
            embedder = FastEmbedProvider(
                model_name=settings.EMBEDDING_MODEL,
                cache_dir=settings.FASTEMBED_CACHE_DIR,
            )
        elif settings.EMBEDDING_PROVIDER == "openai":
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
            raise ValueError(f"Unsupported embedding provider: {settings.EMBEDDING_PROVIDER}")
            
        from app.infrastructure.rag.cached_embedder import CachedEmbedder
        from app.infrastructure.cache.redis_client import get_redis
        embedder = CachedEmbedder(
            base_embedder=embedder,
            redis_client=get_redis(),
            model_name=settings.EMBEDDING_MODEL
        )
    except Exception as exc:
        logger.error(
            {
                "event": "embedding_provider_failed",
                "provider": settings.EMBEDDING_PROVIDER,
                "model": settings.EMBEDDING_MODEL,
                "error_type": type(exc).__name__,
                "message": str(exc),
            }
        )
        raise

    warmup_ms = int((time.monotonic() - t0) * 1000)
    logger.info(
        {
            "event": "embedding_provider_ready",
            "provider": settings.EMBEDDING_PROVIDER,
            "model": settings.EMBEDDING_MODEL,
            "warmup_ms": warmup_ms,
        }
    )

    app.state.embedder = embedder
    app.state.storage = LocalStorageProvider(base_path=settings.UPLOAD_BASE_PATH)

    from app.infrastructure.rag.reranker import CrossEncoderReranker, CohereReranker

    try:
        if settings.RERANKER_PROVIDER == "cohere":
            app.state.reranker = CohereReranker(model_name=settings.RERANKER_MODEL, api_key=settings.COHERE_API_KEY)
        else:
            app.state.reranker = CrossEncoderReranker()
            logger.info("[Reranker] Aggressively warming up CrossEncoderReranker...")
            loop = asyncio.get_running_loop()
            loop.run_in_executor(app.state.reranker.get_executor(), app.state.reranker._ensure_model)
    except Exception as _reranker_exc:
        logger.error(
            f"[Reranker] Reranker construction failed "
            f"({type(_reranker_exc).__name__}: {_reranker_exc}). Failing fast."
        )
        raise

    # ── Intent Classifier Preload ───────────────────────────────────────────
    try:
        from app.application.rag.intent_classifier import IntentClassifier

        logger.info("[IntentClassifier] Preloading Semantic Router V2.0...")
        app.state.intent_classifier = IntentClassifier(embedder)
        task = asyncio.create_task(app.state.intent_classifier.initialize())
        background_tasks.add(task)
        task.add_done_callback(background_tasks.discard)
    except Exception as e:
        logger.error(
            f"[IntentClassifier] CRITICAL ERROR: Preload crashed ({type(e).__name__}: {e}). "
            f"Semantic router is offline. Gracefully degrading to standard chat/retrieval."
        )
        app.state.intent_classifier = None

    # ── Preload Heavy Modules ───────────────────────────────────────────────
    # We preload these to prevent the first WebSocket request from blocking 
    # the event loop for 20+ seconds during lazy initialization.
    logger.info("Preloading heavy modules for voice pipeline...")
    try:
        from app.application.animation.intelligence_service import AnimationIntelligenceService
        from app.application.voice.pipeline_stages import AnimationStage
        from app.infrastructure.tts.viseme_generator import VisemeGenerator
        import numpy  # noqa
        import pydub  # noqa
        import httpx  # noqa
        logger.info("Preloaded voice pipeline modules successfully.")
    except ImportError as e:
        logger.warning(f"Failed to preload some voice modules: {e}")

    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    app.state.arq_pool = await create_pool(redis_settings)
    logger.info("ARQ pool initialized")

    from app.application.rag.retrieval_use_case import RetrievalUseCase
    from app.application.services.model_policy import FallbackTTSChain, ModelPolicyService
    from app.domain.chat.ports import BaseLLMProvider
    from app.domain.voice.ports import BaseTTSProvider
    from app.infrastructure.tts.openai_tts_provider import OpenAITTSProvider

    app.state.model_policy = ModelPolicyService()

    from app.infrastructure.llm.cohere_provider import CohereLLMProvider
    from app.application.services.model_policy import ModelCapabilities
    
    if settings.GENERATION_PROVIDER == "cohere":
        if not settings.COHERE_API_KEY:
            raise ValueError("COHERE_API_KEY is required for Cohere LLM")
        cohere_llm = CohereLLMProvider(
            model=settings.GENERATION_MODEL,
            temperature=settings.GENERATION_TEMPERATURE,
            api_key=settings.COHERE_API_KEY
        )
        app.state.model_policy.registry.register_llm(
            "cohere_llm", 
            cohere_llm, 
            ModelCapabilities(streaming_supported=True, latency_tier="fast")
        )
    openai_tts = OpenAITTSProvider(voice="aria", speed=0.8)
    app.state.tts_provider = openai_tts

    app.state.model_policy.registry.register_tts("openai_tts", openai_tts)

    from app.domain.voice.filler_cache import init_filler_cache

    init_filler_cache(openai_tts)

    def create_asr_service():
        if settings.ASR_PROVIDER == "groq":
            from app.infrastructure.audio.groq_asr import GroqASRProvider
            return GroqASRProvider(
                api_key=settings.GROQ_API_KEY, 
                model=settings.ASR_MODEL, 
                language=settings.ASR_LANGUAGE
            )
        return None
    def create_llm_service() -> BaseLLMProvider:
        # Note: Handled by fast-fail at startup
        return app.state.model_policy.router.get_llm_chain()

    def create_tts_service() -> BaseTTSProvider:
        return FallbackTTSChain(OpenAITTSProvider(voice="aria", speed=0.8), fallbacks=[])

    async def create_retrieval_service() -> RetrievalUseCase:
        from app.application.rag.token_budget import TokenBudgetManager
        from app.infrastructure.vector.pgvector_store import SessionManagedPGVectorStore

        return RetrievalUseCase(
            embedder=app.state.embedder,
            vector_store=SessionManagedPGVectorStore(),
            reranker=app.state.reranker,
            budget_manager=TokenBudgetManager(),
        )

    # ── Chat database session factory (provides a fresh AsyncSession per call) ─────
    import contextlib

    @contextlib.asynccontextmanager
    async def get_chat_repo():
        from app.infrastructure.db.database import AsyncSessionLocal
        from app.infrastructure.db.repositories.chat_repository import ChatRepository

        async with AsyncSessionLocal() as db:
            yield ChatRepository(db, storage_provider=app.state.storage)
            await db.commit()

    def create_animation_stage():
        from app.application.animation.intelligence_service import AnimationIntelligenceService
        from app.application.voice.pipeline_stages import AnimationStage
        from app.infrastructure.tts.viseme_generator import VisemeGenerator

        try:
            viseme_gen = VisemeGenerator()
        except RuntimeError as e:
            logger.warning(f"Viseme generation disabled: {e}")
            viseme_gen = None
            app.state.viseme_disabled = True

        return AnimationStage(
            animation_service=AnimationIntelligenceService(), viseme_generator=viseme_gen
        )

    def create_chat_context_cache():
        from app.infrastructure.cache.chat_context_cache import ChatContextCache

        return ChatContextCache()

    # ── Session manager (needs to be updated to accept a repo factory) ───────
    session_manager = SessionManager(
        chat_repository_factory=get_chat_repo,
        session_timeout_sec=settings.SESSION_TIMEOUT_SEC,
        session_cleanup_interval=settings.SESSION_CLEANUP_INTERVAL,
        asr_service_factory=create_asr_service,
        llm_service_factory=create_llm_service,
        tts_service_factory=create_tts_service,
        retrieval_service_factory=create_retrieval_service,
        animation_stage_factory=create_animation_stage,
        chat_context_cache_factory=create_chat_context_cache,
        intent_classifier=getattr(app.state, "intent_classifier", None),
    )
    init_session_manager(session_manager)

    # ── WebSocket connection manager ────────────────────────────────────────
    ws_connection_manager = WSConnectionManager(history_size=250)
    init_ws_connection_manager(ws_connection_manager)
    await ws_connection_manager.start_pubsub_listener()
    pubsub_task = getattr(ws_connection_manager, "_pubsub_task", None)
    if pubsub_task:
        background_tasks.add(pubsub_task)
        pubsub_task.add_done_callback(background_tasks.discard)

    # ── Background task: cleanup idle sessions ──────────────────────────────
    async def cleanup_task():
        try:
            while True:
                await asyncio.sleep(settings.SESSION_CLEANUP_INTERVAL)
                removed = await session_manager.cleanup_idle()
                if removed:
                    logger.info(f"Cleanup: removed {removed} idle sessions")
        except asyncio.CancelledError:
            logger.info("Session cleanup task cancelled")
            raise

    task = asyncio.create_task(cleanup_task(), name="session_cleanup")
    background_tasks.add(task)
    task.add_done_callback(background_tasks.discard)

    # ── Background task: orphan cleanup ─────────────────────────────────────
    async def orphan_cleanup_task():
        try:
            while True:
                await asyncio.sleep(30 * 60) # 30 minutes
                from app.infrastructure.db.database import AsyncSessionLocal
                from app.infrastructure.db.cleanup_jobs import cleanup_orphaned_and_stuck_documents
                logger.info("Starting cleanup_orphaned_and_stuck_documents")
                async with AsyncSessionLocal() as db:
                    try:
                        result = await cleanup_orphaned_and_stuck_documents(db)
                        logger.info(f"Cleanup job finished: {result}")
                    except Exception as e:
                        logger.error(f"Cleanup job failed: {e}")
        except asyncio.CancelledError:
            logger.info("Orphan cleanup task cancelled")
            raise

    orphan_task = asyncio.create_task(orphan_cleanup_task(), name="orphan_cleanup")
    background_tasks.add(orphan_task)
    orphan_task.add_done_callback(background_tasks.discard)

    # ── Background task: stale queue recovery ──────────────────────────────
    async def stale_queue_recovery_task():
        try:
            while True:
                await asyncio.sleep(settings.STALE_QUEUE_THRESHOLD_MINUTES * 60)
                from datetime import timedelta

                from sqlalchemy import select

                from app.infrastructure.db.database import AsyncSessionLocal
                from app.infrastructure.db.models import Document
                from app.shared.config import utc_now

                async with AsyncSessionLocal() as db:
                    threshold_dt = utc_now() - timedelta(
                        minutes=settings.STALE_QUEUE_THRESHOLD_MINUTES
                    )
                    stmt = select(
                        Document.id,
                        Document.user_id,
                        Document.filename,
                        Document.file_type,
                        Document.upload_source,
                        Document.storage_key,
                    ).where(
                        Document.current_stage == "QUEUED",
                        Document.upload_date < threshold_dt,
                        Document.started_at.is_(None),
                    )
                    result = await db.execute(stmt)
                    rows = result.fetchall()
                    for row in rows:
                        await app.state.arq_pool.enqueue_job(
                            "run_ingestion_task",
                            doc_id=str(row.id),
                            user_id=str(row.user_id),
                            filename=row.filename,
                            file_type=row.file_type,
                            upload_source=row.upload_source,
                            storage_key=row.storage_key,
                        )
                        logger.warning({"event": "stale_job_recovered", "document_id": str(row.id)})
        except asyncio.CancelledError:
            logger.info("Stale queue recovery task cancelled")
            raise

    stale_task = asyncio.create_task(stale_queue_recovery_task(), name="stale_queue_recovery")
    background_tasks.add(stale_task)
    stale_task.add_done_callback(background_tasks.discard)

    logger.info(
        f"Session cleanup task started | "
        f"timeout={settings.SESSION_TIMEOUT_SEC}s | "
        f"interval={settings.SESSION_CLEANUP_INTERVAL}s"
    )

    # Mark the server as fully ready — health check returns 'ok' only after this point.
    app.state.ready = True
    logger.info(f"Server ready on {settings.HOST}:{settings.PORT}")

    yield

    # ── Shutdown ──────────────────────────────────────────────────────────────
    logger.info("Shutting down...")
    for task in background_tasks:
        task.cancel()
    await asyncio.gather(*background_tasks, return_exceptions=True)
    arq_pool = getattr(app.state, "arq_pool", None)
    if arq_pool is not None:
        await arq_pool.close()
    await close_redis()
    await close_db()
    embedder = getattr(app.state, "embedder", None)
    if embedder is not None:
        await embedder.close()
    from app.infrastructure.rag.reranker import CrossEncoderReranker

    # Only shut down the executor if the real reranker was ever loaded
    if not CrossEncoderReranker._import_failed:
        CrossEncoderReranker.shutdown_executor()
    logger.info("Server shutdown complete")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        debug=settings.DEBUG,
        lifespan=lifespan,
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
    )

    @app.middleware("http")
    async def correlation_id_middleware(request: Request, call_next) -> Response:
        from app.shared.request_context import set_trace_id

        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id

        # Set unified trace context
        set_trace_id(request_id)

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    # ── CORS ──────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── CSRF ──────────────────────────────────────────────────────────────────
    from app.shared.csrf import CSRFMiddleware

    app.add_middleware(CSRFMiddleware)

    from app.shared.error_envelope_middleware import setup_error_handlers

    setup_error_handlers(app)

    # ── JWKS Endpoint ─────────────────────────────────────────────────────────
    @app.get("/.well-known/jwks.json", tags=["auth"])
    async def jwks_endpoint():
        from app.shared.key_manager import get_jwks

        return get_jwks()

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(api_v1_router)

    # ── Prometheus Metrics ────────────────────────────────────────────────────
    from prometheus_client import make_asgi_app

    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="debug" if settings.DEBUG else "info",
        ws_max_size=settings.WS_MAX_MESSAGE_SIZE,
    )
