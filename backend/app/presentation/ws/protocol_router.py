import asyncio
import json
import time
import uuid

from loguru import logger
from pydantic import TypeAdapter, ValidationError

from app.presentation.ws.pipeline_bridge import _pipeline_task_done_callback
from app.schemas.ws_messages import (
    ChatAbort,
    ChatUserMessage,
    ClientSpeechStopped,
    WSMessageEnvelope,
    make_pipeline_state,
)

envelope_adapter = TypeAdapter(WSMessageEnvelope)


def validate_message(raw_message: dict) -> ChatUserMessage | ChatAbort | ClientSpeechStopped:
    if not isinstance(raw_message, dict):
        raise ValueError("Message must be a dictionary")
    if "type" not in raw_message:
        raise ValueError("Message missing 'type' field")

    # Map "text" to "chat.user_message" for frontend compatibility
    if raw_message["type"] == "text":
        raw_message["type"] = "chat.user_message"

    # Use discriminated union to validate payload structure
    try:
        envelope = envelope_adapter.validate_python(raw_message)
        return envelope.data
    except ValidationError as e:
        # Check if it failed because the type wasn't in the union
        msg_type = raw_message.get("type")
        if msg_type not in [
            "chat.user_message",
            "chat.abort",
            "client.speech_stopped",
            "tts.request",
        ]:
            raise ValueError(f"Unknown message type: {msg_type}")
        raise e


class ProtocolRouter:
    """Routes incoming WebSocket messages to appropriate handlers."""

    def __init__(self, context):
        """
        context must provide:
        - session, _ensure_session(), _get_voice_mode_handler(), _last_pong_time
        - pipeline_bridge
        - outbound_sender
        - ws
        """
        self.ctx = context

    async def route_message(self, raw: str) -> None:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            logger.warning(f"Invalid JSON: {raw[:100]} | {e}")
            await self.ctx.outbound_sender.safe_send_error(
                code="INVALID_MESSAGE",
                message="Invalid JSON format",
                session_id=None,
                session_pending=self.ctx._session_pending,
                connected=self.ctx._connected,
            )
            return

        if not isinstance(data, dict):
            await self.ctx.outbound_sender.safe_send_error(
                code="INVALID_MESSAGE",
                message="Message must be a JSON object",
                session_id=None,
                session_pending=self.ctx._session_pending,
                connected=self.ctx._connected,
            )
            return

        msg_type_str = data.get("type", "")
        if not msg_type_str:
            return

        self.ctx.session.touch()
        self.ctx._last_pong_time = time.time()

        if msg_type_str == "ws.ack":
            await self._handle_ws_ack(data)
            return

        if msg_type_str == "text":
            msg_type_str = "chat.user_message"
            data["type"] = "chat.user_message"
            raw = json.dumps(data)

        if "." in msg_type_str:
            await self._route_validated_message(raw)
            return

        await self.ctx.outbound_sender.safe_send_error(
            code="UNKNOWN_TYPE",
            message=f"Unknown message type: {msg_type_str}",
            session_id=None,
            session_pending=self.ctx._session_pending,
            connected=self.ctx._connected,
        )

    async def _route_validated_message(self, raw: str) -> None:
        data = json.loads(raw)
        try:
            validated_msg = validate_message(data)
        except ValidationError as e:
            await self.ctx.outbound_sender.safe_send_error(
                code="INVALID_MESSAGE",
                message=f"Message validation failed: {e!s}",
                session_id=self.ctx.session.session_id,
                session_pending=self.ctx._session_pending,
                connected=self.ctx._connected,
            )
            return
        except ValueError as e:
            await self.ctx.outbound_sender.safe_send_error(
                code="UNKNOWN_TYPE",
                message=str(e),
                session_id=self.ctx.session.session_id,
                session_pending=self.ctx._session_pending,
                connected=self.ctx._connected,
            )
            return

        try:
            if isinstance(validated_msg, ChatUserMessage):
                await self._handle_chat_user_message(validated_msg)
            elif isinstance(validated_msg, ChatAbort):
                await self._handle_chat_abort(validated_msg)
            elif isinstance(validated_msg, ClientSpeechStopped):
                await self._handle_voice_mode_stop(None)
        except Exception as e:
            logger.error(f"Error handling message: {e}")
            await self.ctx.outbound_sender.safe_send_error(
                code="INTERNAL_ERROR",
                message="Error processing message",
                session_id=self.ctx.session.session_id,
                session_pending=self.ctx._session_pending,
                connected=self.ctx._connected,
            )

    async def _handle_abort(self, data: dict | None = None) -> None:
        async with self.ctx._turn_lock:
            await self.ctx.pipeline_bridge.cancel_pipeline()
            await self.ctx.outbound_sender.send_protocol_message(
                make_pipeline_state(
                    self.ctx.session.session_id,
                    "idle",
                    getattr(self.ctx, "_current_message_id", None),
                ),
                self.ctx.session.session_id,
                self.ctx._session_pending,
                self.ctx._connected,
            )

    async def _handle_voice_mode_stop(self, data: dict | None = None) -> None:
        if self.ctx._voice_mode_handler is not None:
            self.ctx._voice_mode_handler.audio_pipeline.clear_buffer()

    async def _handle_ws_ack(self, data: dict) -> None:
        if self.ctx._session_pending or not self.ctx.session.session_id:
            return
        ack_data = data.get("data", data)
        try:
            last_seq = int(ack_data.get("last_seq"))
            if last_seq >= 0:
                await self.ctx.connection_manager.acknowledge(self.ctx.session.session_id, last_seq)
        except (TypeError, ValueError):
            pass

    async def _handle_chat_user_message(self, msg: ChatUserMessage) -> None:
        if not msg.text or not msg.text.strip():
            logger.warning("[WS] Received empty user message")
            return

        self.ctx._current_message_id = msg.message_id
        await self.ctx._ensure_session()
        session_id = msg.session_id or self.ctx.session.session_id
        trace_id = str(uuid.uuid4())

        async def send_callback(message):
            await self.ctx.outbound_sender.send_protocol_message(
                message, session_id, self.ctx._session_pending, self.ctx._connected
            )

        async def send_binary_callback(data: bytes):
            if self.ctx._connected:
                await self.ctx.outbound_sender.send_binary(data)

        async with self.ctx._turn_lock:
            await self.ctx.pipeline_bridge.cancel_pipeline()
            self.ctx.pipeline_bridge.pipeline_task = asyncio.create_task(
                self.ctx.pipeline.process_message(
                    message_id=msg.message_id,
                    text=msg.text,
                    session_id=session_id,
                    send_callback=send_callback,
                    send_binary_callback=send_binary_callback,
                    trace_id=trace_id,
                ),
                name=f"pipeline_message_{session_id}",
            )
            self.ctx.pipeline_bridge.pipeline_task.add_done_callback(_pipeline_task_done_callback)

    async def _handle_chat_abort(self, msg: ChatAbort) -> None:
        async with self.ctx._turn_lock:
            await self.ctx.pipeline_bridge.cancel_pipeline()
            await self.ctx.outbound_sender.send_protocol_message(
                make_pipeline_state(
                    self.ctx.session.session_id,
                    "idle",
                    getattr(self.ctx, "_current_message_id", None),
                ),
                self.ctx.session.session_id,
                self.ctx._session_pending,
                self.ctx._connected,
            )
