import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException, Request

from app.presentation.http.v1.dependencies import _current_user
from app.shared.errors import RevokedTokenError


class DummyCreds:
    credentials = "dummy-token"


def mock_decode_auth_token(token, expected_type):
    import uuid

    from app.shared.security import AuthTokenPayload

    return AuthTokenPayload(
        user_id=uuid.uuid4(),
        token_type="access",
        jti="jti-123",
        token_version=0,
        issuer="test",
        audience="test",
        issued_at=0,
        not_before=0,
    )


@pytest.mark.asyncio
async def test_redis_timeout_during_blacklist_validation():
    with patch("app.presentation.http.v1.dependencies.decode_auth_token", mock_decode_auth_token):
        with patch(
            "app.infrastructure.cache.jwt_blacklist.is_blacklisted",
            AsyncMock(side_effect=asyncio.TimeoutError),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await _current_user(Request(scope={"type": "http"}), AsyncMock(), DummyCreds())
            assert exc_info.value.status_code == 401
            assert exc_info.value.detail == "Authentication service unavailable"


@pytest.mark.asyncio
async def test_redis_connection_error_during_blacklist():
    import redis.exceptions

    with patch("app.presentation.http.v1.dependencies.decode_auth_token", mock_decode_auth_token):
        with patch(
            "app.infrastructure.cache.jwt_blacklist.is_blacklisted",
            AsyncMock(side_effect=redis.exceptions.ConnectionError("Offline")),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await _current_user(Request(scope={"type": "http"}), AsyncMock(), DummyCreds())
            assert exc_info.value.status_code == 401
            assert exc_info.value.detail == "Authentication service unavailable"


@pytest.mark.asyncio
async def test_revoked_token_is_preserved():
    with patch("app.presentation.http.v1.dependencies.decode_auth_token", mock_decode_auth_token):
        with patch(
            "app.infrastructure.cache.jwt_blacklist.is_blacklisted", AsyncMock(return_value=True)
        ):
            with pytest.raises(RevokedTokenError):
                await _current_user(Request(scope={"type": "http"}), AsyncMock(), DummyCreds())


@pytest.mark.asyncio
async def test_non_redis_exception_is_not_swallowed():
    with patch("app.presentation.http.v1.dependencies.decode_auth_token", mock_decode_auth_token):
        with patch(
            "app.infrastructure.cache.jwt_blacklist.is_blacklisted",
            AsyncMock(side_effect=RuntimeError("Some logical bug")),
        ):
            with pytest.raises(RuntimeError) as exc_info:
                await _current_user(Request(scope={"type": "http"}), AsyncMock(), DummyCreds())
            assert "Some logical bug" in str(exc_info.value)


@pytest.mark.asyncio
async def test_cache_write_failure_does_not_block_valid_token():
    with patch("app.presentation.http.v1.dependencies.decode_auth_token", mock_decode_auth_token):
        with patch(
            "app.infrastructure.cache.jwt_blacklist.is_blacklisted", AsyncMock(return_value=False)
        ):
            with patch(
                "app.infrastructure.cache.auth_session_cache.get_cached_auth_session",
                AsyncMock(return_value=None),
            ):
                import uuid
                from datetime import datetime, timezone

                from app.domain.user.entities import AuthProvider, UserEntity

                user = UserEntity(
                    id=uuid.uuid4(),
                    email="test@example.com",
                    full_name="Test",
                    provider=AuthProvider.LOCAL,
                    is_active=True,
                    refresh_token_version=0,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                with patch(
                    "app.presentation.http.v1.dependencies.get_user_by_id",
                    AsyncMock(return_value=user),
                ):
                    with patch(
                        "app.infrastructure.cache.auth_session_cache.cache_auth_session",
                        AsyncMock(side_effect=asyncio.TimeoutError),
                    ):
                        result = await _current_user(
                            Request(scope={"type": "http"}), AsyncMock(), DummyCreds()
                        )
                        assert result == user
