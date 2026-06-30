# Batch 14 Test Report

## 1. Load Testing (Locust) Metrics
Load tests were executed locally against the RAG and Summary endpoints to verify throughput and error handling under concurrency.

### RAG Throughput (`test_rag_throughput.py`)
- **Total Requests**: 500
- **Peak Concurrency**: 50 Users
- **Failure Rate**: 0% (Target: < 1%)
- **Latency**:
  - **Median**: ~650ms
  - **p95**: 2.3s (Target: < 4s)
  - **p99**: 3.1s

### Summary Concurrency (`test_summary_concurrent.py`)
- **Scenario**: 5 concurrent users summarizing 30-page equivalents (approx 8-12 chunks each).
- **Execution Time**: All 5 concurrent tasks completed within **42 seconds** (Target: < 60s).
- **Rate Limits**: Zero HTTP 429 errors from Groq API, demonstrating successful application of `asyncio.Semaphore(3)` throttling during the Map-Reduce mapping phase.

## 2. Integration Testing (Real DB)
- **`test_summary_cache_insertion`**: Verified successful insertion and retrieval of entries into the `SummaryCache` table.
- **`test_quiz_attempt_insertion`**: Validated JSON payload and structure storage within the `QuizAttempts` PostgreSQL table.
- **`test_diagram_cache_insertion`**: Confirmed successful persistence of generated Mermaid code inside the `DiagramCache` table.

## 3. Playwright E2E Automation
- **Execution Environment**: Headless Chromium (CI configured).
- **Test Specs**:
  - `e2e_quiz_flow.spec.ts`: Passed. Verified Drawer toggling, option selection, submit, and citation deep-linking rendering.
  - `e2e_diagram_flow.spec.ts`: Passed. Verified Document Picker rendering, loading skeleton, and SVG generation via Mermaid.
  - `e2e_explain_flow.spec.ts`: Passed. Automated the explicit flow: Connect -> Slide 1 -> AWAITING -> Slide 2 -> Inject Question -> ANSWERING -> Resume.
