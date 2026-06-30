# Retrieval Latency Benchmark Record

This document records the simulated latency differences between different task types in the dynamic retrieval pipeline.

## Architecture Context
The `RetrievalUseCase` now accepts a `TaskType` parameter. By default (and safely via the Voice pipeline), it assumes `TaskType.SIMPLE_QA`. When triggered for a `SUMMARY` or `QUIZ` via the chat pipeline, it scales up the vector DB fetch limit and reranker evaluation limit.

## Benchmark Configuration
- **SIMPLE_QA**: `fetch_limit=15`, `top_n=5`
- **SUMMARY**: `fetch_limit=60`, `top_n=20`

## Latency Impact Analysis

1. **Vector DB (Hybrid Search)**: 
   - Fetching 15 vs 60 chunks from PostgreSQL/pgvector adds negligible latency (typically <10ms diff) since the HNSW index lookup is fast.
   
2. **CrossEncoder Reranker**: 
   - The CrossEncoder performs a full forward pass on `query + chunk` for each candidate.
   - For `SIMPLE_QA`, it evaluates 15 chunks.
   - For `SUMMARY`, it evaluates 60 chunks.
   - Assuming ~15ms per chunk on CPU, `SIMPLE_QA` reranking takes ~225ms, while `SUMMARY` reranking takes ~900ms.
   - **Mitigation**: The reranker execution is wrapped in `asyncio.get_running_loop().run_in_executor()` via a dedicated `ThreadPoolExecutor`. This prevents the CPU-bound model inference from blocking the main FastAPI event loop, ensuring concurrent requests are not stalled.

## First-Token Latency (Voice Pipeline)
The Voice Pipeline uses the default `task_type=TaskType.SIMPLE_QA` (implicit via use-case defaults). As a result, its retrieval phase is strictly bounded to 15 candidates and executes in ~250ms (DB + Rerank) before generation begins, safely preserving sub-second first-token latency targets.
