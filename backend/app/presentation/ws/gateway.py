import asyncio
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect
from loguru import logger
from pydantic import ValidationError

from app.application.chat.session_manager import SessionManager, ConversationSession


class FastAPIOutboundSender(OutboundSender):
    def __init__(self, websocket: WebSocket):
        self.ws = websocket

    async def send_event(self, event: DomainEvent) -> None:
        try:
            payload = {"event": event.__class__.__name__, "content": event.content}
            await self.ws.send_json(payload)
        except Exception as e:
            logger.error(f"[WS] Error sending outbound event: {e}")


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

    async def run(self) -> None:
        try:
            await self._accept_and_register()
            await self._message_loop()
        except WebSocketDisconnect:
            logger.info(f"[WS] Client disconnected: session {self.session_id}")
        except Exception as e:
            logger.error(f"[WS] Unexpected error: {e}")
        finally:
            self._teardown()

    async def _accept_and_register(self) -> None:
        # Connection is already accepted by the router before handler.run()
        pass

    async def _message_loop(self) -> None:
        if not self.session_id:
            return

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
                # Forward to pipeline
                if self.session and hasattr(self.session, "pipeline"):
                    from app.schemas.ws_messages import ChatUserMessage
                    import json
                    try:
                        msg_dict = json.loads(data)
                        if msg_dict.get("type") == "chat.user_message":
                            payload = ChatUserMessage(**msg_dict.get("data", {}))
                            await self.session.pipeline.process_user_message(payload)
                    except Exception as parse_e:
                        logger.error(f"[WS] Parse error: {parse_e}")
            except ValidationError as e:
                logger.error(f"[WS] Validation error: {e}")
            except ValueError as e:
                logger.error(f"[WS] Invalid state/session: {e}")
            except Exception as e:
                logger.error(f"[WS] Error processing message: {e}")

    def _teardown(self) -> None:
        if self.session_id:
            self.session_manager.cleanup_session(self.session_id)
            logger.info(f"[WS] Session {self.session_id} cleaned up")
