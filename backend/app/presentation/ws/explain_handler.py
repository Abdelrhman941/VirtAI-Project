import asyncio
import json
from typing import Optional

from fastapi import WebSocket, WebSocketDisconnect
from loguru import logger

from app.application.chat.chat_use_case import ChatUseCase
from app.application.explain.explain_use_case import ExplainUseCase

# Keywords that signal the user wants to continue/resume the current presentation
# rather than ask a new question that would warrant canceling the active task.
_CONTINUE_KEYWORDS = frozenset(
    [
        "continue",
        "next",
        "go on",
        "proceed",
        "keep going",
        "next slide",
        "show next",
    ]
)


def _is_resume_intent(text: str) -> bool:
    """
    Return True when the message is a "continue/resume" request, False when it
    is a genuine new question that should cancel the active task.

    Classification strategy: keyword-based heuristic that errs on the side of
    NOT canceling (safer for the user experience).  A short message that
    contains only one of the resume keywords is treated as a resume request.
    Any message longer than 60 characters or containing a question mark is
    treated as a new question regardless of keywords.
    """
    stripped = text.strip().lower()
    if len(stripped) > 60:
        return False
    if "?" in stripped:
        return False
    for kw in _CONTINUE_KEYWORDS:
        if kw in stripped:
            return True
    return False


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
                try:
                    text = await self.websocket.receive_text()
                except WebSocketDisconnect:
                    logger.info("Explain websocket disconnected.")
                    break

                try:
                    data = json.loads(text)
                    payload_type = data.get("type")
                    if payload_type == "chat.user_message" or payload_type == "client.speech_stopped":
                        await self._handle_interruption(data)
                except json.JSONDecodeError:
                    pass
        finally:
            if self._main_task and not self._main_task.done():
                self._main_task.cancel()
                try:
                    await self._main_task
                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    logger.error(f"Error during _main_task cancellation: {e}")


    async def _start_presentation(self):
        try:
            async for event in self.explain_use_case.start_or_resume(
                self.user_id, self.document_id
            ):
                try:
                    await self.websocket.send_json(event)
                except (RuntimeError, asyncio.exceptions.IncompleteReadError) as e:
                    logger.warning(f"[WS] Dead socket write attempt: {e}")
                    return
        except asyncio.CancelledError:
            try:
                await self.explain_use_case.db.rollback()
            except Exception:
                pass
        except Exception as e:
            logger.error(f"Error in _start_presentation: {e}")
            try:
                await self.explain_use_case.db.rollback()
            except Exception:
                pass

    async def _handle_interruption(self, data: dict):
        user_text = data.get("text", "")
        # Fallback to nested data just in case
        if not user_text and isinstance(data.get("data"), dict):
            user_text = data.get("data", {}).get("text", "")

        # B2 fix: classify intent BEFORE deciding whether to cancel.
        # "continue/resume" → do NOT cancel; let handle_user_input advance the slide.
        # "new question"    → cancel the active task, then process as a question.
        if _is_resume_intent(user_text):
            logger.info(
                f"[ExplainHandler] Resume intent detected for text={user_text!r}. "
                "Not canceling _main_task."
            )
            # Do NOT cancel _main_task — just delegate to handle_user_input which
            # will advance the slide index and call start_or_resume internally.
        else:
            logger.info(
                f"[ExplainHandler] New-question intent detected for text={user_text!r}. "
                "Canceling _main_task."
            )
            if self._main_task and not self._main_task.done():
                self._main_task.cancel()
                try:
                    await self._main_task
                except asyncio.CancelledError:
                    pass

        async def _process_input():
            try:
                async for event in self.explain_use_case.handle_user_input(
                    self.user_id, self.document_id, user_text
                ):
                    try:
                        await self.websocket.send_json(event)
                    except (RuntimeError, asyncio.exceptions.IncompleteReadError) as e:
                        logger.warning(f"[WS] Dead socket write attempt: {e}")
                        return
            except asyncio.CancelledError:
                try:
                    await self.explain_use_case.db.rollback()
                except Exception:
                    pass
            except Exception as e:
                logger.error(f"Error in handle_user_input: {e}")
                try:
                    await self.explain_use_case.db.rollback()
                except Exception:
                    pass

        self._main_task = asyncio.create_task(_process_input())
