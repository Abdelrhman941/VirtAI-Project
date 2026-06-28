"""Chat session management endpoints."""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from loguru import logger
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.user.entities import UserEntity
from app.domain.rag.task_types import Locale
from app.infrastructure.db.database import get_db
from app.infrastructure.worker.background_chat_worker import save_conversation_background_task
from app.presentation.http.v1.dependencies import (
    ChatRepositoryDep,
    ChatUseCaseDep,
    _current_user,
    get_session_manager,
)
from app.shared.ids import parse_uuid

router = APIRouter()


class TitleRequest(BaseModel):
    message: str


class RenameRequest(BaseModel):
    title: str


@router.get("/", response_model=list[dict])
async def get_sessions(
    request: Request,
    repo: ChatRepositoryDep,
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
) -> list[dict]:
    """List chat sessions for the current user."""
    try:
        sessions = await repo.list_user_sessions(str(user.id), limit=limit)
        return sessions
    except Exception as e:
        logger.error(f"Failed to list sessions for user {user.id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post("/", response_model=dict, status_code=201)
async def create_session(
    request: Request,
    repo: ChatRepositoryDep,
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create a new chat session for the current user."""
    try:
        session = await repo.create_chat_session(str(user.id))
        return session
    except Exception as e:
        logger.error(f"Failed to create session for user {user.id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.get("/{session_id}/messages", response_model=list[dict])
async def get_messages(
    session_id: str,
    request: Request,
    repo: ChatRepositoryDep,
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
) -> list[dict]:
    """Fetch message history for a specific session."""
    if parse_uuid(session_id) is None:
        raise HTTPException(status_code=400, detail="Invalid session_id")
    try:
        session = await repo.get_chat_session(session_id)
        if not session or session.get("user_id") != str(user.id):
            raise HTTPException(status_code=404, detail="Session not found")
        messages = await repo.get_session_messages(session_id, limit=limit)
        return messages
    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session_id") from None
    except Exception as e:
        logger.error(f"Failed to fetch messages for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post("/{session_id}/title", response_model=dict)
async def generate_session_title(
    session_id: str,
    payload: TitleRequest,
    request: Request,
    chat_use_case: ChatUseCaseDep,
    repo: ChatRepositoryDep,
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate and persist a concise title for a chat session."""
    if parse_uuid(session_id) is None:
        raise HTTPException(status_code=400, detail="Invalid session_id")

    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    try:
        session = await repo.get_chat_session(session_id)
        if not session or session.get("user_id") != str(user.id):
            raise HTTPException(status_code=404, detail="Session not found")

        from app.application.chat.generate_title_use_case import GenerateTitleUseCase
        from app.domain.rag.task_types import detect_locale

        use_case = GenerateTitleUseCase(chat_use_case.llm)
        
        # Try to extract locale from headers, fallback to detect_locale
        accept_lang = request.headers.get("accept-language", "").lower()
        if "ar" in accept_lang:
            locale = Locale.AR
        elif "en" in accept_lang:
            locale = Locale.EN
        else:
            locale = detect_locale(message)
            
        title = await use_case.execute(message, locale)

        updated = await repo.update_chat_session_title(session_id, title)
        await db.commit()
        return {"id": session_id, "title": updated.get("title") if updated else title}
    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session_id") from None
    except Exception as e:
        logger.error(f"Failed to generate title for session {session_id}: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.patch("/{session_id}", response_model=dict)
async def rename_session(
    session_id: str,
    payload: RenameRequest,
    request: Request,
    repo: ChatRepositoryDep,
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Manually rename a chat session title."""
    if parse_uuid(session_id) is None:
        raise HTTPException(status_code=400, detail="Invalid session_id")

    try:
        session = await repo.get_chat_session(session_id)
        if not session or session.get("user_id") != str(user.id):
            raise HTTPException(status_code=404, detail="Session not found")

        updated = await repo.update_chat_session_title(session_id, payload.title)
        await db.commit()
        return updated or session
    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session_id") from None
    except Exception as e:
        logger.error(f"Failed to rename session {session_id}: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.delete("/all", status_code=204)
async def delete_all_sessions(
    request: Request,
    repo: ChatRepositoryDep,
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
    session_manager=Depends(get_session_manager),
) -> None:
    """Physically delete all sessions and messages for the user."""
    try:
        await session_manager.remove_user_sessions(str(user.id))
        await repo.delete_all_user_sessions(str(user.id))
        await db.commit()

        import json

        from app.infrastructure.cache.redis_client import get_redis

        redis = get_redis()
        event_payload = {
            "event": "session_invalidated",
            "user_id": str(user.id),
            "family_id": "all",
        }
        await redis.publish(f"virtai:ws:events:{user.id}", json.dumps(event_payload))
    except Exception as e:
        logger.error(f"Failed to delete all sessions for {user.id}: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.delete("/{session_id}", status_code=204)
async def delete_session(
    session_id: str,
    request: Request,
    repo: ChatRepositoryDep,
    user: UserEntity = Depends(_current_user),
    db: AsyncSession = Depends(get_db),
    session_manager=Depends(get_session_manager),
) -> None:
    """Physically delete a session and its messages."""
    if parse_uuid(session_id) is None:
        raise HTTPException(status_code=400, detail="Invalid session_id")
    try:
        await session_manager.remove_session(session_id)
        session = await repo.get_chat_session(session_id)
        if not session or session.get("user_id") != str(user.id):
            raise HTTPException(status_code=404, detail="Session not found")
        await repo.delete_chat_session(session_id)
        await db.commit()

        import json

        from app.infrastructure.cache.redis_client import get_redis

        redis = get_redis()
        event_payload = {
            "event": "chat_session_deleted",
            "user_id": str(user.id),
            "session_id": session_id,
        }
        await redis.publish(f"virtai:ws:events:{user.id}", json.dumps(event_payload))
    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session_id") from None
    except Exception as e:
        logger.error(f"Failed to delete session {session_id}: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error") from e


class RAGQuery(BaseModel):
    query: str
    session_id: str | None = None


@router.post("/query", response_model=dict)
async def query_rag(
    payload: RAGQuery,
    request: Request,
    chat_use_case: ChatUseCaseDep,
    background_tasks: BackgroundTasks,
    user: UserEntity = Depends(_current_user),
) -> dict:
    """REST endpoint to perform a one-off RAG query."""
    try:
        from app.domain.rag.task_types import detect_locale
        
        accept_lang = request.headers.get("accept-language", "").lower()
        if "ar" in accept_lang:
            locale = Locale.AR
        elif "en" in accept_lang:
            locale = Locale.EN
        else:
            locale = detect_locale(payload.query)
            
        response = await chat_use_case.execute_rag_query(
            payload.query, str(user.id), session_id=payload.session_id, locale=locale
        )

        if payload.session_id:
            background_tasks.add_task(
                save_conversation_background_task,
                session_id=payload.session_id,
                query=payload.query,
                response=response,
            )

        return {"response": response}
    except Exception as e:
        logger.error(f"RAG query failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e
