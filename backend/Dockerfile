# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────
# VirtAI Backend — FastAPI
# Optimized Development Dockerfile
# ─────────────────────────────────────────────────────────────

FROM pytorch/pytorch:2.6.0-cuda12.6-cudnn9-runtime

ARG DEBIAN_FRONTEND=noninteractive
# ── Environment ─────────────────────────────────────────────
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_ROOT_USER_ACTION=ignore \
    XDG_CACHE_HOME=/app/.cache \
    HF_HOME=/app/.cache/huggingface \
    HF_HUB_DISABLE_TELEMETRY=1 \
    FASTEMBED_CACHE_DIR=/app/.cache/fastembed

WORKDIR /app

ARG EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
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
# Install stable, heavy ML dependencies first to avoid re-downloading
# when pyproject.toml changes (e.g., adding a dev dependency).
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip install \
    "sentence-transformers>=2.7.0" \
    "fastembed>=0.3.1" \
    "langchain==1.3.2" \
    "langgraph==1.2.2" \
    "pymupdf>=1.24.0" \
    "cohere>=5.0.0" \
    "qdrant-client>=1.10.0"

# Pre-download FastEmbed model into an image layer so production startup does
# not fetch model files dynamically. A named Docker volume can persist this
# cache across container replacements.
# MOVED UP: Cache this BEFORE pyproject.toml is copied so dependency changes don't invalidate it.
RUN mkdir -p /app/.cache/fastembed /app/.cache/huggingface && \
    python -c "import os; from fastembed import TextEmbedding; model=os.environ.get('EMBEDDING_MODEL', 'BAAI/bge-small-en-v1.5'); list(TextEmbedding(model_name=model).embed(['warmup']))"

# ── Install Python dependencies (Layer 2) ──────────────────
# Copy only the dependency manifest so pip install is cached
# independently of application source changes.
COPY pyproject.toml ./

# Minimal stub so "pip install ." can resolve the package
# without copying the full source tree yet.
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
RUN mkdir -p /app/.data/sessions /app/.data/uploads && \
    useradd -m appuser && \
    chown -R appuser:appuser /app/.data && \
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
