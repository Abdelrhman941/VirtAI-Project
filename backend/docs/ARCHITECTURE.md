# VirtAI Visual Architecture Map

This document provides a visual map of the VirtAI backend architecture, mapping the database entity relationships, real-time WebSocket connection lifecycles, and the Retrieval-Augmented Generation (RAG) task pipelines.

---

## 1. Database Entity-Relationship Diagram (ERD)

The following diagram maps the exact database tables, columns, and foreign key relationships defined in [models.py](file:///D:/A/Projects/VirtAI-Project/backend/app/infrastructure/db/models.py). It includes users, chat sessions, documents, document chunks, quizzes, attempts, and caches.

```mermaid
erDiagram
    users {
        uuid id PK
        string email UK
        string full_name
        string username UK
        string password_hash
        string provider
        string google_id UK
        boolean setup_complete
        boolean is_active
        integer refresh_token_version
        datetime created_at
        datetime updated_at
    }

    chat_sessions {
        uuid id PK
        uuid user_id FK
        string title
        datetime created_at
        datetime updated_at
        integer message_count
    }

    messages {
        uuid id PK
        uuid session_id FK
        string role
        text content
        string input_type
        string tts_cache_key
        jsonb sources
        datetime timestamp
    }

    avatars {
        uuid id PK
        uuid user_id FK "Unique"
        string avatar_url
        string voice_id
        string language
        text persona_prompt
        datetime updated_at
    }

    documents {
        uuid id PK
        uuid user_id FK
        string filename
        string file_type
        datetime upload_date
        integer chunk_count
        string status
        string current_stage
        integer progress_pct
        text error_message
        integer processed_chunks
        integer total_chunks
        datetime started_at
        datetime completed_at
        string upload_source
        string document_sha256
        string normalized_content_hash
        integer file_size
        integer retry_count
        integer queue_time_ms
        string retrieval_scope
        uuid scope_id
        string storage_key
    }

    document_chunks {
        uuid id PK
        uuid document_id FK
        text chunk_text
        integer chunk_order
        vector embedding
        jsonb metadata
        datetime created_at
        integer chunk_version
        boolean is_active
        string retrieval_scope
        uuid scope_id
    }

    summary_cache {
        uuid id PK
        uuid document_id FK "Unique"
        text summary_text
        datetime created_at
    }

    quizzes {
        uuid id PK
        uuid document_id FK
        uuid user_id FK
        datetime created_at
    }

    quiz_questions {
        uuid id PK
        uuid quiz_id FK
        text question_text
        jsonb options
        integer correct_option_index
        text explanation
        jsonb citations
        datetime created_at
    }

    quiz_attempts {
        uuid id PK
        uuid quiz_id FK
        uuid user_id FK
        jsonb answers
        integer score
        datetime created_at
    }

    diagram_cache {
        uuid id PK
        uuid document_id FK "Unique"
        text mermaid_code
        jsonb citations
        datetime created_at
    }

    visualization_cache {
        uuid id PK
        uuid message_id FK "Unique"
        string image_url
        boolean unavailable
        string reason
        datetime created_at
    }

    users ||--o{ chat_sessions : "has"
    users ||--o| avatars : "owns"
    users ||--o{ documents : "uploads"
    users ||--o{ quizzes : "creates"
    users ||--o{ quiz_attempts : "performs"
    chat_sessions ||--o{ messages : "contains"
    documents ||--o{ document_chunks : "contains"
    documents ||--o| summary_cache : "caches"
    documents ||--o| diagram_cache : "caches"
    messages ||--o| visualization_cache : "caches"
    quizzes ||--o{ quiz_questions : "contains"
    quizzes ||--o{ quiz_attempts : "attempts"
```

---

## 2. WebSocket Real-Time Flow

This diagram illustrates the message routing, session initialization, pipeline processing, and interruption sequence for real-time educational avatar sessions. The flow spans presentation routers, handlers, and application use cases.

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Lifecycle as ConnectionLifecycle
    participant Manager as ConnectionManager
    participant Dispatcher as FrameDispatcher
    participant Router as ProtocolRouter
    participant Handler as VoiceModeHandler
    participant Engine as AudioPipeline/LLM/TTS

    Client->>Lifecycle: WebSocket Connect (Query: token, session_id, avatar_id)
    activate Lifecycle
    Lifecycle->>Lifecycle: Validate JWT & Verify User Session
    Lifecycle->>Manager: Register active connection
    Lifecycle-->>Client: Connection Accepted (Session Initialized)
    deactivate Lifecycle

    Client->>Dispatcher: Send Audio Binary Frame (PCM 16kHz)
    activate Dispatcher
    Dispatcher->>Router: Parse binary packet / route
    Router->>Handler: Forward frame payload
    Handler->>Engine: Stream speech buffer chunk
    deactivate Dispatcher

    Note over Handler,Engine: When User Stops Speaking (VAD triggered)
    
    Handler->>Engine: Close current input stream & start generation
    activate Engine
    Engine->>Engine: Run ASR (Whisper) -> Get text
    Engine->>Engine: Query LLM Use Case with History & Context
    Engine-->>Client: Stream Assistant Text Tokens
    Engine->>Engine: Direct text stream to TTS Engine (Edge-TTS)
    Engine-->>Client: Stream TTS Audio Chunks & Visemes/Lip-Sync data
    deactivate Engine

    opt Interruption: User starts speaking mid-assistant-turn
        Client->>Dispatcher: Send Audio / Control Frame
        Dispatcher->>Router: Dispatch control frame
        Router->>Handler: Trigger interruption event
        activate Handler
        Handler->>Engine: Cancel current LLM & TTS tasks immediately
        Handler-->>Client: Clear Audio Playback Buffer event
        deactivate Handler
    end

    Client->>Lifecycle: Close Connection
    activate Lifecycle
    Lifecycle->>Manager: Unregister connection
    Lifecycle->>Handler: Cancel all active asynchronous runtimes
    Lifecycle->>Lifecycle: Cleanup temporary resources
    deactivate Lifecycle
```

---

## 3. RAG & Document Processing Pipeline

The ingestion and retrieval process transforms unstructured documents into structured, vector-indexed chunks and retrieves them using task-aware constraints.

```mermaid
flowchart TD
    subgraph Ingestion ["Ingestion Pipeline (Background Worker)"]
        A[Document Upload] --> B[PDF/Markdown Extractor]
        B --> C[Smart Chunker]
        C --> D[Embedding Provider - FastEmbed]
        D --> E[(PGVector Store)]
    end

    subgraph Retrieval ["Retrieval & Task Context Assembly"]
        F[User Query] --> G{Task Classifier}
        
        G -->|Explain| H[Explain Use Case]
        G -->|Quiz| I[Quiz Use Case]
        G -->|Diagram| J[Diagram Use Case]
        G -->|Summary| K[Summary Use Case]

        H & I & J & K --> L[Query Vectorization]
        L --> M[PGVector Search - Cosine Similarity]
        E --> M
        M --> N[Retrieval Context Budgeting]
        N --> O[LLM Prompt Synthesis]
        O --> P[Assistant Output Response]
    end

    classDef database fill:#282a36,stroke:#bd93f9,stroke-width:2px,color:#fff;
    class E database;
