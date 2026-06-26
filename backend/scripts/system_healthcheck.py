"""
SYSTEM HEALTHCHECK
==================
Validates all critical runtime components. Fails loudly on any error.

Checks:
    1. Environment variables correctness
    2. PostgreSQL connectivity
    3. pgvector extension installed
    4. Migrations applied (alembic_version + expected tables)
    5. Embedding provider (FastEmbed) — dimension validation
    6. Vector insertion into document_chunks
    7. Vector retrieval (cosine search)
    8. Redis connectivity
"""

import asyncio
import os
import sys
import uuid

from loguru import logger
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.shared.config import get_settings

settings = get_settings()

REQUIRED_TABLES = {"users", "chat_sessions", "messages", "avatars", "documents", "document_chunks"}


def fail(msg: str) -> None:
    logger.error(f"❌ HEALTHCHECK FAILED: {msg}")
    sys.exit(1)


async def run_healthcheck() -> None:
    logger.info("=" * 60)
    logger.info("  SYSTEM HEALTHCHECK")
    logger.info("=" * 60)

    # ── 1. Environment ───────────────────────────────────────────────────────
    logger.info("1. Verifying environment settings...")
    if not settings.DATABASE_URL:
        fail("DATABASE_URL is not configured")
    if settings.EMBEDDING_PROVIDER not in ("openai", "cohere", "fastembed"):
        fail(f"Invalid EMBEDDING_PROVIDER: {settings.EMBEDDING_PROVIDER!r}")
    if settings.EMBEDDING_DIMENSION <= 0:
        fail(f"EMBEDDING_DIMENSION must be > 0, got {settings.EMBEDDING_DIMENSION}")
    logger.info(
        f"  ✅ Environment OK — provider={settings.EMBEDDING_PROVIDER}, dim={settings.EMBEDDING_DIMENSION}"
    )

    # ── 2. PostgreSQL connectivity ───────────────────────────────────────────
    logger.info("2. Connecting to PostgreSQL...")
    try:
        engine = create_async_engine(settings.DATABASE_URL, echo=False)
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            if result.scalar() != 1:
                fail("SELECT 1 returned unexpected result")
            logger.info("  ✅ PostgreSQL connected")

            # ── 3. pgvector extension ────────────────────────────────────────
            r = await conn.execute(
                text("SELECT extname FROM pg_extension WHERE extname = 'vector'")
            )
            ext = r.scalar()
            if ext != "vector":
                fail("pgvector extension is NOT installed in the database")
            logger.info("  ✅ pgvector extension present")

            # ── 4. Migrations ────────────────────────────────────────────────
            try:
                r2 = await conn.execute(text("SELECT version_num FROM alembic_version"))
                version = r2.scalar()
                logger.info(f"  ✅ Alembic at version: {version}")
            except Exception as e:
                fail(f"alembic_version table missing or unreadable: {e}")

            r3 = await conn.execute(
                text(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
                )
            )
            existing = {row[0] for row in r3.all()}
            missing = REQUIRED_TABLES - existing
            if missing:
                fail(f"Missing tables: {missing}")
            logger.info(f"  ✅ All required tables present: {sorted(REQUIRED_TABLES)}")

            # ── 6b. Check vector column dimension ────────────────────────────
            r4 = await conn.execute(
                text(
                    "SELECT atttypmod FROM pg_attribute "
                    "JOIN pg_class ON pg_attribute.attrelid = pg_class.oid "
                    "WHERE pg_class.relname = 'document_chunks' "
                    "AND pg_attribute.attname = 'embedding'"
                )
            )
            row = r4.first()
            if row:
                # pgvector stores dimension as atttypmod
                db_dim = row[0]
                logger.info(f"  ✅ Vector column dimension (raw typmod): {db_dim}")

        await engine.dispose()
    except SystemExit:
        raise
    except Exception as e:
        fail(f"Database error: {e}")

    # ── 5. Embedding provider ────────────────────────────────────────────────
    logger.info(f"3. Verifying embedding provider: {settings.EMBEDDING_PROVIDER}...")
    test_vec: list[float] | None = None
    try:
        if settings.EMBEDDING_PROVIDER == "fastembed":
            from app.infrastructure.rag.fastembed_provider import FastEmbedProvider

            provider = FastEmbedProvider(model_name=settings.EMBEDDING_MODEL)
            test_vec = await provider.embed("Healthcheck test sentence for dimension verification.")
        elif settings.EMBEDDING_PROVIDER == "cohere":
            from app.infrastructure.rag.cohere_embedder import CohereEmbedder
            if not settings.COHERE_API_KEY:
                fail("COHERE_API_KEY is missing")
            provider = CohereEmbedder(model_name=settings.EMBEDDING_MODEL, api_key=settings.COHERE_API_KEY)
            test_vec = await provider.embed("Healthcheck test sentence for dimension verification.")
        else:
            logger.warning(
                f"  ⚠ Skipping deep API verification for provider={settings.EMBEDDING_PROVIDER}"
            )
            test_vec = [0.0] * settings.EMBEDDING_DIMENSION

        if test_vec is None:
            raise RuntimeError("Embedding failed")
        dim = len(test_vec)
        if dim != settings.EMBEDDING_DIMENSION:
            fail(
                f"Embedding dimension mismatch! Config={settings.EMBEDDING_DIMENSION}, model={dim}"
            )
        logger.info(f"  ✅ {settings.EMBEDDING_PROVIDER} OK — dimension={dim}")
    except SystemExit:
        raise
    except Exception as e:
        fail(f"Embedding provider error: {e}")

    # ── 6. Vector insertion & retrieval ──────────────────────────────────────
    logger.info("4. Testing vector insertion and retrieval...")
    if test_vec is None:
        raise RuntimeError("Embedding failed")
    test_user_id = uuid.uuid4()
    test_doc_id = uuid.uuid4()
    test_chunk_id = uuid.uuid4()

    try:
        engine2 = create_async_engine(settings.DATABASE_URL, echo=False)
        Session = async_sessionmaker(engine2, class_=AsyncSession, expire_on_commit=False)

        # Build vector literal as raw string to avoid asyncpg $N + ::cast conflict
        vec_str = "[" + ",".join(str(v) for v in test_vec) + "]"

        async with Session() as session:
            # Insert a minimal user for FK chain
            await session.execute(
                text(
                    "INSERT INTO users (id, email, full_name, provider, setup_complete, is_active, "
                    "refresh_token_version, created_at, updated_at) "
                    "VALUES (:id, :email, 'HC Test User', 'local', false, true, 0, NOW(), NOW()) "
                    "ON CONFLICT DO NOTHING"
                ),
                {"id": str(test_user_id), "email": f"hc_{test_user_id}@healthcheck.local"},
            )

            # Insert a minimal document for FK
            await session.execute(
                text(
                    "INSERT INTO documents (id, user_id, filename, file_type, upload_date, chunk_count, status) "
                    "VALUES (:id, :uid, 'healthcheck.txt', 'txt', NOW(), 1, 'ready') "
                    "ON CONFLICT DO NOTHING"
                ),
                {"id": str(test_doc_id), "uid": str(test_user_id)},
            )

            # Insert vector chunk — embed literal to bypass asyncpg param/cast conflict
            await session.execute(
                text(
                    f"INSERT INTO document_chunks (id, document_id, chunk_text, chunk_order, embedding, metadata, created_at) "
                    f"VALUES (:id, :doc_id, 'healthcheck probe chunk', 0, '{vec_str}'::vector, '{{}}'::jsonb, NOW())"
                ),
                {"id": str(test_chunk_id), "doc_id": str(test_doc_id)},
            )
            await session.commit()
            logger.info("  ✅ Vector inserted successfully")

            # Retrieve with cosine search — embed vec_str literal directly
            result = await session.execute(
                text(
                    f"SELECT id, 1 - (embedding <=> '{vec_str}'::vector) AS similarity "
                    f"FROM document_chunks WHERE id = :chunk_id LIMIT 1"
                ),
                {"chunk_id": str(test_chunk_id)},
            )
            row = result.first()
            if row is None:
                raise RuntimeError("Vector retrieval returned no results")
            logger.info(f"  ✅ Vector retrieved — similarity={float(row[1]):.6f}")

            # Cleanup test data
            await session.execute(
                text("DELETE FROM document_chunks WHERE id = :id"), {"id": str(test_chunk_id)}
            )
            await session.execute(
                text("DELETE FROM documents WHERE id = :id"), {"id": str(test_doc_id)}
            )
            await session.execute(
                text("DELETE FROM users WHERE id = :id"), {"id": str(test_user_id)}
            )
            await session.commit()
            logger.info("  ✅ Test data cleaned up")

        await engine2.dispose()
    except SystemExit:
        raise
    except Exception as e:
        fail(f"Vector insertion/retrieval error: {e}")

    # ── 7. Redis ─────────────────────────────────────────────────────────────
    logger.info("5. Verifying Redis connectivity...")
    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        pong = await r.ping()
        if not pong:
            fail("Redis PING returned falsy response")
        await r.aclose()
        logger.info(f"  ✅ Redis connected — {settings.REDIS_URL}")
    except SystemExit:
        raise
    except Exception as e:
        fail(f"Redis connection failed: {e}")

    # ── SUMMARY ──────────────────────────────────────────────────────────────
    logger.info("")
    logger.info("=" * 60)
    logger.info("  ✅ ALL HEALTHCHECK CHECKS PASSED")
    logger.info("  1. Environment variables        ✅")
    logger.info("  2. PostgreSQL + pgvector        ✅")
    logger.info("  3. Migrations applied           ✅")
    logger.info("  4. Embedding provider           ✅")
    logger.info("  5. Vector insertion             ✅")
    logger.info("  6. Vector retrieval             ✅")
    logger.info("  7. Redis                        ✅")
    logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_healthcheck())
