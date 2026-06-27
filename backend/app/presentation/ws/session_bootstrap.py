import asyncio

from fastapi import WebSocket
from loguru import logger

from app.application.chat.session_manager import Session, SessionManager
from app.presentation.ws.connection_manager import WSConnectionManager


class SessionBootstrap:
    """Handles WebSocket session initialization."""

    def __init__(self, session_manager: SessionManager, connection_manager: WSConnectionManager):
        self.session_manager = session_manager
        self.connection_manager = connection_manager

    async def ensure_session(
        self,
        websocket: WebSocket,
        user_id: str,
        avatar_id: str,
        voice_id: str,
        requested_session_id: str | None,
        family_id: str | None,
        session_pending: bool,
    ) -> tuple[Session, bool]:
        """Registers the websocket to an existing session. Fails if no session_id provided."""
        if not requested_session_id:
            raise ValueError("WS lazy session creation is disabled. session_id is required.")

        session = await self.session_manager.connect_existing_session(
            session_id=requested_session_id,
            user_id=user_id,
            avatar_id=avatar_id,
            voice_id=voice_id,
        )

        if not session:
            logger.warning(
                f"[WS] Session {requested_session_id} not found or does not belong to user. Creating new session."
            )
            session = await self.session_manager.create_session(
                user_id=user_id,
                session_id=requested_session_id,
                avatar_id=avatar_id,
                voice_id=voice_id,
            )

        # Set cleanup handler to clear WS memory when session is permanently destroyed
        session.on_cleanup = lambda sid=session.session_id: asyncio.create_task(
            self.connection_manager.cleanup_session(sid)
        )

        await self.connection_manager.register(
            session.session_id, websocket, user_id=user_id, family_id=family_id
        )
        logger.info(f"[WS] Session registered | session={session.session_id}")
        return session, False

    async def handle_session_restore(self, session_id: str, ctx) -> None:
        session = await self.session_manager.connect_existing_session(
            session_id=session_id,
            user_id=ctx._user_id,
            avatar_id=ctx._avatar_id,
            voice_id=ctx._voice_id,
        )
        if session:
            resumed = True
            last_seq = self.connection_manager.latest_sequence(session.session_id)
        else:
            session = await self.session_manager.create_session(
                user_id=ctx._user_id,
                session_id=session_id,
                avatar_id=ctx._avatar_id,
                voice_id=ctx._voice_id,
            )
            resumed = False
            last_seq = 0

        session.on_cleanup = lambda sid=session.session_id: asyncio.create_task(
            self.connection_manager.cleanup_session(sid)
        )
        await self.connection_manager.register(
            session.session_id, ctx.ws, user_id=ctx._user_id, family_id=ctx._family_id
        )
        ctx.session = session
        ctx.pipeline = session.pipeline
        ctx._session_pending = False
        
        await ctx.outbound_sender.send_protocol_message(
            {"type": "ready", "data": {"session_id": session.session_id, "resumed": resumed, "last_seq": last_seq}},
            session.session_id,
            False,
            ctx._connected
        )

    async def handle_session_new(self, ctx) -> None:
        session = await self.session_manager.create_session(
            user_id=ctx._user_id,
            avatar_id=ctx._avatar_id,
            voice_id=ctx._voice_id,
        )
        session.on_cleanup = lambda sid=session.session_id: asyncio.create_task(
            self.connection_manager.cleanup_session(sid)
        )
        await self.connection_manager.register(
            session.session_id, ctx.ws, user_id=ctx._user_id, family_id=ctx._family_id
        )
        ctx.session = session
        ctx.pipeline = session.pipeline
        ctx._session_pending = False

        await ctx.outbound_sender.send_protocol_message(
            {"type": "ready", "data": {"session_id": session.session_id, "resumed": False, "last_seq": 0}},
            session.session_id,
            False,
            ctx._connected
        )
