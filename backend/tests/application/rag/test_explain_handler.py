import asyncio
from unittest.mock import MagicMock

import pytest

from app.application.explain.explain_use_case import ExplainUseCase
from app.presentation.ws.explain_handler import ExplainHandler


@pytest.mark.asyncio
async def test_explain_handler_interruption(monkeypatch):
    monkeypatch.setattr("app.application.explain.explain_use_case.get_redis", MagicMock())

    class MockWS:
        def __init__(self):
            self.call_args_list = []
            self.receive_text_call_count = 0

        async def send_json(self, data):
            self.call_args_list.append(((data,), {}))

        async def receive_text(self):
            self.receive_text_call_count += 1
            if self.receive_text_call_count == 1:
                await asyncio.sleep(0.05)
                return '{"type": "chat.user_message", "data": {"text": "what does it mean?"}}'
            await asyncio.sleep(10.0)

    mock_ws = MockWS()
    mock_db = MagicMock()
    mock_chat_use_case = MagicMock()

    # We mock the entire ExplainUseCase execute functions
    async def mock_start_or_resume(self, user_id, document_id):
        yield {"type": "SlideStartEvent", "slide_index": 0}
        await asyncio.sleep(0.01)
        yield {"type": "AwaitInputEvent"}

    async def mock_handle_user_input(self, user_id, document_id, text):
        yield {"type": "SlideContentTokens", "tokens": "mock answer"}
        yield {"type": "AwaitInputEvent"}

    monkeypatch.setattr(ExplainUseCase, "start_or_resume", mock_start_or_resume)
    monkeypatch.setattr(ExplainUseCase, "handle_user_input", mock_handle_user_input)

    handler = ExplainHandler(
        mock_ws, "00000000-0000-0000-0000-000000000000", mock_db, "user", mock_chat_use_case
    )

    run_task = asyncio.create_task(handler.run())

    await asyncio.sleep(0.2)  # Let the handler process the message
    run_task.cancel()

    # Verify sent events
    sent_messages = [c[0][0] for c in mock_ws.call_args_list]

    has_slide_start = any(msg.get("type") == "SlideStartEvent" for msg in sent_messages)
    has_mock_answer = any(
        msg.get("type") == "SlideContentTokens" and msg.get("tokens") == "mock answer"
        for msg in sent_messages
    )

    assert has_slide_start
    assert has_mock_answer


@pytest.mark.asyncio
async def test_explain_handler_continue(monkeypatch):
    monkeypatch.setattr("app.application.explain.explain_use_case.get_redis", MagicMock())

    class MockWS:
        def __init__(self):
            self.call_args_list = []
            self.receive_text_call_count = 0

        async def send_json(self, data):
            self.call_args_list.append(((data,), {}))

        async def receive_text(self):
            self.receive_text_call_count += 1
            if self.receive_text_call_count == 1:
                await asyncio.sleep(0.05)
                return '{"type": "chat.user_message", "data": {"text": "continue to next slide"}}'
            await asyncio.sleep(10.0)

    mock_ws = MockWS()
    mock_db = MagicMock()
    mock_chat_use_case = MagicMock()

    async def mock_start_or_resume(self, user_id, document_id):
        yield {"type": "SlideStartEvent", "slide_index": 0}
        await asyncio.sleep(0.5)

    async def mock_handle_user_input(self, user_id, document_id, text):
        # In real code, 'continue' triggers start_or_resume inside UseCase
        # Since we mock it, we just yield the events that UseCase would yield
        yield {"type": "SlideStartEvent", "slide_index": 1}
        yield {"type": "AwaitInputEvent"}

    monkeypatch.setattr(ExplainUseCase, "start_or_resume", mock_start_or_resume)
    monkeypatch.setattr(ExplainUseCase, "handle_user_input", mock_handle_user_input)

    handler = ExplainHandler(
        mock_ws, "00000000-0000-0000-0000-000000000000", mock_db, "user", mock_chat_use_case
    )

    run_task = asyncio.create_task(handler.run())

    await asyncio.sleep(0.1)  # Let the handler process the message
    run_task.cancel()

    sent_messages = [c[0][0] for c in mock_ws.call_args_list]
    has_slide_start_1 = any(
        msg.get("type") == "SlideStartEvent" and msg.get("slide_index") == 1
        for msg in sent_messages
    )

    assert has_slide_start_1
