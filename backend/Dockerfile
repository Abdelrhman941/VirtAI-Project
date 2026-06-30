# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────
# VirtAI Backend — FastAPI
# Optimized Development Dockerfile
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Dependency Extractor ─────────────────────────
FROM python:3.10-slim AS extractor
WORKDIR /build
COPY pyproject.toml .
# Extract specific heavy ML dependencies to avoid invalidating the main
# cache when unrelated dependencies change in pyproject.toml.
RUN grep -E 'sentence-transformers|fastembed|langchain==|langgraph==|pymupdf>=|cohere|qdrant-client' pyproject.toml | sed -E 's/^[ \t]*"([^"]+)".*/\1/' > requirements-heavy.txt

# ── Stage 2: Main Image ───────────────────────────────────
FROM pytorch/pytorch:2.6.0-cuda12.6-cudnn9-runtime

ARG DEBIAN_FRONTEND=noninteractive
# ── Environment ─────────────────────────────────────────────
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_ROOT_USER_ACTION=ignore \
    XDG_CACHE_HOME=/app/.cache \
    HF_HOME=/app/models/huggingface \
    HF_HUB_DISABLE_TELEMETRY=1

WORKDIR /app

ARG EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-mpnet-base-v2
ENV EMBEDDING_MODEL=${EMBEDDING_MODEL}

# ── System dependencies ────────────────────────────────────
RUN rm -f /etc/apt/apt.conf.d/docker-clean; echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    gosu \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-ara \
    poppler-utils && \
    tesseract --version

# ── Install heavy ML dependencies (Layer 1) ────────────────
COPY --from=extractor /build/requirements-heavy.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip install -r requirements-heavy.txt



# ── Install Python dependencies (Layer 2) ──────────────────
# Copy only the dependency manifest so pip install is cached
# independently of application source changes.
COPY pyproject.toml ./

# Minimal stub so "pip install ." can resolve the package
RUN --mount=type=cache,target=/root/.cache/pip \
    mkdir -p app && touch app/__init__.py && \
    pip install .

# ── Copy application source (invalidates less often) ───────
COPY app ./app

# ── Copy Alembic migration scripts & config ────────────────
# Required so `alembic upgrade head` works inside the container.
COPY alembic.ini ./alembic.ini
COPY alembic ./alembic

# ── Runtime directories & Security ───────────────────────────
RUN mkdir -p /app/.data/sessions /app/.data/uploads /app/models && \
    useradd -m appuser && \
    chown -R appuser:appuser /app/.data && \
    chown -R appuser:appuser /app/models && \
    chown -R appuser:appuser /app

COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

# ── Expose port ────────────────────────────────────────────
EXPOSE 8000

# ── Healthcheck ────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# ── Start server ───────────────────────────────────────────
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
