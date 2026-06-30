from __future__ import annotations

import os
from uuid import uuid4

import httpx
import pytest

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        os.getenv("RUN_AUTH_INTEGRATION_TESTS") != "1",
        reason="Set RUN_AUTH_INTEGRATION_TESTS=1 with real PostgreSQL and Redis services.",
    ),
]


@pytest.fixture
async def client():
    from app.main import app

    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as c:
            yield c


def _csrf_headers(client: httpx.AsyncClient) -> dict[str, str]:
    token = client.cookies.get("csrf_token")
    assert token
    return {"x-csrf-token": token}


@pytest.mark.asyncio
async def test_signup_refresh_replay_logout_cookie_cleanup(client: httpx.AsyncClient) -> None:
    email = f"auth-it-{uuid4().hex}@example.com"
    signup = await client.post(
        "/api/v1/auth/signup",
        json={"full_name": "Auth IT", "email": email, "password": "Str0ng-password!"},
    )
    assert signup.status_code == 201, signup.text
    assert signup.json()["access_token"]
    first_refresh = client.cookies.get("refresh_token")
    assert first_refresh

    refresh = await client.post("/api/v1/auth/refresh", headers=_csrf_headers(client))
    assert refresh.status_code == 200, refresh.text
    second_refresh = client.cookies.get("refresh_token")
    assert second_refresh and second_refresh != first_refresh

    client.cookies.set("refresh_token", first_refresh, path="/api/v1/auth")
    replay = await client.post("/api/v1/auth/refresh", headers=_csrf_headers(client))
    assert replay.status_code == 401
    assert client.cookies.get("refresh_token") in (None, "")


@pytest.mark.asyncio
async def test_refresh_requires_csrf(client: httpx.AsyncClient) -> None:
    email = f"csrf-it-{uuid4().hex}@example.com"
    signup = await client.post(
        "/api/v1/auth/signup",
        json={"full_name": "CSRF IT", "email": email, "password": "Str0ng-password!"},
    )
    assert signup.status_code == 201, signup.text

    blocked = await client.post("/api/v1/auth/refresh")
    assert blocked.status_code == 403
