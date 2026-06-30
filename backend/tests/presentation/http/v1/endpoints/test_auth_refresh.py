from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi import Response
from jose import jwt
from starlette.requests import Request

from app.domain.user.entities import UserEntity
from app.domain.user.ports import UserRepositoryPort
from app.presentation.http.v1.endpoints import auth as auth_endpoint
from app.shared.config import Environment, get_settings
from app.shared.errors import InvalidUserIdError, RevokedTokenError


def _build_request() -> Request:
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/auth/refresh",
        "headers": [],
        "client": ("127.0.0.1", 8080),
    }
    return Request(scope)


class MockUserRepository(UserRepositoryPort):
    async def get_by_id(self, user_id: UUID) -> UserEntity | None:
        return None

    async def get_by_email(self, email: str) -> UserEntity | None:
        return None

    async def get_by_google_id(self, google_id: str) -> UserEntity | None:
        return None

    async def create(self, user: UserEntity) -> UserEntity:
        return user

    async def update(self, user: UserEntity) -> UserEntity:
        return user

    async def increment_refresh_token_version(
        self, user_id: UUID, expected_version: int
    ) -> UserEntity | None:
        return None

    async def force_increment_refresh_token_version(self, user_id: UUID) -> UserEntity | None:
        return None


@pytest.mark.asyncio
async def test_refresh_reissues_refresh_cookie(monkeypatch: pytest.MonkeyPatch) -> None:
    user_id = uuid4()

    async def _noop_rate_limit(*args, **kwargs) -> None:
        return None

    async def _not_blacklisted(*args, **kwargs) -> bool:
        return False

    async def _active_user(*args, **kwargs):
        return SimpleNamespace(id=user_id, is_active=True, refresh_token_version=0)

    async def _rotated_user(*args, **kwargs):
        return SimpleNamespace(id=user_id, is_active=True, refresh_token_version=1)

    async def _noop_blacklist(*args, **kwargs) -> None:
        return None

    async def _not_consumed(*args, **kwargs) -> bool:
        return False

    async def _lock(*args, **kwargs) -> str:
        return "lock-token"

    monkeypatch.setattr(auth_endpoint, "_assert_rate_limit_refresh", _noop_rate_limit)
    monkeypatch.setattr(
        auth_endpoint,
        "decode_auth_token",
        lambda *args, **kwargs: SimpleNamespace(
            user_id=user_id,
            jti="jti-1" if args and args[0] == "old-refresh-token" else "jti-2",
            token_version=0,
            family_id=uuid4(),
        ),
    )
    monkeypatch.setattr(auth_endpoint, "is_blacklisted", _not_blacklisted)
    monkeypatch.setattr(auth_endpoint, "is_refresh_family_revoked", _not_blacklisted)
    monkeypatch.setattr(auth_endpoint, "is_refresh_jti_consumed", _not_consumed)
    monkeypatch.setattr(auth_endpoint, "acquire_refresh_rotation_lock", _lock)
    monkeypatch.setattr(auth_endpoint, "release_refresh_rotation_lock", _noop_blacklist)
    monkeypatch.setattr(auth_endpoint, "mark_refresh_rotated", _noop_blacklist)
    monkeypatch.setattr(auth_endpoint, "get_user_by_id", _active_user)
    monkeypatch.setattr(auth_endpoint, "rotate_refresh_token_version", _rotated_user)
    monkeypatch.setattr(auth_endpoint, "blacklist_token", _noop_blacklist)
    monkeypatch.setattr(auth_endpoint, "invalidate_auth_session", _noop_blacklist)
    monkeypatch.setattr(
        auth_endpoint, "create_access_token", lambda *_args, **_kwargs: "new-access"
    )
    monkeypatch.setattr(
        auth_endpoint, "create_refresh_token", lambda *_args, **_kwargs: "new-refresh"
    )

    class FakeRedis:
        async def execute_command(self, command, *args):
            if command == "GET":
                return b"old-refresh-token"
            return None

        async def delete(self, *args, **kwargs):
            pass

    monkeypatch.setattr(auth_endpoint, "get_redis", lambda: FakeRedis())

    response = Response()
    payload = await auth_endpoint.refresh(
        request=_build_request(),
        response=response,
        repo=MockUserRepository(),
        refresh_token="old-refresh-token",
    )

    assert payload["access_token"] == "new-access"
    cookie_header = response.headers.get("set-cookie", "")
    assert "refresh_token=new-refresh" in cookie_header
    assert f"Max-Age={auth_endpoint._refresh_cookie_max_age()}" in cookie_header


@pytest.mark.asyncio
async def test_refresh_rejects_legacy_object_id_before_db(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _noop_rate_limit(*args, **kwargs) -> None:
        return None

    async def _db_should_not_be_called(*args, **kwargs):
        raise AssertionError("database lookup should not run for invalid UUID sub")

    settings = get_settings()
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": "6a069ae96f83d511c5602fbd",
            "type": "refresh",
            "token_version": 0,
            "jti": "jti-legacy",
            "family_id": str(uuid4()),
            "iss": settings.JWT_ISSUER,
            "aud": settings.JWT_AUDIENCE,
            "iat": now,
            "nbf": now,
            "exp": now + timedelta(minutes=5),
        },
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )

    monkeypatch.setattr(auth_endpoint, "_assert_rate_limit_refresh", _noop_rate_limit)
    monkeypatch.setattr(auth_endpoint, "get_user_by_id", _db_should_not_be_called)

    response = Response()
    with pytest.raises(InvalidUserIdError):
        await auth_endpoint.refresh(
            request=_build_request(),
            response=response,
            repo=MockUserRepository(),
            refresh_token=token,
        )

    cookie_header = response.headers.get("set-cookie", "").lower()
    assert "refresh_token=" in cookie_header
    assert "max-age=0" in cookie_header


def test_refresh_cookie_policy_uses_none_in_production(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        auth_endpoint,
        "get_settings",
        lambda: SimpleNamespace(
            ENVIRONMENT=Environment.production,
            REFRESH_TOKEN_EXPIRE_DAYS=7,
            COOKIE_DOMAIN=None,
        ),
    )
    response = Response()
    auth_endpoint._set_refresh_cookie(response, "refresh-token")
    cookie_header = response.headers.get("set-cookie", "").lower()

    assert "samesite=lax" in cookie_header
    assert "secure" in cookie_header


def test_refresh_cookie_policy_uses_lax_in_development(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        auth_endpoint,
        "get_settings",
        lambda: SimpleNamespace(
            ENVIRONMENT=Environment.development,
            REFRESH_TOKEN_EXPIRE_DAYS=7,
            COOKIE_DOMAIN=None,
        ),
    )
    response = Response()
    auth_endpoint._set_refresh_cookie(response, "refresh-token")
    cookie_header = response.headers.get("set-cookie", "").lower()

    assert "samesite=lax" in cookie_header


@pytest.mark.asyncio
async def test_refresh_reuse_revokes_family_and_user_tokens(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user_id = uuid4()
    family_id = uuid4()
    calls: list[str] = []

    async def _noop_rate_limit(*args, **kwargs) -> None:
        return None

    async def _not_blacklisted(*args, **kwargs) -> bool:
        return False

    async def _consumed(*args, **kwargs) -> bool:
        return True

    async def _revoke_all(*args, **kwargs) -> None:
        calls.append("revoke_all")

    async def _revoke_user_version(*args, **kwargs) -> None:
        calls.append("revoke_version")

    async def _invalidate(*args, **kwargs) -> None:
        calls.append("invalidate_session")

    async def _blacklist(*args, **kwargs) -> None:
        calls.append("blacklist")

    monkeypatch.setattr(auth_endpoint, "_assert_rate_limit_refresh", _noop_rate_limit)
    monkeypatch.setattr(
        auth_endpoint,
        "decode_auth_token",
        lambda *args, **kwargs: SimpleNamespace(
            user_id=user_id,
            jti="replayed-jti",
            token_version=0,
            family_id=family_id,
        ),
    )
    monkeypatch.setattr(auth_endpoint, "is_blacklisted", _not_blacklisted)
    monkeypatch.setattr(auth_endpoint, "is_refresh_family_revoked", _not_blacklisted)
    monkeypatch.setattr(auth_endpoint, "is_refresh_jti_consumed", _consumed)
    monkeypatch.setattr(auth_endpoint, "revoke_all_refresh_families", _revoke_all)
    monkeypatch.setattr(auth_endpoint, "revoke_user_token_version", _revoke_user_version)
    monkeypatch.setattr(auth_endpoint, "invalidate_auth_session", _invalidate)
    monkeypatch.setattr(auth_endpoint, "blacklist_token", _blacklist)

    response = Response()
    with pytest.raises(RevokedTokenError):
        await auth_endpoint.refresh(
            request=_build_request(),
            response=response,
            repo=MockUserRepository(),
            refresh_token="old-refresh-token",
        )

    assert calls == ["revoke_all", "revoke_version", "invalidate_session", "blacklist"]
    cookie_header = response.headers.get("set-cookie", "").lower()
    assert "refresh_token=" in cookie_header
    assert "max-age=0" in cookie_header
