import asyncio
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect
from loguru import logger
from pydantic import ValidationError

from app.application.chat.session_manager import SessionManager, ConversationSession
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

    async def _accept_and_register(self) -> None:
        # Connection is already accepted by the router before handler.run()
        pass

    async def _message_loop(self) -> None:
        while True:
            try:
                data = await self.ws.receive_text()
            except asyncio.exceptions.IncompleteReadError:
                logger.info(f"[WS] Client disconnected (IncompleteReadError): session {self.session_id}")
                break
            except RuntimeError as e:
                logger.info(f"[WS] Client disconnected (RuntimeError): session {self.session_id} - {e}")
                break
            except Exception as e:
                logger.error(f"[WS] Error receiving text: {e}")
                break
            try:
                import json
                msg_dict = json.loads(data)
                msg_type = msg_dict.get("type")

                if msg_type == "ping":
                    await self.ws.send_json({"type": "pong"})
                    continue

                if msg_type == "chat.user_message":
                    # Lazy session creation
                    if not self.session_id:
                        new_session = await self.session_manager.create_session(
                            user_id=self.user_id,
                            avatar_id=self.avatar_id,
                            voice_id=self.voice_id
                        )
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

                    # Forward to pipeline
                    if self.session and hasattr(self.session, "pipeline"):
                        from app.schemas.ws_messages import ChatUserMessage
                        payload = ChatUserMessage(**msg_dict.get("data", {}))
                        await self.session.pipeline.process_user_message(payload)
            except ValidationError as e:
                logger.error(f"[WS] Validation error: {e}")
            except ValueError as e:
                logger.error(f"[WS] Invalid state/session: {e}")
            except Exception as e:
                logger.error(f"[WS] Error processing message: {e}")
