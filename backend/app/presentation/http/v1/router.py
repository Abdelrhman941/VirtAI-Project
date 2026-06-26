"""
API v1 Router - registers all endpoints.

Canonical location: app.presentation.http.v1.router
"""

import uuid
from contextlib import suppress

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.auth_use_cases import get_user_by_id
from app.application.chat.chat_use_case import ChatUseCase
from app.infrastructure.cache.jwt_blacklist import is_blacklisted
from app.infrastructure.cache.rate_limiter import check_rate_limit
from app.infrastructure.db.database import get_db
from app.infrastructure.db.repositories.user_repository import UserRepository
from app.presentation.http.v1.dependencies import (
    get_chat_use_case,
    get_session_manager,
    get_ws_connection_manager,
)
from app.presentation.http.v1.endpoints.audio import router as audio_router
from app.presentation.http.v1.endpoints.auth import router as auth_router
from app.presentation.http.v1.endpoints.chat import router as chat_router
from app.presentation.http.v1.endpoints.documents import router as documents_router
from app.presentation.http.v1.endpoints.health import router as health_router
from app.presentation.http.v1.endpoints.rag import router as rag_router
from app.presentation.ws.connection_manager import WSConnectionManager
from app.presentation.ws.explain_handler import ExplainHandler
from app.presentation.ws.gateway import WebSocketHandler
from app.shared.config import get_settings
from app.shared.errors import (
    ExpiredTokenError,
    InvalidAuthStateError,
    InvalidTokenError,
    InvalidUserIdError,
)
from app.shared.ids import parse_uuid
from app.shared.security import decode_auth_token

settings = get_settings()

router = APIRouter(prefix="/api/v1")

# HTTP Endpoints
router.include_router(health_router)
router.include_router(audio_router)
router.include_router(chat_router, prefix="/chat", tags=["chat"])
router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(documents_router, prefix="/documents", tags=["documents"])
router.include_router(rag_router, prefix="/rag", tags=["rag"])


@router.websocket("/ws/{avatar_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    avatar_id: str,
    voice: str = Query(default=""),
    session_id: str | None = Query(default=None),
    resume: bool = Query(default=False),
    last_seq: int = Query(default=0, ge=0),
    session_manager=Depends(get_session_manager),
    connection_manager: WSConnectionManager = Depends(get_ws_connection_manager),
    db: AsyncSession | None = Depends(get_db),
):
    """
    WebSocket endpoint for real-time communication.
    URL: ws://localhost:8000/api/v1/ws/{avatar_id}?voice=aria
    Supported avatar_id: avatar1, avatar2, avatar3
    """
    from app.shared.request_context import set_trace_id

    trace_id = websocket.headers.get("x-request-id") or str(uuid.uuid4())
    set_trace_id(trace_id)

    voice_id = voice or settings.TTS_VOICE
    client_ip = websocket.client.host if websocket.client else "unknown"
    logger.info(
        f"[WS] Connection attempt | avatar={avatar_id} | voice={voice_id} | client={websocket.client} | "
        f"resume={resume} | session_id={session_id}"
    )

    # Per-IP connection throttling (best effort, fail-open handled by helper)
    allowed = await check_rate_limit(
        identifier=f"ws:connect:{client_ip}",
        limit=settings.RATE_LIMIT_WS_CONNECT_REQUESTS,
        window=settings.RATE_LIMIT_WS_CONNECT_WINDOW,
    )
    if not allowed:
        await websocket.close(code=4408, reason="Too many connection attempts")
        return
    if connection_manager.active_count >= settings.WS_MAX_ACTIVE_CONNECTIONS:
        await websocket.close(code=4408, reason="WebSocket capacity reached")
        return

    # Validate avatar_id
    valid_avatars = set(settings.VALID_AVATAR_IDS)
    if avatar_id not in valid_avatars:
        logger.warning(f"[WS] Invalid avatar_id: {avatar_id}")
        await websocket.close(code=4004, reason="Invalid avatar ID")
        return

    # WebSocket Auth (S1-01)
    token = None
    subprotocols = websocket.scope.get("subprotocols", [])
    if "access_token" in subprotocols:
        try:
            idx = subprotocols.index("access_token")
            if idx + 1 < len(subprotocols):
                token = subprotocols[idx + 1].strip()
        except ValueError:
            pass

    if not token:
        logger.warning("[WS] Missing token")
        await websocket.close(code=4401, reason="Missing token")
        return

    try:
        token_payload = decode_auth_token(token, expected_type="access")
    except (ExpiredTokenError, InvalidAuthStateError, InvalidTokenError, InvalidUserIdError) as e:
        logger.warning(f"[WS] Invalid token: {e}")
        await websocket.close(code=4401, reason="Invalid token")
        return

    try:
        if await is_blacklisted(token_payload.jti):
            logger.warning("[WS] Revoked token")
            await websocket.close(code=4401, reason="Invalid token")
            return

        parsed_user_id = parse_uuid(token_payload.user_id)
        if parsed_user_id is None:
            logger.warning("[WS] Token subject is not a UUID")
            await websocket.close(code=4401, reason="Invalid token")
            return
        if db is None:
            raise RuntimeError("Database session required")
        repo = UserRepository(db)
        user = await get_user_by_id(repo, parsed_user_id)
        if user is None or not user.is_active:
            logger.warning("[WS] User not found or inactive")
            await websocket.close(code=4401, reason="Invalid token")
            return
        if token_payload.token_version != user.refresh_token_version:
            logger.warning("[WS] Stale access token")
            await websocket.close(code=4401, reason="Invalid token")
            return
    except Exception as e:
        logger.error(f"[WS] DB/Redis error during connection: {e}")
        with suppress(Exception):
            await websocket.close(code=1011, reason="Internal server error")
        return

    parsed_session_id = None
    if session_id:
        parsed_session_id = parse_uuid(session_id)
        if parsed_session_id is None:
            logger.warning("[WS] Invalid session_id")
            await websocket.close(code=4400, reason="Invalid session ID")
            return
        session_id = str(parsed_session_id)

    # Accept connection
    try:
        await websocket.accept(subprotocol="access_token")
        logger.info(f"[WS] Connection accepted | avatar={avatar_id} | client={websocket.client}")
    except Exception as e:
        logger.error(f"[WS] Failed to accept connection: {e}")
        return

    user_id = str(parsed_user_id)

    # Create or resume session
    resumed = False
    session = None
    try:
        if resume and session_id:
            session = await session_manager.connect_existing_session(
                session_id=session_id,
                user_id=user_id,
                avatar_id=avatar_id,
                voice_id=voice_id,
            )
            if session is None:
                # Graceful fallback: session expired or not found — don't close the
                # connection. Instead, drop into lazy-session mode so the client
                # gets a fresh session on its first message. This prevents the
                # frontend from looping on 4404 → retry → 4404.
                logger.warning(
                    f"[WS] Resume requested for session {session_id} but not found "
                    f"— falling back to new-session mode for user {user_id}"
                )
                resumed = False
            else:
                # Session Fixation (S1-06)
                session_user_id = parse_uuid(getattr(session, "user_id", None))
                if session_user_id != parsed_user_id:
                    logger.warning(
                        f"[WS] Unauthorized session resume attempt for session {session_id}"
                    )
                    await websocket.close(code=4403, reason="Unauthorized session resume")
                    return
                resumed = True
                logger.info(f"[WS] Session resumed | session_id={session.session_id}")
        else:
            logger.info(
                f"[WS] Lazy session mode | avatar={avatar_id} | voice={voice_id} | session will be created on first message"
            )
    except Exception as e:
        logger.error(f"[WS] Failed to create session: {e}")
        with suppress(Exception):
            await websocket.close(code=1011, reason="Failed to create session")
        return

    # Create handler and run
    handler = WebSocketHandler(
        websocket=websocket,
        session=session,
        session_manager=session_manager,
        user_id=user_id,
        avatar_id=avatar_id,
        voice_id=voice_id,
        connection_manager=connection_manager,
        resumed=resumed,
        replay_after_seq=last_seq if resumed else 0,
        requested_session_id=session_id if not resumed else None,
    )
    handler._family_id = str(token_payload.family_id) if token_payload.family_id else None

    try:
        logger.info(
            f"[WS] Starting handler | session={session.session_id if session else 'pending'}"
        )
        await handler.run()
    except WebSocketDisconnect:
        logger.info(f"[WS] Client disconnected | session={handler.session.session_id or 'pending'}")
    except Exception as e:
        logger.error(
            f"[WS] Handler error | session={handler.session.session_id or 'pending'} | error={e}",
            exc_info=True,
        )
    finally:
        if handler and getattr(handler, "session", None) and handler.session.session_id:
            await connection_manager.unregister(handler.session.session_id, websocket)
            await session_manager.disconnect_session(handler.session.session_id)
            logger.info(
                f"[WS] Session disconnected (kept for resume) | id={handler.session.session_id}"
            )


@router.websocket("/rag/explain/{document_id}")
async def explain_websocket_endpoint(
    websocket: WebSocket,
    document_id: str,
    db: AsyncSession = Depends(get_db),
    chat_use_case: ChatUseCase = Depends(get_chat_use_case),
):
    """
    WebSocket endpoint for Slide-by-Slide Explanation.
    URL: ws://localhost:8000/api/v1/rag/explain/{document_id}
    """

    # 1. Extract and validate token from subprotocols
    token = None
    subprotocols = websocket.scope.get("subprotocols", [])
    if "access_token" in subprotocols:
        try:
            idx = subprotocols.index("access_token")
            if idx + 1 < len(subprotocols):
                token = subprotocols[idx + 1].strip()
        except ValueError:
            pass

    if not token:
        await websocket.close(code=4401, reason="Missing token")
        return

    from app.shared.security import decode_auth_token
    from app.shared.ids import parse_uuid
    try:
        token_payload = decode_auth_token(token, expected_type="access")
        user_id = token_payload.user_id
    except Exception as e:
        logger.warning(f"[ExplainWS] Invalid token: {e}")
        await websocket.close(code=4401, reason="Invalid token")
        return

    parsed_user_id = parse_uuid(user_id)
    if not parsed_user_id:
        await websocket.close(code=4401, reason="Invalid token")
        return

    # 2. Session Guard & Document Ownership
    from sqlalchemy import select

    from app.infrastructure.db.models import ChatSession, Document

    doc_uuid = parse_uuid(document_id)
    if not doc_uuid:
        await websocket.close(code=4000, reason="Invalid document ID format")
        return

    doc = await db.scalar(select(Document).where(Document.id == doc_uuid))
    if not doc:
        await websocket.close(code=4404, reason="Document not found")
        return

    # Security: Verify ownership!
    if str(doc.user_id) != str(parsed_user_id):
        logger.warning(f"[ExplainWS] Unauthorized access attempt: User {user_id} tried to access Doc {document_id}")
        await websocket.close(code=4403, reason="Unauthorized")
        return

    if doc.retrieval_scope == "SESSION" and doc.scope_id:
        session_model = await db.scalar(
            select(ChatSession).where(ChatSession.id == doc.scope_id)
        )
        if session_model and session_model.message_count > 0:
            await websocket.close(
                code=1008, reason="Cannot present document: chat already started."
            )
            return

    # Accept the websocket
    await websocket.accept(subprotocol="access_token")

    handler = ExplainHandler(
        websocket=websocket,
        document_id=document_id,
        db=db,
        user_id=user_id,
        chat_use_case=chat_use_case,
    )

    try:
        await handler.run()
    except Exception as e:
        logger.error(f"[ExplainWS] Handler error: {e}")
    finally:
        pass
