# Batch 6 Review Checklist

## Pre-Flight Fix
- [x] Mocked `db.add` appropriately in the tests to suppress the `RuntimeWarning: coroutine 'AsyncMockMixin._execute_mock_call' was never awaited`. Note: `db.add` is fundamentally synchronous in `SQLAlchemy` (and the `AsyncSession`), so the `await` warning was strictly an artifact of the `AsyncMock` leaking into the test suite, which is now corrected.

## QuizUseCase Implementation
- [x] Update English (`en.py`) and Arabic (`ar.py`) quiz system prompts to demand strict `JSON` formatted outputs instead of Markdown.
- [x] Implement robust `QuizUseCase` regex fallback parser capable of catching and unwrapping markdown-fenced `JSON` payloads (`[ ... ]`).
- [x] Implement automatic retries (up to 3 total attempts) inside the `QuizUseCase` to gracefully recover from invalid `JSON`.
- [x] Provide proper extraction of the `citations` field required for the "Why is this wrong" feature.
- [x] Design DB schemas (`Quiz`, `QuizQuestion`, `QuizAttempt`) equipped with correct `ON DELETE CASCADE` mappings directly back to `documents` and `users`.
- [x] Author `<YYYYMMDD>_quiz_attempts.py` Alembic migration cleanly handling the new schemas.
- [x] Introduce fully secured endpoints `POST /v1/rag/quiz/{document_id}` and `GET /v1/rag/quiz/{quiz_id}` equipped with standard authentication validation inside `backend/app/presentation/http/v1/endpoints/rag.py`.
- [x] Pass completely via Pytest: `backend/tests/application/rag/test_quiz_use_case.py` validated parsing failure, resilience, and success loops.
