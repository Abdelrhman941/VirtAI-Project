import asyncio
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect
from loguru import logger
from pydantic import ValidationError

from app.application.chat.session_manager import ConversationSession, SessionManager
from app.presentation.ws.outbound_sender import OutboundSender


class WebSocketHandler:
    """
    Acts purely as an I/O pipe mapping FastAPI WebSocket events 
    to Domain Events and delegating to the SessionManager.
    """

    def __init__(
        self,
        websocket: WebSocket,
        user_id: str = "anonymous",
        **kwargs: Any,
    ):
        self.ws = websocket
        self.session_manager: SessionManager = kwargs.get("session_manager")
        self.user_id = user_id
        self.session: ConversationSession | None = kwargs.get("session")
        self.session_id: str | None = self.session.session_id if getattr(self.session, "session_id", None) else None

        self.connection_manager = kwargs.get("connection_manager")
        self.avatar_id = kwargs.get("avatar_id")
        self.voice_id = kwargs.get("voice_id")

    async def run(self) -> None:
        try:
            await self._accept_and_register()
            await self._message_loop()
        except WebSocketDisconnect:
            logger.info(f"[WS] Client disconnected: session {self.session_id}")
        except Exception as e:
            logger.error(f"[WS] Unexpected error: {e}")
        finally:
            if getattr(self, "_voice_mode_handler", None):
                try:
                    await self._voice_mode_handler.shutdown()
                except Exception as e:
                    logger.error(f"[WS] Error during voice mode shutdown: {e}")

            if self.connection_manager and self.session_id:
                try:
                    await self.connection_manager.unregister(self.session_id, self.ws)
                except Exception as e:
                    logger.error(f"[WS] Error during unregister: {e}")

            if self.session and hasattr(self.session, "pipeline"):
                try:
                    self.session.pipeline.abort()
                    if hasattr(self, "_generation_task") and self._generation_task and not self._generation_task.done():
                        self._generation_task.cancel()
                    logger.info(f"[WS] Aborted generation for session {self.session_id} on teardown")
                except Exception as e:
                    logger.error(f"[WS] Error during pipeline abort: {e}")

    async def _accept_and_register(self) -> None:
        # Connection is already accepted by the router before handler.run()
        pass

    async def _message_loop(self) -> None:
        while True:
            try:
                msg = await self.ws.receive()
                if msg["type"] == "websocket.disconnect":
                    logger.info(f"[WS] Client disconnected: session {self.session_id}")
                    break
                elif msg["type"] == "websocket.receive":
                    if "text" in msg:
                        data = msg["text"]
                    elif "bytes" in msg:
                        data = msg["bytes"]
                        if not data:
                            continue

                        # The frontend appends a 1-byte flag to indicate `is_final`
                        is_final = data[-1] == 1
                        pcm_bytes = data[:-1]

                        if self.session and hasattr(self.session, "pipeline") and self.session.pipeline._asr:
                            if not getattr(self, "_voice_mode_handler", None):
                                from app.presentation.ws.voice_mode_handler import VoiceModeHandler
                                sender = OutboundSender(self.ws, self.connection_manager)

                                async def _turn_callback(transcript: str) -> None:
                                    import uuid
                                    msg_id = str(uuid.uuid4())

                                    async def send_cb(m: Any, _sender=sender) -> None:
                                        await _sender.send_protocol_message(m, self.session_id, False, True)
                                    
                                    async def send_bin_cb(d: bytes, _sender=sender) -> None:
                                        await _sender.send_binary(d)

                                    if hasattr(self, "_generation_task") and self._generation_task and not self._generation_task.done():
                                        logger.info(f"[WS] Cancelling previous generation task for session {self.session_id}")
                                        self.session.pipeline.abort()
                                        self._generation_task.cancel()

                                    self._generation_task = asyncio.create_task(
                                        self.session.pipeline.process_message(
                                            message_id=msg_id,
                                            text=transcript,
                                            session_id=self.session_id,
                                            send_callback=send_cb,
                                            send_binary_callback=send_bin_cb,
                                            user_id=self.user_id,
                                        )
                                    )

                                    def _log_task_exception(task: asyncio.Task) -> None:
                                        try:
                                            exc = task.exception()
                                            if exc and not isinstance(exc, asyncio.CancelledError):
                                                logger.error(f"[WS] Unhandled exception in generation task: {exc}")
                                        except asyncio.CancelledError:
                                            pass

                                    self._generation_task.add_done_callback(_log_task_exception)

                                self._voice_mode_handler = VoiceModeHandler(
                                    websocket=self.ws,
                                    session_id=self.session_id,
                                    asr_service=self.session.pipeline._asr,
                                    conversation_pipeline=self.session.pipeline,
                                    turn_callback=_turn_callback,
                                    outbound_sender=sender,
                                    audio_pipeline=self.session.audio_pipeline
                                )

                            await self._voice_mode_handler.handle_audio_chunk(pcm_bytes, is_final=is_final)
                        continue
                    else:
                        continue
                else:
                    continue
            except asyncio.exceptions.IncompleteReadError:
                logger.info(f"[WS] Client disconnected (IncompleteReadError): session {self.session_id}")
                break
            except RuntimeError as e:
                logger.info(f"[WS] Client disconnected (RuntimeError): session {self.session_id} - {e}")
                break
            except Exception as e:
                logger.error(f"[WS] Error receiving data: {e}")
                break
            try:
                import json
                try:
                    msg_dict = json.loads(data)
                except json.JSONDecodeError as e:
                    logger.error(f"[WS] JSON parse error: {e}")
                    sender = OutboundSender(self.ws, self.connection_manager)
                    await sender.safe_send_error(
                        code="INVALID_MESSAGE",
                        message="Invalid JSON payload",
                        session_id=self.session_id,
                        session_pending=False,
                        connected=True
                    )
                    continue
                msg_type = msg_dict.get("type")

                if msg_type == "ping":
                    try:
                        await self.ws.send_json({"type": "pong"})
                    except Exception as e:
                        logger.debug(f"[WS] Failed to send pong (connection closed?): {e}")
                        break
                    continue

                if msg_type == "chat.user_message":
                    from app.schemas.ws_messages import ChatUserMessage
                    payload = ChatUserMessage(**msg_dict.get("data", {}))

                    # 1) If message has a session_id but we don't, bind to it (frontend created it via REST)
                    if payload.session_id and not self.session_id:
                        self.session_id = payload.session_id
                        self.session = await self.session_manager.connect_existing_session(
                            session_id=self.session_id,
                            user_id=self.user_id,
                            avatar_id=self.avatar_id,
                            voice_id=self.voice_id
                        )
                        if self.connection_manager and self.session:
                            await self.connection_manager.register(
                                self.session_id,
                                self.ws,
                                self.user_id,
                                getattr(self, "_family_id", None)
                            )
                        logger.info(f"[WS] Bound WS to REST session | session_id={self.session_id}")

                    # 2) Lazy session creation (fallback if frontend didn't create one)
                    if not self.session_id:
                        new_session = await self.session_manager.create_session(
                            user_id=self.user_id,
                            avatar_id=self.avatar_id,
                            voice_id=self.voice_id
                        )
                        # Ensure the newly created session is fully committed/available
                        # We bypass the get_session "alive" check here because the transaction
                        # might not be fully visible to a separate get_session read immediately.
                        self.session = new_session
                        self.session_id = new_session.session_id
                        if self.connection_manager:
                            await self.connection_manager.register(
                                self.session_id,
                                self.ws,
                                self.user_id,
                                getattr(self, "_family_id", None)
                            )
                        logger.info(f"[WS] Lazy session created | session_id={self.session_id}")
                    else:
                        # 3) Guard: verify the existing session wasn't deleted mid-flight
                        # (race with DELETE /api/v1/chat/all or DELETE /api/v1/chat/{id})
                        alive = await self.session_manager.get_session(self.session_id)
                        if alive is None:
                            logger.warning(
                                f"[WS] Session {self.session_id} was deleted "
                                "mid-flight — aborting message processing"
                            )
                            sender = OutboundSender(self.ws, self.connection_manager)
                            await sender.safe_send_error(
                                code="SESSION_DELETED",
                                message="Session was deleted before the message could be processed",
                                session_id=self.session_id,
                                session_pending=False,
                                connected=True,
                            )
                            continue

                    # Forward to pipeline
                    if self.session and hasattr(self.session, "pipeline"):

                        sender = OutboundSender(self.ws, self.connection_manager)

                        async def send_callback(msg: Any, _sender=sender) -> None:
                            await _sender.send_protocol_message(msg, self.session_id, False, True)

                        async def send_binary_callback(data: bytes, _sender=sender) -> None:
                            await _sender.send_binary(data)

                        if hasattr(self, "_generation_task") and self._generation_task and not self._generation_task.done():
                            logger.info(f"[WS] Cancelling previous generation task for session {self.session_id}")
                            self.session.pipeline.abort()
                            self._generation_task.cancel()
                            # We don't await the cancelled task here to avoid blocking the receive loop,
                            # but pipeline.abort() ensures it stops quickly.

                        self._generation_task = asyncio.create_task(
                            self.session.pipeline.process_message(
                                message_id=payload.message_id,
                                text=payload.text,
                                session_id=self.session_id,
                                send_callback=send_callback,
                                send_binary_callback=send_binary_callback,
                                user_id=self.user_id,
                            )
                        )

                        def _log_task_exception(task: asyncio.Task) -> None:
                            try:
                                exc = task.exception()
                                if exc and not isinstance(exc, asyncio.CancelledError):
                                    logger.error(f"[WS] Unhandled exception in generation task: {exc}")
                            except asyncio.CancelledError:
                                pass

                        self._generation_task.add_done_callback(_log_task_exception)

                elif msg_type == "chat.abort":
                    if self.session and hasattr(self.session, "pipeline"):
                        self.session.pipeline.abort()
                        logger.info(f"[WS] Aborted generation for session {self.session_id}")

                elif msg_type == "client.speech_stopped":
                    if getattr(self, "_voice_mode_handler", None):
                        await self._voice_mode_handler.process_accumulated_audio()

            except ValidationError as e:
                logger.error(f"[WS] Validation error: {e}")
                sender = OutboundSender(self.ws, self.connection_manager)
                await sender.safe_send_error(
                    code="INVALID_MESSAGE",
                    message="Message validation failed",
                    session_id=self.session_id,
                    session_pending=False,
                    connected=True,
                    details={"errors": e.errors()}
                )
            except ValueError as e:
                logger.error(f"[WS] Invalid state/session: {e}")
            except Exception as e:
                logger.exception(f"[WS] Error processing message: {e}")
