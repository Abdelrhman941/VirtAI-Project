from __future__ import annotations

import asyncio

import pytest

from app.application.voice.handle_voice_turn import ConversationPipeline


async def failing_llm_stage_process(context) -> None:
    raise RuntimeError("llm exploded before queue sentinel")


@pytest.mark.asyncio
async def test_pipeline_cancels_sibling_tasks_when_one_task_fails() -> None:
    messages = []

    async def send_callback(message) -> None:
        messages.append(message)

    pipeline = ConversationPipeline()
    pipeline.llm_stage.process = failing_llm_stage_process

    await pipeline.process_message(
        message_id="message-1",
        text="Hello",
        session_id="session-1",
        send_callback=send_callback,
    )
    await asyncio.sleep(0)

    current_task = asyncio.current_task()
    leaked_audio_tasks = [
        task
        for task in asyncio.all_tasks()
        if task is not current_task
        and not task.done()
        and getattr(task.get_coro(), "__qualname__", "").endswith("process_audio")
    ]

    for task in leaked_audio_tasks:
        task.cancel()
    if leaked_audio_tasks:
        await asyncio.gather(*leaked_audio_tasks, return_exceptions=True)

    assert leaked_audio_tasks == []
