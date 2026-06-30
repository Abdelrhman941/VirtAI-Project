import asyncio

import pytest

from app.application.voice.handle_voice_turn import ConversationPipeline


@pytest.mark.asyncio
async def test_interrupt_during_tts_aborts_cleanly():
    messages = []

    async def send_callback(message) -> None:
        messages.append(message)

    pipeline = ConversationPipeline()

    # Mock LLM to push one sentence then block
    async def mock_llm_process(context):
        await context.sentence_queue.put("Hello world")
        try:
            await asyncio.sleep(10)
        except asyncio.CancelledError:
            raise

    pipeline.llm_stage.process = mock_llm_process

    # Mock TTS to block so we can interrupt it
    tts_started = asyncio.Event()
    tts_cancelled = False

    async def mock_tts_process(context):
        nonlocal tts_cancelled
        tts_started.set()
        try:
            await asyncio.sleep(10)
        except asyncio.CancelledError:
            tts_cancelled = True
            raise

    pipeline.tts_stage.process = mock_tts_process

    task = asyncio.create_task(
        pipeline.process_message(
            message_id="msg-1", text="hello", session_id="sess-1", send_callback=send_callback
        )
    )

    await asyncio.wait_for(tts_started.wait(), timeout=1.0)

    # Now abort
    pipeline.abort()

    # Wait for process_message to finish
    await task

    assert tts_cancelled is True

    # Check that repeated abort is safe
    pipeline.abort()

    # Ensure no warnings or leaked tasks
    current_task = asyncio.current_task()
    for t in asyncio.all_tasks():
        if t is not current_task and not t.done():
            assert "process_audio" not in getattr(t.get_coro(), "__qualname__", "")
            assert "mock_tts_process" not in getattr(t.get_coro(), "__qualname__", "")
