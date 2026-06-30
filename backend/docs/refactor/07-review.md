# Batch 7 Review Checklist

## DiagramUseCase & Mermaid.js Implementation
- [x] Defensive mermaid syntax sanitizer implemented inside `DiagramUseCase`: securely stripping markdown, enforcing `flowchart TD` initialization, and strictly substituting dangerous quotes/parentheses out of node labels (`A[label]`).
- [x] Hallucination Control: Limit node count enforced. Any diagram producing over 60 nodes/lines automatically raises a safe `DiagramDomainException` to avert frontend crashes.
- [x] DiagramArtifact Contract: Integrated `citations` mapping inside the JSON generation prompts alongside the `mermaid_code`.
- [x] Added Alembic migration `<YYYYMMDD>_diagram_cache.py` to establish the `diagram_cache` table with `ON DELETE CASCADE` binding against `documents.id`.
- [x] Implemented endpoints `POST /v1/rag/diagram/{document_id}` and `GET /v1/rag/diagram/{diagram_id}` correctly fortified by `_current_user` Authentication dependencies validating access against the provided `document_id`.
- [x] Executed Pytest suite validating successful generation, limits enforcing, markdown stripping, parsing loops, and unescaped quote stripping logic (`pytest backend/tests/application/rag/test_diagram_use_case.py -v`).
