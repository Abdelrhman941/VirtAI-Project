import asyncio
import time
from typing import TYPE_CHECKING

from loguru import logger

from app.shared.config import get_settings

if TYPE_CHECKING:
    from app.presentation.ws.gateway import WebSocketHandler


class ConnectionLifecycle:
    def __init__(self, handler: "WebSocketHandler"):
        self.handler = handler

    async def cleanup(self) -> None:
        self.handler._connected = False
        if self.handler._heartbeat_task and not self.handler._heartbeat_task.done():
            self.handler._heartbeat_task.cancel()

        await self.handler.pipeline_bridge.cancel_pipeline()

        if self.handler._voice_mode_handler:
            await self.handler._voice_mode_handler.shutdown()

        self.handler.protocol_router.cleanup()

        try:
            from starlette.websockets import WebSocketState

            if self.handler.ws.client_state == WebSocketState.CONNECTED:
                await self.handler.ws.send_text('{"type":"chat.abort","data":{}}')
        except Exception as e:
            logger.debug(f"[WS] Could not send abort frame during cleanup: {e}")

        if self.handler.session and getattr(self.handler.session, "session_id", None):
            await self.handler.connection_manager.unregister(
                self.handler.session.session_id, self.handler.ws
            )

        from app.shared.metrics import ws_connections_active

        ws_connections_active.dec()

    async def heartbeat_loop(self) -> None:
        self.handler._last_pong_time = time.time()
        settings = get_settings()
        while self.handler._connected:
            await asyncio.sleep(settings.WS_HEARTBEAT_INTERVAL)
            if not self.handler._connected:
                break

            if time.time() - self.handler._last_pong_time > settings.WS_HEARTBEAT_TIMEOUT:
                self.handler._connected = False
                break

            try:
                from app.schemas.ws_messages import ServerPong

                await self.handler.outbound_sender.send_protocol_message(
                    ServerPong(timestamp=time.time()),
                    self.handler.session.session_id,
                    self.handler._session_pending,
                    self.handler._connected,
                )
            except Exception:
                self.handler._connected = False
                break
