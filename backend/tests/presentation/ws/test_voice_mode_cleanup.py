from __future__ import annotations

import sys
from types import SimpleNamespace

import pytest
from starlette.websockets import WebSocketState

from app.presentation.ws.gateway import WebSocketHandler


class FakePipelineBridge:
    def __init__(self) -> None:
        self.cancelled = False

    async def cancel_pipeline(self) -> None:
        self.cancelled = True


class FakeAudioPipeline:
    def __init__(self) -> None:
        self.cleared = False

    def clear_buffer(self) -> None:
        self.cleared = True


class FakeVoiceModeHandler:
    def __init__(self) -> None:
        self.audio_pipeline = FakeAudioPipeline()
        self.shutdown_called = False

    async def shutdown(self) -> None:
        self.shutdown_called = True


class FakeWebSocket:
    client_state = WebSocketState.DISCONNECTED


class FakeGauge:
    def dec(self) -> None:
        return None


@pytest.mark.asyncio
async def test_cleanup_awaits_voice_mode_shutdown(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(
        sys.modules,
        "app.shared.metrics",
        SimpleNamespace(ws_connections_active=FakeGauge()),
    )

    handler = WebSocketHandler.__new__(WebSocketHandler)
    handler._connected = True
    handler._heartbeat_task = None
    handler.pipeline_bridge = FakePipelineBridge()
    handler._voice_mode_handler = FakeVoiceModeHandler()
    handler.session = None
    handler.ws = FakeWebSocket()
    handler.protocol_router = SimpleNamespace(cleanup=lambda: None)

    from app.presentation.ws.connection_lifecycle import ConnectionLifecycle

    handler.connection_lifecycle = ConnectionLifecycle(handler)

    await handler.connection_lifecycle.cleanup()

    assert handler._voice_mode_handler.shutdown_called is True
    assert handler.pipeline_bridge.cancelled is True
    assert handler._connected is False
