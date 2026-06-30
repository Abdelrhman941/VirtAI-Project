"""
Text turn use case — handles text input through LLM → TTS pipeline (skips ASR).

Delegates to ConversationPipeline.process_text() and process_message().
"""

from __future__ import annotations

from collections.abc import AsyncGenerator, Callable

from app.application.voice.handle_voice_turn import ConversationPipeline
from app.domain.chat.entities import PipelineEvent


async def handle_text_turn(
    pipeline: ConversationPipeline,
    text: str,
    session_id: str | None = None,
) -> AsyncGenerator[PipelineEvent, None]:
    """
    Process direct text input through LLM → TTS (no ASR).

    Args:
        pipeline: Active ConversationPipeline for this session.
        text: User's text message.
        session_id: Optional session identifier for tracking.

    Yields:
        PipelineEvent objects (THINKING, LLM_TOKEN, TTS_AUDIO, etc.)
    """
    import asyncio

    queue: asyncio.Queue[PipelineEvent] = asyncio.Queue()

    async def send_callback(event: PipelineEvent) -> None:
        await queue.put(event)

    # Run the pipeline in the background
    task = asyncio.create_task(
        pipeline.process_message(
            message_id="direct_text_turn",
            text=text,
            session_id=session_id or "default",
            send_callback=send_callback,
        )
    )

    # Yield events as they arrive
    while not task.done() or not queue.empty():
        try:
            # Short timeout to allow checking task.done()
            event = await asyncio.wait_for(queue.get(), timeout=0.1)
            yield event
        except asyncio.TimeoutError:
            continue


from typing import Any


async def handle_message(
    pipeline: ConversationPipeline,
    message_id: str,
    text: str,
    session_id: str,
    send_callback: Callable[[Any], Any],
) -> None:
    """
    Process user message through LLM → TTS → Visemes with callback-based delivery.

    Args:
        pipeline: Active ConversationPipeline for this session.
        message_id: Unique message identifier.
        text: User's text message.
        session_id: Session identifier.
        send_callback: Async callback to send messages to client.
    """
    await pipeline.process_message(
        message_id=message_id,
        text=text,
        session_id=session_id,
        send_callback=send_callback,
    )
