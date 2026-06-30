# Contributing to VirtAI

This repository strictly adheres to production-grade software engineering practices. We prioritize correctness, reliability, and maintainability. By contributing, you agree to follow the guidelines outlined below.

## 1. Local Development Setup

### Backend (FastAPI, Python 3.11)
Navigate to the `backend` directory and set up your environment:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

To run the backend locally:
```bash
# Ensure Redis and Postgres are running (locally or via Docker)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend (React, Node.js 20)
Navigate to the `frontend` directory and install dependencies exactly as locked:
```bash
cd frontend
npm ci
```

To run the frontend locally:
```bash
npm run dev
```

*Alternatively, run the full stack via Docker:*
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## 2. Architecture Guidelines

We strictly enforce **Clean Architecture**. The repository is designed to separate concerns across strict boundaries.
- **Domain Layer:** Contains business entities and core rules. Zero external dependencies.
- **Application Layer:** Orchestrates use cases. Interacts with the domain and defines interfaces (ports) for external services.
- **Infrastructure Layer:** Implements database access (SQLAlchemy/Alembic), external API clients, and message brokering (Redis).
- **Presentation Layer:** FastAPI HTTP endpoints and WebSocket routers.

### WebSocket and State Management
- **Lifecycle Management:** WebSocket connections must be cleanly established, tracked, and properly terminated. Always handle the `WebSocketDisconnect` exception explicitly.
- **State Synchronization:** Shared state between clients must be managed via Redis, never via in-memory Python structures (e.g., global dicts). This ensures the application remains stateless and horizontally scalable across multiple workers.

## 3. Branching Strategy

We enforce a strict Git flow naming convention. All development branches must be prefixed according to their intent:
- `feat/your-feature-name` - For new features
- `fix/your-bugfix-name` - For bug fixes
- `refactor/your-refactor-name` - For code restructuring without behavioral changes
- `docs/your-doc-update` - For documentation updates

Commits directly to `main` or `dev` are prohibited.

## 4. Code Quality & Linting

Our CI pipelines strictly enforce code quality. Code that fails these checks will be automatically rejected by branch protection rules.

### Backend (Python)
- **Formatter:** `Black`
- **Linter:** `Ruff`
- **Type Checker:** `Mypy`

Run checks locally before pushing:
```bash
cd backend
python -m black app tests
python -m ruff check app tests --fix
python -m mypy --follow-imports=silent app/domain app/application
```

### Frontend (TypeScript/React)
- **Formatter:** `Prettier`
- **Linter:** `ESLint`
- **Type Checker:** `tsc`

Run checks locally before pushing:
```bash
cd frontend
npm run format:check
npm run lint
npx tsc --noEmit
```

## 5. Pull Request Process

To ensure high quality and velocity for the team, all Pull Requests must meet the following criteria:
1. **Passing CI:** All GitHub Actions (Backend CI, Frontend CI, Security Scans) must pass.
2. **Testing:** New features must include Pytest/Vitest coverage. Bugfixes must include a regression test proving the fix.
3. **Atomic Commits:** Commits should represent a single logical change. Squash messy WIP commits before requesting a review.
4. **Side Effects Addressed:** You must explicitly document in your PR description if the code introduces database schema changes (Alembic), modifies WebSocket payload structures, or alters required environment variables.
