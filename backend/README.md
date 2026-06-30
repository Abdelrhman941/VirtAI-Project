# **VirtAI Backend Gateway**

VirtAI is a real-time, interactive, AI-powered educational avatar platform. It enables students to upload course documents, generate instant visualizations and quizzes, and learn via conversational voice synthesis paired with real-time lip-synced animations.

This repository contains the FastAPI server, real-time WebSocket pipelines, and asynchronous RAG ingestion worker task queues.

<div style="width: 100%; height: 15px; background: linear-gradient(to right, rgb(235, 238, 212), rgb(235, 238, 212));"></div>

## **🧭 Documentation Index**

To explore the codebase and infrastructure guidelines, refer to the following resources:

- [Visual Architecture Map](docs/ARCHITECTURE.md): Database Entity-Relationship Diagrams (ERDs), WebSocket message routing sequences, and RAG architectures.
- [Developer Code Tour](docs/CODE_TOUR.md): A guide mapping Clean Architecture folders (`domain`, `application`, `infrastructure`, `presentation`) and explaining request execution paths.
- [SRE & Operations Runbook](docs/RUNBOOK.md): Deployment settings, environment variable explanations, database migrations, and failure troubleshooting procedures.

<div style="width: 100%; height: 15px; background: linear-gradient(to right, rgb(235, 238, 212), rgb(235, 238, 212));"></div>

## **🛠️ Local Quickstart**

### Prerequisites

- **Python**: `>=3.10`
- **PostgreSQL**: `>=15` (with the `pgvector` extension)
- **Redis**: `>=6.2`

### 1. Installation

Clone the repository, navigate to the backend directory, and create a virtual environment:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -e .[dev]
```

### 2. Environment Setup

Copy the configuration template and modify variables:

```bash
cp .env.example .env
```

Ensure you set your `GROQ_API_KEY`, `OPENAI_API_KEY`, and database passwords inside the `.env` file.

### 3. Pre-flight Verification & Migrations

Verify that your database and Redis cache are active, then run healthchecks:

```bash
# Run migrations
alembic upgrade head

# Run visual healthcheck
python scripts/system_healthcheck.py
```

### 4. Running the Dev Servers

Start the web server and the background tasks queue worker:

```bash
# Start FastAPI Router (exposes REST and WebSockets)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Start ARQ background ingestion worker
arq scripts.run_worker.WorkerSettings
```

<div style="width: 100%; height: 15px; background: linear-gradient(to right, rgb(235, 238, 212), rgb(235, 238, 212));"></div>

## **🧪 Quality Assurance Pipeline**

We enforce strict linting, type-checking, security scanning, and architectural layer isolation.

### Run Cleanups

To clean development caches, compilation artifacts, and reports safely:

```bash
bash scripts/clean.sh
bash scripts/clean.sh --full
python scripts/clean.py          # Safe Cache Clean
python scripts/clean.py --full   # Clean Caches + Reports + Logs
```

### Run Tests Suite

To run the automated tests across all architectural layers (domain, shared, unit, infrastructure, application, presentation, and integration):

```bash
bash scripts/run_tests.sh
```

### Run Quality Gate Checks (Ruff, MyPy, Bandit, Tests, Coverage)

To run the full QA checks pipeline gate:

```bash
bash scripts/run_quality_pipeline.sh
```

This script will output a visual quality dashboard, compile reports under `quality_reports/`, and return exit code `0` only if all checks pass.
