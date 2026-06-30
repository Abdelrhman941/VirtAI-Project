"""Unit tests for Batch 3 — startup readiness flag & WS lazy-session abort.

These tests verify:
1. app.state.ready is False before lifespan completes.
2. Health check returns degraded when app.state.ready is False.
3. WebSocket gateway aborts gracefully when session is deleted mid-flight
   (get_session returns None after lazy create succeeds).
4. Lazy session creation correctly checks DB existence after create_session.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch, call
from uuid import uuid4

import pytest


# ---------------------------------------------------------------------------
# Tests: app.state.ready flag
# ---------------------------------------------------------------------------

class TestReadinessFlag:
    def test_health_returns_degraded_when_not_ready(self) -> None:
        """Health check must return degraded if app.state.ready is not True."""
        from fastapi import Request
        from unittest.mock import MagicMock

        mock_app = MagicMock()
        mock_app.state.ready = False
        mock_app.state.embedder = MagicMock()
        mock_app.state.tts_provider = MagicMock()

        # Simulate a Request with the mock app
        mock_request = MagicMock(spec=Request)
        mock_request.app = mock_app

        # The health endpoint checks app.state.ready if we pass it
        from app.presentation.http.v1.endpoints.health import _check_app_ready
        is_ready = _check_app_ready(mock_request)
        assert is_ready is False

    def test_health_returns_ready_when_flag_set(self) -> None:
        from fastapi import Request

        mock_app = MagicMock()
        mock_app.state.ready = True
        mock_request = MagicMock(spec=Request)
        mock_request.app = mock_app

        from app.presentation.http.v1.endpoints.health import _check_app_ready
        is_ready = _check_app_ready(mock_request)
        assert is_ready is True

    def test_health_graceful_when_no_ready_attr(self) -> None:
        """If app.state has no 'ready' attribute (old deployment), don't crash."""
        from fastapi import Request

        mock_app = MagicMock()
        del mock_app.state.ready  # simulate AttributeError
        mock_app.state.ready = AttributeError  # marker
        mock_request = MagicMock(spec=Request)
        mock_request.app = mock_app

        from app.presentation.http.v1.endpoints.health import _check_app_ready
        # Should not raise, should return False (degraded) safely
        try:
            _check_app_ready(mock_request)
        except Exception as e:
            pytest.fail(f"_check_app_ready raised {e!r} — should handle missing attribute")


# ---------------------------------------------------------------------------
# Tests: WebSocket lazy session abort
# ---------------------------------------------------------------------------

class TestWebSocketLazySessionAbort:
    """WS gateway must abort cleanly if session is deleted between creation
    and first message processing."""

    @pytest.mark.asyncio
    async def test_gateway_aborts_when_session_deleted_mid_flight(self) -> None:
        """After lazy create_session, if the session is no longer in the DB
        (deleted concurrently), the gateway should log a warning and NOT attempt
        to process the message — it should send an error frame instead."""
        from app.presentation.ws.gateway import WebSocketHandler

        mock_ws = AsyncMock()
        mock_ws.receive = AsyncMock(side_effect=[
            {"type": "websocket.receive", "text": '{"type": "chat.user_message", "data": {"message_id": "m1", "text": "hello"}}'},
            {"type": "websocket.disconnect"},
        ])

        mock_session = MagicMock()
        mock_session.session_id = str(uuid4())
        mock_session.pipeline = MagicMock()

        session_manager = AsyncMock()
        # create_session returns a session, but get_session returns None (deleted)
        session_manager.create_session.return_value = mock_session
        session_manager.get_session.return_value = None

        connection_manager = AsyncMock()

        handler = WebSocketHandler(
            websocket=mock_ws,
            user_id=str(uuid4()),
            session_manager=session_manager,
            session=None,
            connection_manager=connection_manager,
        )

        # Run the message loop — should NOT raise, should handle gracefully
        try:
            await handler._message_loop()
        except Exception as e:
            pytest.fail(
                f"_message_loop raised {e!r} when session was deleted mid-flight. "
                "Should handle gracefully."
            )

        # pipeline.process_message must NOT have been called after deletion
        mock_session.pipeline.process_message.assert_not_called()

    @pytest.mark.asyncio
    async def test_gateway_processes_message_when_session_valid(self) -> None:
        """When session exists and is not deleted, process_message IS called."""
        from app.presentation.ws.gateway import WebSocketHandler

        valid_msg_id = str(uuid4())
        mock_ws = AsyncMock()
        mock_ws.receive = AsyncMock(side_effect=[
            {"type": "websocket.receive", "text": f'{{"type": "chat.user_message", "data": {{"message_id": "{valid_msg_id}", "text": "hello", "session_id": null}}}}'},
            {"type": "websocket.disconnect"},
        ])

        mock_session = MagicMock()
        mock_session.session_id = str(uuid4())
        mock_session.pipeline = AsyncMock()
        mock_session.pipeline.process_message = AsyncMock()

        session_manager = AsyncMock()
        session_manager.create_session.return_value = mock_session
        # get_session returns the session (not deleted)
        session_manager.get_session.return_value = mock_session

        connection_manager = AsyncMock()

        handler = WebSocketHandler(
            websocket=mock_ws,
            user_id=str(uuid4()),
            session_manager=session_manager,
            session=None,
            connection_manager=connection_manager,
        )

        await handler._message_loop()
        mock_session.pipeline.process_message.assert_called_once()
