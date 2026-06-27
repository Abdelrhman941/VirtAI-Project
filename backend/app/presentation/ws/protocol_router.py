import asyncio
import json
import time
import uuid

from loguru import logger
from app.presentation.ws.ws_schemas import IncomingWSMessage
from pydantic import TypeAdapter, ValidationError
from app.schemas.ws_messages import (
    ChatAbort,
    ChatUserMessage,
    ClientSpeechStopped,
    WSMessageEnvelope,
    make_pipeline_state,
)
from app.presentation.ws.pipeline_bridge import _pipeline_task_done_callback

incoming_msg_adapter = TypeAdapter(IncomingWSMessage)

RATE_LIMIT_WINDOW_SECONDS = 10.0
RATE_LIMIT_MAX_MESSAGES = 1000

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
        self._message_timestamps: list[float] = []

    def _check_rate_limit(self) -> bool:
        now = time.time()
        # Clean up old timestamps
        self._message_timestamps = [t for t in self._message_timestamps if now - t < RATE_LIMIT_WINDOW_SECONDS]
        if len(self._message_timestamps) >= RATE_LIMIT_MAX_MESSAGES:
            return False
        self._message_timestamps.append(now)
        return True

    def cleanup(self) -> None:
        """Clear rate limiter state on disconnect to avoid memory leaks."""
        self._message_timestamps.clear()

    async def route_message(self, raw: str) -> None:
        if not self._check_rate_limit():
            await self.ctx.outbound_sender.safe_send_error(
                code="RATE_LIMITED",
                message="Rate limit exceeded. Please wait.",
                session_id=None,
                session_pending=self.ctx._session_pending,
                connected=self.ctx._connected,
            )
            return

        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            logger.warning(f"Invalid JSON: {raw[:100]} | {e}")
            await self.ctx.outbound_sender.safe_send_error(
                code="INVALID_PAYLOAD",
                message="Invalid JSON format",
                session_id=None,
                session_pending=self.ctx._session_pending,
                connected=self.ctx._connected,
            )
            return

        if not isinstance(data, dict):
            await self.ctx.outbound_sender.safe_send_error(
                code="INVALID_PAYLOAD",
                message="Message must be a JSON object",
                session_id=None,
                session_pending=self.ctx._session_pending,
                connected=self.ctx._connected,
            )
            return

        msg_type_str = data.get("type", "")
        if not msg_type_str:
            await self.ctx.outbound_sender.safe_send_error(
                code="INVALID_PAYLOAD",
                message="Message missing 'type' field",
                session_id=None,
                session_pending=self.ctx._session_pending,
                connected=self.ctx._connected,
            )
            return

        # Map "text" to "chat.user_message" for frontend compatibility BEFORE validation
        if msg_type_str == "text":
            msg_type_str = "chat.user_message"
            data["type"] = "chat.user_message"

        try:
            validated_msg = incoming_msg_adapter.validate_python(data)
        except ValidationError as e:
            logger.warning(f"Validation error: {e}")
            await self.ctx.outbound_sender.safe_send_error(
                code="INVALID_PAYLOAD",
                message=f"Message validation failed: {e!s}",
                session_id=None,
                session_pending=self.ctx._session_pending,
                connected=self.ctx._connected,
            )
            return

        msg_type = validated_msg.type

        if msg_type == "session_restore":
            await self.ctx.session_bootstrap.handle_session_restore(validated_msg.session_id, self.ctx)
            return

        if msg_type == "session_new":
            await self.ctx.session_bootstrap.handle_session_new(self.ctx)
            return

        if msg_type == "ping":
            self.ctx.session.touch()
            self.ctx._last_pong_time = time.time()
            await self.ctx.ws.send_json({"type": "pong"})
            return

        self.ctx.session.touch()
        self.ctx._last_pong_time = time.time()

        if msg_type == "ws.ack":
            await self._handle_ws_ack(validated_msg.data)
            return

        if msg_type == "chat.user_message":
            # Map back to old ChatUserMessage for the handler
            old_msg = ChatUserMessage(
                text=validated_msg.text,
                message_id=validated_msg.message_id or str(uuid.uuid4()),
                session_id=validated_msg.session_id
            )
            await self._handle_chat_user_message(old_msg)
            return

        if msg_type == "chat.abort":
            old_abort = ChatAbort(
                message_id=validated_msg.message_id,
                session_id=validated_msg.session_id
            )
            await self._handle_chat_abort(old_abort)
            return

        if msg_type == "client.speech_stopped":
            await self._handle_voice_mode_stop(None)
            return
        
        # We shouldn't reach here if type is validated
        await self.ctx.outbound_sender.safe_send_error(
            code="INVALID_PAYLOAD",
            message=f"Unknown message type: {msg_type}",
            session_id=None,
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

    async def _handle_ws_ack(self, data: dict | None) -> None:
        if self.ctx._session_pending or not self.ctx.session.session_id:
            return
        if not data:
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
                    user_id=getattr(self.ctx, "_user_id", None),
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
