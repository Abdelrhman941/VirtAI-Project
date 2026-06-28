# Backend Clean Architecture Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor HTTP endpoints to strictly follow Clean Architecture by moving infrastructure (Redis, DB transactions) and business logic (Token issuance, rate limiting) into the Application layer.

**Architecture:** We will extract logic from `auth.py`, `chat.py`, and `documents.py` into dedicated use case classes (`AuthService`, `ChatUseCase` updates, `DocumentStatusUseCase`) to ensure the presentation layer only handles HTTP concerns (requests, responses, cookies, DTOs). 

**Tech Stack:** FastAPI, SQLAlchemy, Redis, Pydantic, Python 3.12+

## Global Constraints

- Preserve all existing API contracts (schemas, status codes, cookies, headers).
- Do not break existing tests.
- DB transactions must be handled in the Application layer or Repositories, not Endpoints.
- Redis caching/pubsub must be handled in the Application layer.

---

### Task 1: Create AuthService to encapsulate auth business logic

**Files:**
- Create: `backend/app/application/auth/auth_service.py`

**Interfaces:**
- Consumes: `UserRepositoryPort`, cache adapters, security utils.
- Produces: `AuthService.login`, `AuthService.signup`, `AuthService.refresh`, `AuthService.logout` which return data structures suitable for the router to format into responses.

- [ ] **Step 1: Write the failing test**

```python
# No specific test to add since we are refactoring existing logic. 
# We rely on existing e2e auth tests to pass after this refactor.
# However, we must ensure the file exists.
```

- [ ] **Step 2: Implement AuthService**

```python
from __future__ import annotations
from typing import Any
from fastapi import Request, Response
from app.domain.user.entities import UserEntity
from app.domain.user.ports import UserRepositoryPort

class AuthService:
    def __init__(self, repo: UserRepositoryPort):
        self.repo = repo
        
    # We will migrate the orchestrating logic (check rate limit, authenticate, issue tokens, set cookies) here.
    # Due to length, we leave the detailed implementation to the executor, who will copy the orchestration logic from auth.py.
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/application/auth/auth_service.py
git commit -m "refactor: add AuthService skeleton"
```

### Task 2: Refactor auth.py to use AuthService

**Files:**
- Modify: `backend/app/presentation/http/v1/endpoints/auth.py:1-629`

**Interfaces:**
- Consumes: `AuthService`
- Produces: Clean FastAPI endpoints

- [ ] **Step 1: Migrate logic and refactor endpoints**

Move rate limiting, lockout checks, token issuance, and cache invalidation from `auth.py` into `AuthService`. The router should look like:

```python
@router.post("/login")
async def login(
    body: LoginRequest,
    response: Response,
    request: Request,
    repo: UserRepositoryDep,
) -> dict:
    service = AuthService(repo)
    return await service.login(body, request, response)
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pytest backend/tests/ -v -k auth`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add backend/app/presentation/http/v1/endpoints/auth.py backend/app/application/auth/auth_service.py
git commit -m "refactor: extract auth logic to AuthService"
```

### Task 3: Refactor ChatUseCase for session deletion and pubsub

**Files:**
- Modify: `backend/app/application/chat/chat_use_case.py:1-111`
- Modify: `backend/app/presentation/http/v1/endpoints/chat.py:1-287`

**Interfaces:**
- Consumes: `ChatRepositoryPort`, `RedisClient`
- Produces: `ChatUseCase.delete_all_sessions`, `ChatUseCase.delete_session`

- [ ] **Step 1: Implement deletion logic in ChatUseCase**

Move the manual DB commits and Redis pubsub publishing from `chat.py` (specifically `delete_all_sessions` and `delete_session`) into `chat_use_case.py`.

- [ ] **Step 2: Refactor chat.py endpoints**

Update the endpoints to call the new use case methods.

- [ ] **Step 3: Run tests to verify they pass**

Run: `pytest backend/tests/ -v -k chat`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/app/application/chat/chat_use_case.py backend/app/presentation/http/v1/endpoints/chat.py
git commit -m "refactor: extract chat session deletion logic to ChatUseCase"
```

### Task 4: Create DocumentStatusUseCase for documents endpoint

**Files:**
- Create: `backend/app/application/rag/document_status_use_case.py`
- Modify: `backend/app/presentation/http/v1/endpoints/documents.py:1-362`

**Interfaces:**
- Consumes: `DocumentCrudRepository`, `IngestionStateRepository`, `RedisClient`
- Produces: `DocumentStatusUseCase.list_statuses`, `DocumentStatusUseCase.get_status`, `DocumentStatusUseCase.cancel_document`

- [ ] **Step 1: Implement DocumentStatusUseCase**

Extract the redis polling (`doc_progress:{d.id}`) and cancellation logic (including `db.commit()`) from `documents.py` into this new use case. 

- [ ] **Step 2: Refactor documents.py endpoints**

Update `list_statuses`, `get_document_status`, and `cancel_document` to delegate to `DocumentStatusUseCase`.

- [ ] **Step 3: Run tests to verify they pass**

Run: `pytest backend/tests/ -v -k documents`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/app/application/rag/document_status_use_case.py backend/app/presentation/http/v1/endpoints/documents.py
git commit -m "refactor: extract document status logic to DocumentStatusUseCase"
```
