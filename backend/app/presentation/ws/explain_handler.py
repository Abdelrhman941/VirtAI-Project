import asyncio
import json
from typing import Optional

from fastapi import WebSocket, WebSocketDisconnect
from loguru import logger

from app.application.chat.chat_use_case import ChatUseCase
from app.application.explain.explain_use_case import ExplainUseCase


class ExplainHandler:
    def __init__(
        self, websocket: WebSocket, document_id: str, db, user_id: str, chat_use_case: ChatUseCase
    ):
        self.websocket = websocket
        self.document_id = document_id
        self.user_id = user_id
        self.explain_use_case = ExplainUseCase(db=db, chat_use_case=chat_use_case)
        self._main_task: Optional[asyncio.Task] = None

    async def run(self):
        # Start the presentation
        self._main_task = asyncio.create_task(self._start_presentation())

        try:
            while True:
                raw = await self.websocket.receive_text()
                try:
                    data = json.loads(raw)
                    msg_type = data.get("type")
                    if msg_type == "chat.user_message" or msg_type == "client.speech_stopped":
                        await self._handle_interruption(data)
                except json.JSONDecodeError:
                    pass
        except WebSocketDisconnect:
            logger.info("Explain websocket disconnected.")
        finally:
            if self._main_task and not self._main_task.done():
                self._main_task.cancel()

    async def _start_presentation(self):
        try:
            async for event in self.explain_use_case.start_or_resume(
                self.user_id, self.document_id
            ):
                await self.websocket.send_json(event)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in _start_presentation: {e}")
            import traceback
            traceback.print_exc()
            try:
                await self.websocket.send_json({"type": "error", "message": str(e)})
            except Exception:
                pass

    async def _handle_interruption(self, data: dict):
        if self._main_task and not self._main_task.done():
            self._main_task.cancel()
            try:
                await self._main_task
            except asyncio.CancelledError:
                pass

        user_text = data.get("text", "")
        # Fallback to nested data just in case
        if not user_text and isinstance(data.get("data"), dict):
            user_text = data.get("data", {}).get("text", "")

        async def _process_input():
            try:
                async for event in self.explain_use_case.handle_user_input(
                    self.user_id, self.document_id, user_text
                ):
                    await self.websocket.send_json(event)
            except asyncio.CancelledError:
                pass
            except Exception as e:
                logger.error(f"Error in handle_user_input: {e}")
                import traceback
                traceback.print_exc()
                try:
                    await self.websocket.send_json({"type": "error", "message": str(e)})
                except Exception:
                    pass

        self._main_task = asyncio.create_task(_process_input())
