import json

from fastapi import WebSocket
from loguru import logger
from pydantic import BaseModel

from app.presentation.ws.connection_manager import WSConnectionManager
from app.schemas.ws_messages import make_error


class OutboundSender:
    """Handles sending outbound messages via WebSocket."""

    _PROTOCOL_MESSAGE_TYPES: dict[str, str] = {
        "TranscriptMessage": "transcript",
        "ErrorMessage": "error",
        "ChatDelta": "chat.delta",
        "ChatFinal": "chat.final",
        "PipelineState": "pipeline.state",
        "TTSReady": "tts.ready",
        "VisemesReady": "visemes.ready",
        "AnimationTimeline": "animation.timeline",
        "AnimationTimelineV2": "animation.timeline.v2",
        "UserMessageEcho": "user.message.echo",
        "ServerReady": "ready",
        "ServerPong": "pong",
    }

    def __init__(self, websocket: WebSocket, connection_manager: WSConnectionManager):
        self.ws = websocket
        self.connection_manager = connection_manager

    async def send_binary(self, data: bytes) -> None:
        """Send raw binary data to the client over WebSocket."""
        await self.ws.send_bytes(data)

    async def safe_send_raw(self, payload: dict, session_id: str | None) -> None:
        """Send a raw dictionary payload."""
        try:
            if not session_id:
                await self.ws.send_text(json.dumps(payload))
                return

            serialized = await self.connection_manager.stamp_and_record(session_id, payload)
            await self.ws.send_text(serialized)
        except Exception:
            pass

    async def safe_send_error(
        self,
        code: str,
        message: str,
        session_id: str | None,
        session_pending: bool,
        connected: bool,
        message_id: str | None = None,
        details: dict | None = None,
    ) -> None:
        """Send error message using new protocol ErrorMessage schema."""
        error_msg = make_error(
            code=code,
            message=message,
            session_id=session_id,
            message_id=message_id,
            details=details,
        )

        await self.send_protocol_message(error_msg, session_id, session_pending, connected)

    async def send_protocol_message(
        self, message: BaseModel, session_id: str | None, session_pending: bool, connected: bool
    ) -> None:
        """Send new protocol message (Pydantic model) to client."""
        if not connected:
            return

        try:
            class_name = message.__class__.__name__

            if class_name not in self._PROTOCOL_MESSAGE_TYPES:
                raise ValueError(f"Unmapped protocol message type: {class_name}")

            message_type = self._PROTOCOL_MESSAGE_TYPES[class_name]

            envelope = {
                "type": message_type,
                "data": message.model_dump(exclude_none=True),
            }
            logger.info(f"[WS OUT] {message_type} | session_id={session_id} | data={envelope['data']}")

            if session_pending or not session_id:
                serialized = json.dumps(envelope)
                await self.ws.send_text(serialized)
                return

            serialized = await self.connection_manager.stamp_and_record(session_id, envelope)
            await self.ws.send_text(serialized)

        except Exception as e:
            error_str = str(e)
            if "Cannot call" in error_str and "close message has been sent" in error_str:
                logger.debug(f"Transport layer: client disconnected gracefully (cannot send {class_name})")
                return
            if "ConnectionClosed" in type(e).__name__:
                logger.debug(f"Transport layer: ConnectionClosed (cannot send {class_name})")
                return
            
            logger.error(f"Transport layer serialization failure: {e}")
            error_payload = {
                "type": "error",
                "data": {
                    "code": "PROTOCOL_ROUTING_ERROR",
                    "message": f"Critical backend serialization failure: {e!s}",
                },
            }
            try:
                # Need to check client state to avoid triggering the same exception again
                from starlette.websockets import WebSocketState
                if self.ws.client_state == WebSocketState.CONNECTED:
                    await self.ws.send_text(json.dumps(error_payload))
            except Exception as inner_e:
                logger.error(f"Failed to transmit error payload: {inner_e}")
