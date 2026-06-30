"""
Manages active WebSocket sessions.
Each session has its own ConversationPipeline.

Why a SessionManager?
→ Multiple users can connect simultaneously
→ Each needs isolated history and state
→ We need to clean up when connections drop
"""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Awaitable, Callable
from contextlib import AbstractAsyncContextManager
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from loguru import logger

from app.application.voice.handle_voice_turn import ConversationPipeline
from app.infrastructure.asr.audio_pipeline import AudioPipeline
from app.shared.ids import parse_uuid

if TYPE_CHECKING:
    from app.application.rag.intent_classifier import IntentClassifier
    from app.application.rag.retrieval_use_case import RetrievalUseCase
    from app.domain.chat.entities import ChatMessageDict
    from app.domain.chat.ports import BaseLLMProvider, ChatContextCachePort, ChatRepositoryPort
    from app.domain.voice.ports import BaseTTSProvider, StreamingASRService


class ConversationSession:
    """
    Represents a single active WebSocket session.
    """

    def __init__(
        self,
        session_id: str,
        user_id: str,
        avatar_id: str = "avatar1",
        asr_service: StreamingASRService | None = None,
        llm_service: BaseLLMProvider | None = None,
        tts_service: BaseTTSProvider | None = None,
        retrieval_service: RetrievalUseCase | None = None,
        animation_stage: Any | None = None,
        context_cache: ChatContextCachePort | None = None,
        intent_classifier: IntentClassifier | None = None,
        tts_voice: str | None = None,
        persist_turn: (
            Callable[[str, str, str, str, str | None], Awaitable[ChatMessageDict | None]] | None
        ) = None,
    ):
        self.session_id: str = session_id
        self.user_id: str = user_id
        self.avatar_id: str = avatar_id
        self.pipeline: ConversationPipeline = ConversationPipeline(
            asr=asr_service,
            llm=llm_service,
            tts=tts_service,
            retrieval=retrieval_service,
            animation_stage=animation_stage,
            context_cache=context_cache,
            intent_classifier=intent_classifier,
            avatar_id=avatar_id,
            tts_voice=tts_voice,
            persist_turn=persist_turn,
        )
        self.audio_pipeline = AudioPipeline(
            max_buffer_size=10 * 1024 * 1024,
            max_chunk_size=128 * 1024,
            buffer_timeout=30.0,
            max_buffer_duration=25.0,
        )
        self.created_at: datetime = datetime.now(timezone.utc)
        self.last_activity: datetime = datetime.now(timezone.utc)
        self.connected: bool = True
        self.disconnected_at: datetime | None = None
        self.background_tasks: set[asyncio.Task] = set()
        self.on_cleanup: Callable[[], None] | None = None

    def touch(self) -> None:
        self.last_activity = datetime.now(timezone.utc)

    def mark_connected(self) -> None:
        self.connected = True
        self.disconnected_at = None
        self.touch()

    def mark_disconnected(self) -> None:
        self.connected = False
        self.disconnected_at = datetime.now(timezone.utc)
        self.touch()

    @property
    def idle_seconds(self) -> float:
        return (datetime.now(timezone.utc) - self.last_activity).total_seconds()

    def cleanup(self) -> None:
        for task in self.background_tasks:
            task.cancel()
        self.background_tasks.clear()
        if self.on_cleanup:
            self.on_cleanup()


# Maintain backward compatibility
Session = ConversationSession


class SessionManager:
    """
    Manages conversation sessions with lifecycle tracking.
    Now accepts a factory that returns a fresh AsyncSession per call.
    """

    def __init__(
        self,
        chat_repository_factory: Callable[[], AbstractAsyncContextManager[ChatRepositoryPort]],
        session_timeout_sec: int = 300,
        session_cleanup_interval: int = 60,
        asr_service_factory: Callable[[], StreamingASRService] | None = None,
        llm_service_factory: Callable[[], BaseLLMProvider] | None = None,
        tts_service_factory: Callable[[], BaseTTSProvider] | None = None,
        retrieval_service_factory: Callable[[], Awaitable[RetrievalUseCase]] | None = None,
        animation_stage_factory: Callable[[], Any] | None = None,
        chat_context_cache_factory: Callable[[], ChatContextCachePort] | None = None,
        intent_classifier: IntentClassifier | None = None,
    ):
        if session_timeout_sec <= 0:
            raise ValueError("session_timeout_sec must be positive")
        if session_cleanup_interval <= 0:
            raise ValueError("session_cleanup_interval must be positive")

        self._repo_factory = chat_repository_factory
        self._sessions: dict[str, ConversationSession] = {}
        self._timeout = session_timeout_sec
        self._cleanup_interval = session_cleanup_interval
        self._asr_service_factory = asr_service_factory
        self._llm_service_factory = llm_service_factory
        self._tts_service_factory = tts_service_factory
        self._retrieval_service_factory = retrieval_service_factory
        self._animation_stage_factory = animation_stage_factory
        self._chat_context_cache_factory = chat_context_cache_factory
        self._intent_classifier = intent_classifier
        self._lock = asyncio.Lock()

        logger.info(
            f"SessionManager initialized | "
            f"timeout={session_timeout_sec}s | "
            f"cleanup_interval={session_cleanup_interval}s"
        )

    def _set_session_tts_voice(
        self, session: ConversationSession, voice_id: str | None, context: str
    ) -> None:
        if not voice_id:
            return

        tts = session.pipeline.tts
        if tts is None:
            logger.warning(
                f"Session TTS voice not applied | id={session.session_id} | "
                f"voice={voice_id} | provider=none"
            )
            return

        try:
            session.pipeline.set_tts_voice(voice_id)
            logger.info(
                f"Session TTS voice {context} | id={session.session_id} | "
                f"voice={voice_id} | api_voice={getattr(tts, 'api_voice', 'unknown')}"
            )
        except Exception as e:
            logger.warning(f"Failed to {context} TTS voice: {e}")

    async def persist_turn(
        self,
        session_id: str,
        role: str,
        content: str,
        input_type: str,
        tts_cache_key: str | None = None,
        message_id: str | None = None,
    ) -> ChatMessageDict | None:
        """Persist a conversation turn to the database.

        Phase 2: returns the saved ChatMessageDict so the pipeline can forward
        the canonical `timestamp` (exposed as `created_at`) to WS events.
        """
        async with self._repo_factory() as repo:
            async with repo.db.begin():
                return await repo.save_message(
                    session_id=session_id,
                    role=role,
                    content=content,
                    input_type=input_type,
                    tts_cache_key=tts_cache_key,
                    message_id=message_id,
                )

    async def create_session(
        self,
        user_id: str,
        session_id: str | None = None,
        avatar_id: str = "avatar1",
        voice_id: str | None = None,
        on_cleanup: Callable[[], None] | None = None,
        asr_service: StreamingASRService | None = None,
        llm_service: BaseLLMProvider | None = None,
        tts_service: BaseTTSProvider | None = None,
        retrieval_service: RetrievalUseCase | None = None,
    ) -> ConversationSession:
        parsed_user_id = parse_uuid(user_id)
        if parsed_user_id is None:
            raise ValueError("Invalid user_id")
        user_id = str(parsed_user_id)

        if session_id is not None:
            parsed_session_id = parse_uuid(session_id)
            if parsed_session_id is None:
                raise ValueError("Invalid session_id")
            session_id = str(parsed_session_id)

        # If session already exists in memory, reuse it
        async with self._lock:
            if session_id and session_id in self._sessions:
                existing = self._sessions[session_id]
                if existing.user_id != user_id:
                    raise PermissionError("Cannot attach to another user's session.")
                existing.mark_connected()
                self._set_session_tts_voice(existing, voice_id, "updated")
                return existing

        sid = session_id or str(uuid.uuid4())
        async with self._lock:
            if session_id is None and sid in self._sessions:
                sid = str(uuid.uuid4())

        # Check persistence using a fresh repository
        async with self._repo_factory() as repo:
            persisted = await repo.get_chat_session(sid)
            if persisted is not None:
                if persisted.get("user_id") != user_id:
                    raise PermissionError("Cannot attach to another user's session.")
            else:
                from sqlalchemy.exc import IntegrityError

                try:
                    # Wrap the create_chat_session in a nested transaction (savepoint) to make it atomic
                    async with repo.db.begin_nested():  # type: ignore[attr-defined]
                        await repo.create_chat_session(user_id=user_id, session_id=sid)
                except IntegrityError as e:
                    persisted_check = await repo.get_chat_session(sid)
                    if not persisted_check:
                        raise ValueError("Failed to create session (likely invalid user_id)") from e

        # Create service instances
        asr = asr_service or (self._asr_service_factory() if self._asr_service_factory else None)
        llm = llm_service or (self._llm_service_factory() if self._llm_service_factory else None)
        tts = tts_service or (self._tts_service_factory() if self._tts_service_factory else None)
        retrieval = retrieval_service or (
            await self._retrieval_service_factory() if self._retrieval_service_factory else None
        )
        animation = self._animation_stage_factory() if self._animation_stage_factory else None
        context_cache = (
            self._chat_context_cache_factory() if self._chat_context_cache_factory else None
        )

        session = ConversationSession(
            session_id=sid,
            user_id=user_id,
            avatar_id=avatar_id,
            asr_service=asr,
            llm_service=llm,
            tts_service=tts,
            retrieval_service=retrieval,
            animation_stage=animation,
            context_cache=context_cache,
            intent_classifier=self._intent_classifier,
            tts_voice=voice_id,
            persist_turn=self.persist_turn,
        )
        session.on_cleanup = on_cleanup
        async with self._lock:
            self._sessions[sid] = session

        self._set_session_tts_voice(session, voice_id, "set")

        async with self._lock:
            connected_count = sum(1 for s in self._sessions.values() if s.connected)
            resumable_count = len(self._sessions)
        logger.info(
            f"Session created | id={sid} | user={user_id} | avatar={avatar_id} | "
            f"voice={voice_id or 'default'} | active_ws={connected_count} | resumable={resumable_count}"
        )
        return session

    async def get_session(self, session_id: str) -> ConversationSession | None:
        parsed_session_id = parse_uuid(session_id)
        if parsed_session_id is None:
            return None
        session_id = str(parsed_session_id)
        async with self._lock:
            session = self._sessions.get(session_id)
        if session:
            session.touch()
        return session

    async def connect_existing_session(
        self,
        session_id: str,
        user_id: str | None = None,
        avatar_id: str | None = None,
        voice_id: str | None = None,
    ) -> ConversationSession | None:
        parsed_session_id = parse_uuid(session_id)
        if parsed_session_id is None:
            return None
        session_id = str(parsed_session_id)

        async with self._lock:
            session = self._sessions.get(session_id)
            if session:
                if user_id and session.user_id != user_id:
                    raise PermissionError("Cannot attach to another user's session.")
                if avatar_id and session.avatar_id != avatar_id:
                    session.pipeline.change_avatar(avatar_id)
                    session.avatar_id = avatar_id
                session.mark_connected()
                self._set_session_tts_voice(session, voice_id, "updated")
                return session

        if not user_id:
            return None

        async with self._repo_factory() as repo:
            persisted = await repo.get_chat_session(session_id)
            if not persisted:
                return None
            if persisted.get("user_id") != user_id:
                raise PermissionError("Cannot attach to another user's session.")

        logger.info(f"Hydrating session {session_id} from database")
        return await self.create_session(
            user_id=user_id,
            session_id=session_id,
            avatar_id=avatar_id or "avatar1",
            voice_id=voice_id,
        )

    async def disconnect_session(self, session_id: str) -> None:
        parsed_session_id = parse_uuid(session_id)
        if parsed_session_id is None:
            return
        session_id = str(parsed_session_id)
        async with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                return
            session.pipeline.abort()
            session.mark_disconnected()
            connected_count = sum(1 for s in self._sessions.values() if s.connected)
            resumable_count = len(self._sessions)
        logger.info(
            f"Session disconnected | id={session_id} | "
            f"active_ws={connected_count} | resumable={resumable_count}"
        )

    async def remove_session(self, session_id: str) -> None:
        parsed_session_id = parse_uuid(session_id)
        if parsed_session_id is None:
            return
        session_id = str(parsed_session_id)
        session_to_clean = None
        async with self._lock:
            if session_id in self._sessions:
                session_to_clean = self._sessions.pop(session_id)

        if session_to_clean:
            session_to_clean.cleanup()
            await session_to_clean.pipeline.invalidate_context(session_id)
            try:
                from app.presentation.http.v1.dependencies import get_ws_connection_manager
                cm = get_ws_connection_manager()
                await cm.cleanup_session(session_id)
            except Exception as e:
                logger.error(f"Failed to cleanup connection manager for {session_id}: {e}")
        logger.info(f"Session removed | id={session_id}")

    async def remove_user_sessions(self, user_id: str) -> None:
        parsed_user_id = parse_uuid(user_id)
        if parsed_user_id is None:
            return
        user_id = str(parsed_user_id)
        sessions_to_clean = []
        async with self._lock:
            to_remove = [sid for sid, s in self._sessions.items() if s.user_id == user_id]
            for sid in to_remove:
                sessions_to_clean.append(self._sessions.pop(sid))

        for session in sessions_to_clean:
            session.cleanup()
            await session.pipeline.invalidate_context(session.session_id)
            try:
                from app.presentation.http.v1.dependencies import get_ws_connection_manager
                cm = get_ws_connection_manager()
                await cm.cleanup_session(session.session_id)
            except Exception as e:
                logger.error(f"Failed to cleanup connection manager for {session.session_id}: {e}")

        if sessions_to_clean:
            logger.info(f"Removed {len(sessions_to_clean)} sessions for user={user_id}")

    async def cleanup_idle(self) -> int:
        idle_sessions = []
        async with self._lock:
            idle_ids = [sid for sid, s in self._sessions.items() if s.idle_seconds > self._timeout]
            for sid in idle_ids:
                idle_sessions.append(self._sessions.pop(sid))

        cleaned = len(idle_sessions)
        for session in idle_sessions:
            session.cleanup()
            await session.pipeline.invalidate_context(session.session_id)
            try:
                from app.presentation.http.v1.dependencies import get_ws_connection_manager
                cm = get_ws_connection_manager()
                await cm.cleanup_session(session.session_id)
            except Exception as e:
                logger.error(f"Failed to cleanup connection manager for {session.session_id}: {e}")

        if cleaned:
            logger.info(f"Cleaned up {cleaned} idle sessions")
        return cleaned

    async def abort_session(self, session_id: str, message_id: str) -> None:
        parsed_session_id = parse_uuid(session_id)
        if parsed_session_id is None:
            return
        session_id = str(parsed_session_id)
        async with self._lock:
            session = self._sessions.get(session_id)
            if session:
                session.pipeline.abort()
        logger.info(f"Session aborted | session_id={session_id} | message_id={message_id}")

    @property
    def active_count(self) -> int:
        """Count only sessions with an active WebSocket connection."""
        return sum(1 for s in self._sessions.values() if s.connected)

    @property
    def total_count(self) -> int:
        """Count all sessions (connected + resumable)."""
        return len(self._sessions)

    async def get_stats(self) -> dict[str, Any]:
        async with self._lock:
            sessions_info = [
                {
                    "id": sid,
                    "user_id": s.user_id,
                    "avatar": s.avatar_id,
                    "connected": s.connected,
                    "idle_sec": round(s.idle_seconds, 1),
                    "history_length": s.pipeline.history_length,
                }
                for sid, s in self._sessions.items()
            ]
        return {
            "active_sessions": sum(1 for s in sessions_info if s["connected"]),
            "total_resumable": len(sessions_info),
            "sessions": sessions_info,
        }
