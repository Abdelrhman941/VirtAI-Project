"""
Tests for WebSocket router lazy-session logic.

Updated to match the current auth flow: the router reads the token from
WebSocket subprotocols (not a query/kwarg parameter). Tests mock token decoding
and user lookup at the module level in router.py to bypass cryptographic checks.
"""

from __future__ import annotations

from collections.abc import Iterable
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import WebSocket
from starlette.datastructures import Address, Headers

from app.presentation.http.v1 import router as v1_router
from app.presentation.ws.connection_manager import WSConnectionManager

MOCK_TOKEN = "valid.mock.token"
MOCK_USER_ID = str(uuid4())
MOCK_SESSION_ID = str(uuid4())


class _FakeWebSocket(WebSocket):
    """Simulates a WebSocket that carries the auth token in subprotocols."""

    def __init__(self, token: str = MOCK_TOKEN) -> None:
        self.accepted = False
        self.closed = False
        self._token = token

    @property
    def client(self) -> Address:
        return Address("127.0.0.1", 1234)

    @property
    def headers(self) -> Headers:
        return Headers({})

    @property
    def scope(self):
        return {"subprotocols": ["access_token", self._token]}

    @property
    def application_state(self):
        from starlette.websockets import WebSocketState
        return WebSocketState.CONNECTED

    @property
    def client_state(self):
        from starlette.websockets import WebSocketState
        return WebSocketState.CONNECTED

    async def accept(
        self, subprotocol: str | None = None, headers: Iterable[tuple[bytes, bytes]] | None = None
    ) -> None:
        self.accepted = True

    async def close(self, code: int = 1000, reason: str | None = None) -> None:
        self.closed = True

    async def receive_text(self) -> str:
        return '{"type": "auth", "token": "valid.mock.token"}'

    async def receive_json(self) -> dict:
        return {"type": "auth", "token": "valid.mock.token"}

    async def _receive(self) -> dict:
        return {"type": "websocket.receive", "text": '{"type": "auth", "token": "valid.mock.token"}'}


class _FakeSessionManager:
    def __init__(self) -> None:
        self.create_session_calls = 0
        self.disconnect_calls: list[str] = []

    async def connect_existing_session(self, session_id: str):
        return None

    async def create_session(self, **kwargs):
        self.create_session_calls += 1
        return SimpleNamespace(session_id="created-session", avatar_id="avatar1")

    async def disconnect_session(self, session_id: str) -> None:
        self.disconnect_calls.append(session_id)


class _FakeConnectionManager(WSConnectionManager):
    def __init__(self) -> None:
        super().__init__()
        self.unregister_calls: list[str] = []

    async def unregister(self, session_id: str, websocket) -> None:
        self.unregister_calls.append(session_id)


def _mock_decode_token(token: str, expected_type: str = "access"):
    return SimpleNamespace(user_id=MOCK_USER_ID, jti="mock-jti", token_version=0, family_id=None)


async def _mock_get_user_by_id(*args, **kwargs):
    return SimpleNamespace(id=MOCK_USER_ID, is_active=True, refresh_token_version=0)


async def _not_blacklisted(*args, **kwargs) -> bool:
    return False


async def _allow_rate_limit(**kwargs) -> bool:
    return True


@pytest.mark.asyncio
async def test_ws_does_not_create_session_on_connect_when_not_resuming(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_ws = _FakeWebSocket()
    fake_sm = _FakeSessionManager()
    fake_cm = _FakeConnectionManager()
    created_handler = {}

    class FakeHandler:
        def __init__(self, **kwargs):
            created_handler["session"] = kwargs["session"]
            created_handler["requested_session_id"] = kwargs.get("requested_session_id")
            self.session = kwargs["session"] or SimpleNamespace(session_id="")

        async def run(self):
            return None

    monkeypatch.setattr(v1_router, "check_rate_limit", _allow_rate_limit)
    monkeypatch.setattr(v1_router, "decode_auth_token", _mock_decode_token)
    monkeypatch.setattr(v1_router, "is_blacklisted", _not_blacklisted)
    monkeypatch.setattr(v1_router, "get_user_by_id", _mock_get_user_by_id)
    monkeypatch.setattr(v1_router, "WebSocketHandler", FakeHandler)

    await v1_router.websocket_endpoint(
        websocket=fake_ws,
        avatar_id="avatar1",
        voice="en-US-AriaNeural",
        session_id=None,
        resume=False,
        last_seq=0,
        session_manager=fake_sm,
        connection_manager=fake_cm,
        db=object(),
    )

    assert fake_ws.accepted is True
    assert created_handler["session"] is None
    assert created_handler["requested_session_id"] is None
    assert fake_sm.create_session_calls == 0
    assert fake_cm.unregister_calls == []
    assert fake_sm.disconnect_calls == []


@pytest.mark.asyncio
async def test_ws_resume_uses_existing_session(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_ws = _FakeWebSocket()
    fake_sm = _FakeSessionManager()
    fake_cm = _FakeConnectionManager()
    resumed_session = SimpleNamespace(
        session_id=MOCK_SESSION_ID,
        avatar_id="avatar1",
        user_id=MOCK_USER_ID,
    )
    created_handler = {}

    async def _connect_existing(session_id: str, **kwargs):
        return resumed_session if session_id == MOCK_SESSION_ID else None

    class FakeHandler:
        def __init__(self, **kwargs):
            created_handler["session"] = kwargs["session"]
            created_handler["requested_session_id"] = kwargs.get("requested_session_id")
            self.session = kwargs["session"] or SimpleNamespace(session_id="")

        async def run(self):
            return None

    monkeypatch.setattr(v1_router, "check_rate_limit", _allow_rate_limit)
    monkeypatch.setattr(v1_router, "decode_auth_token", _mock_decode_token)
    monkeypatch.setattr(v1_router, "is_blacklisted", _not_blacklisted)
    monkeypatch.setattr(v1_router, "get_user_by_id", _mock_get_user_by_id)
    monkeypatch.setattr(v1_router, "WebSocketHandler", FakeHandler)
    monkeypatch.setattr(fake_sm, "connect_existing_session", _connect_existing)

    await v1_router.websocket_endpoint(
        websocket=fake_ws,
        avatar_id="avatar1",
        voice="en-US-AriaNeural",
        session_id=MOCK_SESSION_ID,
        resume=True,
        last_seq=2,
        session_manager=fake_sm,
        connection_manager=fake_cm,
        db=object(),
    )

    assert fake_ws.accepted is True
    assert created_handler["session"] is resumed_session
    assert created_handler["requested_session_id"] is None
    assert fake_sm.create_session_calls == 0
    assert fake_cm.unregister_calls == [MOCK_SESSION_ID]
    assert fake_sm.disconnect_calls == [MOCK_SESSION_ID]


@pytest.mark.asyncio
async def test_ws_non_resume_forwards_requested_session_id(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_ws = _FakeWebSocket()
    fake_sm = _FakeSessionManager()
    fake_cm = _FakeConnectionManager()
    created_handler = {}

    class FakeHandler:
        def __init__(self, **kwargs):
            created_handler["requested_session_id"] = kwargs.get("requested_session_id")
            self.session = kwargs["session"] or SimpleNamespace(session_id="")

        async def run(self):
            return None

    monkeypatch.setattr(v1_router, "check_rate_limit", _allow_rate_limit)
    monkeypatch.setattr(v1_router, "decode_auth_token", _mock_decode_token)
    monkeypatch.setattr(v1_router, "is_blacklisted", _not_blacklisted)
    monkeypatch.setattr(v1_router, "get_user_by_id", _mock_get_user_by_id)
    monkeypatch.setattr(v1_router, "WebSocketHandler", FakeHandler)

    await v1_router.websocket_endpoint(
        websocket=fake_ws,
        avatar_id="avatar1",
        voice="en-US-AriaNeural",
        session_id=MOCK_SESSION_ID,
        resume=False,
        last_seq=0,
        session_manager=fake_sm,
        connection_manager=fake_cm,
        db=object(),
    )

    assert fake_ws.accepted is True
    assert created_handler["requested_session_id"] == MOCK_SESSION_ID
