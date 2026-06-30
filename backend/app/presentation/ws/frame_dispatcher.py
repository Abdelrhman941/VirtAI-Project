import time
from typing import TYPE_CHECKING

from loguru import logger

if TYPE_CHECKING:
    from app.presentation.ws.gateway import WebSocketHandler


class FrameDispatcher:
    def __init__(self, handler: "WebSocketHandler"):
        self.handler = handler

    async def close_for_message_too_large(self, size: int, max_size: int, frame_type: str) -> None:
        await self.handler.outbound_sender.safe_send_error(
            code="MESSAGE_TOO_LARGE",
            message=f"WebSocket frame exceeds max size ({max_size} bytes)",
            session_id=self.handler.session.session_id,
            session_pending=self.handler._session_pending,
            connected=self.handler._connected,
        )
        try:
            await self.handler.ws.close(code=1009)
        except Exception:
            pass
        self.handler._connected = False

    async def handle_binary_frame(self, pcm_bytes: bytes) -> None:
        try:
            self.handler.session.touch()
            self.handler._last_pong_time = time.time()

            voice_handler = await self.handler._get_voice_mode_handler()

            is_final = False
            # Deterministic binary frame format:
            # - If length is odd, the last byte is the marker (0x00=continue, 0x01=final)
            # - If length is even, there is no marker (legacy/raw PCM from frontend)
            if len(pcm_bytes) % 2 != 0 and len(pcm_bytes) > 0:
                marker = pcm_bytes[-1]
                pcm_data = pcm_bytes[:-1]
                if marker in (0x00, 0x01):
                    is_final = marker == 0x01
                else:
                    pcm_data = pcm_bytes
            else:
                pcm_data = pcm_bytes

            await voice_handler.handle_audio_chunk(pcm_data, is_final=is_final)

        except Exception as e:
            logger.error(f"[WS] Error handling binary frame: {e}")
            await self.handler.outbound_sender.safe_send_error(
                code="BINARY_FRAME_ERROR",
                message="Error processing audio data",
                session_id=self.handler.session.session_id,
                session_pending=self.handler._session_pending,
                connected=self.handler._connected,
            )
