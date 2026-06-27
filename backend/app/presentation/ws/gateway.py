from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass

from fastapi import WebSocket, WebSocketDisconnect
from loguru import logger
from pydantic import ValidationError

from app.application.chat.session_manager import Session
from app.presentation.ws.connection_manager import WSConnectionManager
from app.presentation.ws.outbound_sender import OutboundSender
from app.presentation.ws.pipeline_bridge import PipelineBridge, _pipeline_task_done_callback
from app.presentation.ws.protocol_router import ProtocolRouter
from app.presentation.ws.session_bootstrap import SessionBootstrap
from app.presentation.ws.voice_mode_handler import VoiceModeHandler
from app.schemas.ws_messages import ServerReady
from app.shared.config import get_settings


@dataclass(frozen=True)
class PendingSession:
    session_id: str
    avatar_id: str

    def touch(self) -> None:
        pass


class WebSocketHandler:
    """
    Handles a single WebSocket connection.
    Composed of ProtocolRouter, SessionBootstrap, PipelineBridge, OutboundSender.
    """

    _family_id: str | None = None

    def __init__(
        self,
        websocket: WebSocket,
        session: Session | None,
        session_manager,
        user_id: str,
        avatar_id: str,
        voice_id: str,
        connection_manager: WSConnectionManager,
        resumed: bool = False,
        replay_after_seq: int = 0,
        requested_session_id: str | None = None,
    ):
        self.ws = websocket
        self._session_manager = session_manager
        self._user_id = user_id
        self._family_id = None
        self._avatar_id = avatar_id
        self._voice_id = self._normalize_voice(voice_id)
        self._session_pending = session is None
        self._requested_session_id = requested_session_id
        self.session = session or PendingSession(
            session_id=requested_session_id or "",
            avatar_id=avatar_id,
        )
        self.pipeline = session.pipeline if session is not None else None
        self.connection_manager = connection_manager
        self.resumed = resumed
        self.replay_after_seq = replay_after_seq

        # Connection state
        self._connected = True
        self._last_pong_time = time.time()

        # Background tasks
        self._heartbeat_task: asyncio.Task | None = None
        self._voice_mode_handler: VoiceModeHandler | None = None
        self._turn_lock = asyncio.Lock()

        # Components
        self.outbound_sender = OutboundSender(self.ws, self.connection_manager)
        self.session_bootstrap = SessionBootstrap(self._session_manager, self.connection_manager)
        self.pipeline_bridge = PipelineBridge(self)
        self.protocol_router = ProtocolRouter(self)

        from app.presentation.ws.connection_lifecycle import ConnectionLifecycle
        from app.presentation.ws.frame_dispatcher import FrameDispatcher

        self.connection_lifecycle = ConnectionLifecycle(self)
        self.frame_dispatcher = FrameDispatcher(self)

        from app.shared.metrics import ws_connections_active

        ws_connections_active.inc()

        logger.info(
            f"WebSocketHandler created | "
            f"session={self.session.session_id or 'pending'} | "
            f"avatar={self.session.avatar_id} | "
            f"resumed={resumed} | replay_after_seq={replay_after_seq}"
        )

    def _normalize_voice(self, voice_id: str) -> str:
        if not voice_id:
            return "aria"
        return voice_id

    async def _ensure_session(self) -> None:
        if not self._session_pending:
            return
        self.session, self._session_pending = await self.session_bootstrap.ensure_session(
            self.ws,
            self._user_id,
            self._avatar_id,
            self._voice_id,
            self._requested_session_id,
            self._family_id,
            self._session_pending,
        )
        self.pipeline = self.session.pipeline

    async def run(self) -> None:
        settings = get_settings()
        replay_batch: list[str] = []
        if self.resumed and self.session.session_id:
            await self.connection_manager.register(
                self.session.session_id, self.ws, user_id=self._user_id, family_id=self._family_id
            )
            replay_batch = await self.connection_manager.get_replay_batch(
                self.session.session_id, after_seq=self.replay_after_seq
            )

        try:
            if not self._session_pending:
                await self.outbound_sender.send_protocol_message(
                    ServerReady(
                        session_id=self.session.session_id or None,
                        avatar_id=self.session.avatar_id,
                        message="Connected and ready",
                        resumed=self.resumed,
                        last_seq=(
                            self.connection_manager.latest_sequence(self.session.session_id)
                            if self.session.session_id
                            else 0
                        ),
                        timestamp=time.time(),
                    ),
                    self.session.session_id,
                    self._session_pending,
                    self._connected,
                )

            if self.resumed:
                for payload in replay_batch:
                    if not self._connected:
                        break
                    try:
                        await self.ws.send_text(payload)
                    except Exception:
                        break
        except Exception as e:
            logger.error(f"[WS] Failed to send ready message: {e}")
            self._connected = False
            try:
                await self.ws.close(code=1011, reason="Internal server error")
            except Exception:
                pass
            return

        self._heartbeat_task = asyncio.create_task(self.connection_lifecycle.heartbeat_loop())

        try:
            while self._connected:
                try:
                    message = await asyncio.wait_for(self.ws.receive(), timeout=1.0)

                    if message.get("type") == "websocket.disconnect":
                        self._connected = False
                        break

                    max_size = settings.WS_MAX_MESSAGE_SIZE
                    if "text" in message:
                        msg_size = len(message["text"].encode("utf-8"))
                        if msg_size > max_size:
                            await self.frame_dispatcher.close_for_message_too_large(
                                msg_size, max_size, "text"
                            )
                            break
                    elif "bytes" in message:
                        msg_size = len(message["bytes"])
                        if msg_size > max_size:
                            await self.frame_dispatcher.close_for_message_too_large(
                                msg_size, max_size, "binary"
                            )
                            break

                    if "text" in message:
                        await self.protocol_router.route_message(message["text"])
                    elif "bytes" in message:
                        await self.frame_dispatcher.handle_binary_frame(message["bytes"])

                except asyncio.TimeoutError:
                    continue
                except WebSocketDisconnect:
                    from app.shared.metrics import ws_connection_drops

                    ws_connection_drops.labels(reason="client_disconnect").inc()
                    self._connected = False
                    break
                except RuntimeError as e:
                    from app.shared.metrics import ws_connection_drops

                    if "disconnect" in str(e).lower() or "receive" in str(e).lower():
                        ws_connection_drops.labels(reason="runtime_error_disconnect").inc()
                    else:
                        logger.error(f"[WS] Unexpected RuntimeError: {e}")
                        ws_connection_drops.labels(reason="runtime_error").inc()
                    self._connected = False
                    break
                except ValidationError as e:
                    logger.error(f"[WS] Validation error: {e}")
                    await self.outbound_sender.safe_send_error(
                        code="INVALID_MESSAGE",
                        message=f"Message validation failed: {e!s}",
                        session_id=self.session.session_id,
                        session_pending=self._session_pending,
                        connected=self._connected,
                    )
                except Exception as e:
                    logger.error(f"[WS] Error receiving message: {e}")
                    from app.shared.metrics import ws_connection_drops

                    ws_connection_drops.labels(reason="unexpected_error").inc()
                    await self.outbound_sender.safe_send_error(
                        code="INTERNAL_ERROR",
                        message="Error processing message",
                        session_id=self.session.session_id,
                        session_pending=self._session_pending,
                        connected=self._connected,
                    )
                    self._connected = False
                    break
        finally:
            await self.connection_lifecycle.cleanup()

    async def _get_voice_mode_handler(self) -> VoiceModeHandler:
        await self._ensure_session()
        if self._voice_mode_handler is None:
            pipeline = self.pipeline
            if not pipeline:
                raise RuntimeError("Pipeline not initialized")
            asr_service = pipeline._asr
            if asr_service is None:
                raise ValueError("ASR service not injected into pipeline")

            self._voice_mode_handler = VoiceModeHandler(
                websocket=self.ws,
                session_id=self.session.session_id,
                asr_service=asr_service,
                turn_callback=self._run_text_turn,
                outbound_sender=self.outbound_sender,
                audio_pipeline=getattr(self.session, "audio_pipeline", None),
            )
        return self._voice_mode_handler

    async def _run_text_turn(self, text: str) -> None:
        if not text or not text.strip():
            return

        async with self._turn_lock:
            await self._ensure_session()
            await self.pipeline_bridge.cancel_pipeline()
            pipeline = self.pipeline
            if not pipeline:
                raise RuntimeError("Pipeline not initialized")

        message_id = str(uuid.uuid4())
        self._current_message_id = message_id
        session_id = self.session.session_id
        trace_id = str(uuid.uuid4())

        async def send_callback(message):
            await self.outbound_sender.send_protocol_message(
                message, session_id, self._session_pending, self._connected
            )

        async def send_binary_callback(data: bytes):
            if self._connected:
                await self.outbound_sender.send_binary(data)

        self.pipeline_bridge.pipeline_task = asyncio.create_task(
            pipeline.process_message(
                message_id=message_id,
                text=text,
                session_id=session_id,
                send_callback=send_callback,
                send_binary_callback=send_binary_callback,
                trace_id=trace_id,
            ),
            name=f"pipeline_voice_{session_id}",
        )
        self.pipeline_bridge.pipeline_task.add_done_callback(_pipeline_task_done_callback)
