# VirtAI SRE & DevOps Runbook

This guide covers operational instructions for deploying, configuring, monitoring, and troubleshooting the VirtAI backend.

---

## 1. Environment Variables Guide

The application is configured using standard environment variables. These are loaded from `.env` in development or injected directly in production environments. See [config.py](file:///D:/A/Projects/VirtAI-Project/backend/app/shared/config.py) for the complete schemas.

### Core Configuration
*   `ENVIRONMENT`: Set to `development`, `testing`, or `production`. Under `production`, `DEBUG` must be `False` and strict safety validations are active.
*   `DEBUG`: Boolean flag. Set to `True` for hot-reloads and tracebacks.
*   `JWT_SECRET_KEY`: A cryptographically secure secret used to sign session cookies and JWT access tokens. Must be changed in production.

### Database Settings
*   `POSTGRES_USER`: The PostgreSQL database owner username (default: `postgres`).
*   `POSTGRES_PASSWORD`: The PostgreSQL database owner password (default: `postgres`).
*   `POSTGRES_HOST`: PostgreSQL hostname (default: `localhost`).
*   `POSTGRES_PORT`: PostgreSQL port (default: `5432`).
*   `POSTGRES_DB`: The PostgreSQL database name (default: `virtai`).
*   `DATABASE_URL` (Property): Automatically constructed from the PG variables using `postgresql+asyncpg://`.

### Redis Cache Settings
*   `REDIS_URL`: The Redis connection string (e.g., `redis://localhost:6379/0`). Used for chat session caching, blacklists, and worker queues.

### File Storage & Uploads
*   `MAX_UPLOAD_SIZE_MB`: Maximum allowed size of document uploads in megabytes (default: `25`).
*   `UPLOAD_BASE_PATH`: Folder path where uploaded PDFs are stored prior to processing.
*   `AUDIO_STORAGE_PATH`: Directory for temporary session audio.

### AI Providers & API Keys
*   `GROQ_API_KEY`: API token for Groq Cloud. Used for Llama models.
*   `OPENAI_API_KEY`: API token for OpenAI (used if Generation/TTS provider is OpenAI).
*   `COHERE_API_KEY`: API token for Cohere. Used for reranking search results.

---

## 2. Infrastructure Pre-flight Checks

Prior to launching the application router or background workers in a new environment, run the visual pre-flight check script. This script verifies network connectivity, confirms databases exist, tests pgvector extensions, and validates embedding dimensions.

Execute the healthcheck from the backend directory:
```bash
python scripts/system_healthcheck.py
```

### Script Output Checks:
*   **PostgreSQL**: Verifies basic connection and checks table schemas.
*   **pgvector**: Verifies extension availability (`CREATE EXTENSION IF NOT EXISTS vector`).
*   **Alembic**: Confirms the schema is at the `head` revision.
*   **FastEmbed**: Validates dimension correctness by embedding a test sentence.
*   **Redis**: Standard `PING`/`PONG` ping check.

---

## 3. Database Migrations & Deployments

We use **Alembic** to manage PostgreSQL schema migrations. Always run migrations before starting the main application server.

Run these commands from the `backend/` directory:
1.  **Check Current Revision**:
    ```bash
    alembic current
    ```
2.  **Run Pending Migrations (Upgrade to Head)**:
    ```bash
    alembic upgrade head
    ```
3.  **Generate a New Migration (Dev only)**:
    ```bash
    alembic revision --autogenerate -m "Add description here"
    ```
4.  **Downgrade Schema**:
    ```bash
    alembic downgrade -1
    ```

*Warning:* Never delete migration history files in `alembic/versions/` on production branches. This will corrupt the migration state tracking.

---

## 4. Troubleshooting Guide

### Issue: Redis Times Out / HTTP 401 Unauthorized
*   **Symptoms**: Web clients receive HTTP 401 Unauthorized for valid credentials, or requests hang.
*   **Root Cause**: The JWT verification middleware checks active blacklists stored in Redis. If Redis is down, the connection fails closed (for security safety).
*   **Resolution**:
    1. Verify Redis is running: `docker ps | grep redis` or `redis-cli ping`
    2. Check the logs for connection delays.
    3. Verify `REDIS_URL` matches host configurations.
    4. Restart Redis: `docker restart virtai-redis`.

### Issue: Missing Viseme Dependencies / Edge-TTS Audio Generation Fails
*   **Symptoms**: Real-time WebSocket session closes immediately when audio generation starts, or logs show `FileNotFoundError` or Viseme extraction crashes.
*   **Root Cause**: TTS/Lip sync relies on system-level `ffmpeg` (and optionally Rhubarb) to process audio streams. If they are missing from the host path, the pipeline crashes.
*   **Resolution**:
    1. Ensure `ffmpeg` is installed on the server: `ffmpeg -version`.
    2. For Alpine-based Docker images, ensure `ffmpeg` and `libsndfile` are added during docker builds.
    3. Verify the TTS config rate parameters in `.env`.

### Issue: Missing Locust for Load Tests
*   **Symptoms**: QA pipeline execution logs show failures in `load_tests`.
*   **Root Cause**: Locust is a development dependency and may not be installed in minimal staging environments.
*   **Resolution**:
    *   This is expected for environments running strictly unit tests. The test runner `run_tests.sh` isolates `load_tests` from the exit status codes so it will not break builds.
    *   To fix: Run `pip install locust` to run throughput validations locally.
