# VirtAI Codebase Tour & Architectural Map

Welcome to the VirtAI Backend onboarding guide. This tour details the code organization, boundaries, and runtime flows of the system. VirtAI strictly enforces **Clean Architecture** principles, ensuring that core business entities and rules are decoupled from database technologies, network frameworks, and third-party AI services.

---

## 1. Clean Architecture Layers Map

Our codebase is located inside the [app/](file:///D:/A/Projects/VirtAI-Project/backend/app) directory. Dependencies only flow inwards: 
`Presentation ──> Application ──> Domain <── Infrastructure`

```
app/
├── domain/            # Pure Business Logic & Domain Interfaces (Ports)
├── application/       # Use Cases, RAG Orchestration, Voice Pipelines
├── infrastructure/    # DB Repositories, Redis Caching, External AI Adapters
├── presentation/      # HTTP Routers, WebSocket Gateways, DTOs & Schemas
└── main.py            # Dependency Injection & Application Bootstrapper
```

### Layer 1: The Domain Layer (`app/domain/`)
The Domain layer represents the core business definitions. It has **zero dependencies** on third-party frameworks, database libraries (SQLAlchemy), or web routers.
*   **Entities**: Pydantic models mapping domain concepts (e.g., user profiles, document chunks, presentation states). See [app/domain/rag/entities.py](file:///D:/A/Projects/VirtAI-Project/backend/app/domain/rag/entities.py).
*   **Ports**: Abstract classes or interfaces defining contracts for operations that must be implemented by external adapters (databases, LLMs, storage). See [app/domain/chat/ports.py](file:///D:/A/Projects/VirtAI-Project/backend/app/domain/chat/ports.py).

### Layer 2: The Application Layer (`app/application/`)
The Application layer implements the Use Cases of the system. It orchestrates the flow of data using Domain models and interacts with outer layers exclusively through Domain Ports.
*   **Explain Use Case (`app/application/explain/`)**: Manages the multi-slide presentation slide deck walk-through, coordinating events like slide change or questions. See [explain_use_case.py](file:///D:/A/Projects/VirtAI-Project/backend/app/application/explain/explain_use_case.py).
*   **RAG Use Cases (`app/application/rag/`)**: Handles document summaries, interactive quiz generation, and diagrams. It also handles the token budget constraints. See [token_budget.py](file:///D:/A/Projects/VirtAI-Project/backend/app/application/rag/token_budget.py).
*   **Voice Pipeline (`app/application/voice/`)**: Orchestrates the multi-stage async audio loop (Audio In -> Whisper STT -> LLM prompt -> Edge-TTS synthesis -> Visemes -> Client). See [pipeline_stages.py](file:///D:/A/Projects/VirtAI-Project/backend/app/application/voice/pipeline_stages.py).

### Layer 3: The Infrastructure Layer (`app/infrastructure/`)
The Infrastructure layer contains the concrete adapters implementing the Domain Ports. It handles raw database configurations, SQL queries, Redis interactions, and API calls to third-party endpoints.
*   **Database & Repositories (`app/infrastructure/db/`)**: Relational schemas and repo patterns. See [models.py](file:///D:/A/Projects/VirtAI-Project/backend/app/infrastructure/db/models.py) and [repositories/](file:///D:/A/Projects/VirtAI-Project/backend/app/infrastructure/db/repositories/).
*   **Vector Database (`app/infrastructure/vector/`)**: PGVector integration for storage and hybrid/dense search of document embeddings. See [pgvector_store.py](file:///D:/A/Projects/VirtAI-Project/backend/app/infrastructure/vector/pgvector_store.py).
*   **AI Providers (`app/infrastructure/llm/` & `app/infrastructure/tts/`)**: Client wrappers for Groq, Cohere, OpenAI, and Edge-TTS. See [groq_provider.py](file:///D:/A/Projects/VirtAI-Project/backend/app/infrastructure/llm/groq_provider.py).
*   **Caches & Workers (`app/infrastructure/cache/` & `app/infrastructure/worker/`)**: Caching decorators, Redis lock pools, and ARQ background job worker setups.

### Layer 4: The Presentation Layer (`app/presentation/`)
The Presentation layer is the boundary to the external web. It exposes REST and WebSocket routes using FastAPI, parses JSON payloads, handles cookie sessions, and performs transport-level input validation.
*   **HTTP Endpoints (`app/presentation/http/`)**: Traditional endpoints for upload, login, and registration. See [v1/endpoints/](file:///D:/A/Projects/VirtAI-Project/backend/app/presentation/http/v1/endpoints/).
*   **WebSocket Gateway (`app/presentation/ws/`)**: The high-frequency real-time link. It handles incoming frame packet dispatching and voice turn coordination. See [gateway.py](file:///D:/A/Projects/VirtAI-Project/backend/app/presentation/ws/gateway.py) and [voice_mode_handler.py](file:///D:/A/Projects/VirtAI-Project/backend/app/presentation/ws/voice_mode_handler.py).

---

## 2. Narrative Data Flow & Dependency Injection

To understand how the layers isolate their concerns, let us walk through a user uploading a PDF and asking the avatar to explain it:

1.  **Request Gateways (Presentation)**:
    *   The client posts a PDF file to `/api/v1/documents/upload`. The [documents.py](file:///D:/A/Projects/VirtAI-Project/backend/app/presentation/http/v1/endpoints/documents.py) router verifies HTTP authentication, enforces file limits, and calls the `IngestDocumentUseCase`.
2.  **Job Queuing & Parsing (Application to Infrastructure)**:
    *   The `IngestDocumentUseCase` creates a database record in `documents` with status `QUEUED`.
    *   It schedules a background parsing job on the Redis ARQ queue via [ingestion_task.py](file:///D:/A/Projects/VirtAI-Project/backend/app/infrastructure/worker/ingestion_task.py).
    *   The background worker wakes up, invokes the `PDFMarkdownExtractor` to extract raw text, splits it via `SmartChunker`, generates vector embeddings via `FastEmbedProvider`, and saves chunks to PostgreSQL.
3.  **Real-Time WebSocket Activation (Presentation)**:
    *   The user establishes a WebSocket connection with the server via [gateway.py](file:///D:/A/Projects/VirtAI-Project/backend/app/presentation/ws/gateway.py).
    *   The [connection_lifecycle.py](file:///D:/A/Projects/VirtAI-Project/backend/app/presentation/ws/connection_lifecycle.py) processes the handshake, fetches the active session, instantiates the `VoiceModeHandler` and routes packets.
4.  **Retrieval & LLM Inference (Application to Domain to Infrastructure)**:
    *   When the user asks a question, the `VoiceModeHandler` triggers a turn.
    *   It calls `RetrievalUseCase` (Application) to pull relevant document chunks.
    *   `RetrievalUseCase` calls `VectorStore.hybrid_search` (Domain Port).
    *   The `PGVectorStore` (Infrastructure Adapter) executes the cosine similarity search and returns `DocumentChunk` entities.
    *   `RetrievalUseCase` maps these chunks to a token budget (`TokenBudget`), ensuring context fits model limits.
    *   The use case passes this text to the `BaseLLMProvider` (Domain Port) which is adapted by `GroqProvider` (Infrastructure) to run the Llama-3 model.
5.  **Audio Stream & Lip Sync (Infrastructure to Presentation)**:
    *   The raw text generated from the LLM is sent to `EdgeTTSProvider` which streams audio blocks and returns viseme timestamps.
    *   `VoiceModeHandler` converts these audio/viseme payloads into WebSocket JSON envelopes and dispatches them back to the client.

## 3. Strict Boundary Rules

Developers MUST adhere to the following coding boundaries:
1.  **No SQL in Routers/Use Cases**: All database access must go through repository classes in `infrastructure/db/repositories` that implement domain repository ports.
2.  **No FastAPI imports in Domain/Application**: Use cases and domain objects must be framework-agnostic. Dependencies must be passed in using standard Python typing abstract base classes.
3.  **Fail Closed**: Authentication, rate limit, or resource checks must fail closed. Bypasses or lenient logic are security vulnerabilities.
