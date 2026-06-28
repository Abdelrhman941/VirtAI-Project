import asyncio
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect
from loguru import logger
from pydantic import ValidationError

from app.application.chat.session_manager_v2 import (
    DomainEvent,
    IncomingMessage,
    OutboundSender,
    SessionManager,
)

# Global SessionManager instance shared across all WebSocket connections
global_session_manager = SessionManager()


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
        self.session_manager = global_session_manager
        self.user_id = user_id
        self.session_id: str | None = None

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
        await self.ws.accept()
        outbound = FastAPIOutboundSender(self.ws)
        self.session_id = await self.session_manager.register_connection(self.user_id, outbound)
        logger.info(f"[WS] Connection registered for user {self.user_id}, session {self.session_id}")

    async def _message_loop(self) -> None:
        if not self.session_id:
            return

        while True:
            data = await self.ws.receive_text()
            try:
                msg = IncomingMessage(content=data)
                await self.session_manager.handle_message(self.session_id, msg)
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
