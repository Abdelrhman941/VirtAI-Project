# 🛡️ VirtAI RAG Excellence Refactor: Batch 0 Audit Report

## 1. Current VirtAI RAG Flow
```text
[User Query] 
     │
     ▼
[IntentClassifier] ──(casual)──> [ChatUseCase / Voice Pipeline]
     │                                 │
     ▼ (rag)                           ▼
[RetrievalUseCase]             [LLM Provider] ──> [Response]
     │
     ├─ Embed Query (EmbeddingProvider)
     ├─ Hybrid Search (VectorStore, top_k=15)
     ├─ Rerank (CrossEncoder, top_k=10)
     ├─ Apply Diversity Decay
     └─ Format Context String
     │
     ▼
[PromptBuilder] ──> System Prompt + Context Injection
     │
     ▼
[ChatUseCase / Pipeline] ──> [LLM Provider] ──> [Response]
```

## 2. Mini-RAG Flow Diagram
```text
[User Query] 
     │
     ▼
[NLPController / RouterAgent]
     │
     ├──> Classify Intent (intent_utils.py: QA, Summary, Quiz, Explain)
     │
     ▼
[RetrievalAgent]
     │
     ├─ Dynamic limits (Summary=60 chunks, QA=15 chunks)
     ├─ Dynamic thresholds (Summary=0.05, QA=0.30)
     └─ Rerank -> Top 5 chunks
     │
     ▼
[ResponseFormatterAgent] (Map-Reduce if Summary)
     │
     ├─ Fetch task-aware prompt (ar/rag.py or en/rag.py)
     ├─ Inject Teaching Mode instructions
     ├─ Adjust max_tokens (3000 for explain, 1500 for QA)
     ├─ Generate text
     └─ Append Citations/Sources Block
     │
     ▼
[Response]
```

## 3. Gap Matrix

| Capability | Mini-RAG | VirtAI | Target State | Batch# |
| :--- | :--- | :--- | :--- | :--- |
| **Orchestration** | Uses LangGraph `StateGraph` | Explicit async functions in Use Cases | Lift logic into Clean Architecture without LangGraph | N/A |
| **Retrieval Task-Awareness** | Dynamic fetch size & thresholds (Summary vs. QA) | Static limits (`top_k=5`) | Inject `TaskType` into `RetrievalUseCase` | 3 |
| **Bilingual Prompting** | Full localized prompt catalogs (EN/AR) | Basic generic system prompt | Extract verbiage, implement `PromptRegistry` | 2 |
| **Response Sizing & Context** | Task-specific `max_tokens` and system context | Static max tokens and general instructions | Map `TaskType` to budget, use `ResponseFormatterService` | 4 |
| **Large Doc Summarization** | Map-Reduce chunks over 10K chars | Simple retrieve/generate (causes truncation) | Implement `SummaryUseCase` with Map-Reduce | 5 |
| **Quiz Generation** | Dedicated `QuizAgent` emitting structured JSON | Not supported | Implement `QuizUseCase` with JSON validation | 6 |
| **Concept Diagramming** | `DiagramAgent` extracts Mermaid diagrams | Not supported | Implement `DiagramUseCase` | 7 |
| **Context Citations** | Appends "Sources" block to output | Not supported | Extract `build_citations()` and append in Formatter | 1, 4 |

## 4. Risk Register

| Risk Area | Description | Mitigation Strategy |
| :--- | :--- | :--- |
| **Dependency additions** | Mermaid renderer in frontend might bloat bundle. Napkin AI HTTP client needed. | Lazy-load Mermaid in frontend. Isolate Napkin via clean adapter port. Do not add LangGraph. |
| **DB Schema Impact** | Batches 5, 6, 7, 8 require new caching and state tables. | Use strict Alembic migrations in each respective batch. Ensure backward/forward compatibility. |
| **Latency Budget** | `SummaryUseCase` map-reduce and Voice Pipeline first-token latency. | Use `asyncio.Semaphore` for concurrency caps. Retain voice flags to limit `max_tokens` (1024). |
| **Data Encoding** | Arabic prompts in Batch 2 could hit decoding issues. | Enforce UTF-8 BOM-free files. Add localized tests to ensure Arabic codepoints exist. |
