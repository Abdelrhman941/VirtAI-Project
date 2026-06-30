# PROJECT_CONTEXT.md

## Domain Language Glossary
- **DocumentRepository**: The single, unified write-model repository for the Document Ingestion lifecycle. Manages document creation, state transitions (PENDING, PROCESSING, COMPLETED, FAILED), and yields `DomainEvent` objects without side effects.
- **Transactor Constraint**: A strict architectural boundary stating that Repositories MUST NOT call `session.commit()`. The Unit of Work is exclusively controlled by the application Use Cases, ensuring transaction composability.
- **Notification Constraint**: Repositories must not execute side-effects (like Redis Pub/Sub). They instead return standard `DomainEvent` objects, which the Orchestrator/UseCase passes to a dedicated Event Publisher.

## Architectural Decision Records (ADRs)
- **ADR-0001: Unified Document Persistence (CQRS Write Seam)**
  We consolidated `DocumentCrudRepository`, `IngestionStateRepository`, and `DocumentIntegrityService` into a single `DocumentRepository` because the fragmented approach forced the Application Use Cases to orchestrate multiple database entities, leaking implementation details and shattering testability.
- **ADR-0002: Repository Transactor Boundary**
  We chose to enforce the Transactor Constraint (Repositories never `commit()`) because placing commits inside repositories breaks composability when multiple operations need to be atomic across a single Use Case execution.
- **ADR-0003: Pure Domain Events over Side Effects**
  We separated Redis Pub/Sub emissions from the database persistence layer because coupling them made unit testing database logic require complex Redis mocks. Now, repositories return `DomainEvent` objects and the Use Case delegates publishing.

## Felt Pain Points (in plain language)
- (RESOLVED) Hard to test the `IngestDocumentUseCase` because it required mocking three separate Database Repositories and Redis just to verify a state change.
- (RESOLVED) Any changes to the `Document` schema required opening three different repository files.
- (PENDING) The actual RAG/Ingestion chunking logic is currently mixed inside the 200-line `IngestDocumentUseCase.execute()` method, making it hard to test chunking isolation.
- (PENDING) There are 12 orphaned `patch_*.js` and python scripts in the root directory cluttering the project structure.

## Tech Stack
- Frontend: React + TypeScript
- Backend: FastAPI + Python 3.12 (asyncio)
- Database: PostgreSQL (pgvector) + SQLAlchemy (AsyncSession)
- Background Workers: ARQ + Redis
- Testing: pytest + pytest-asyncio
