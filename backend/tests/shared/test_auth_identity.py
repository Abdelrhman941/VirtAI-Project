from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
from jose import jwt

from app.shared.config import get_settings
from app.shared.errors import InvalidUserIdError
from app.shared.ids import parse_uuid
from app.shared.security import create_access_token, decode_auth_token, verify_token


def test_parse_uuid_returns_none_for_legacy_object_id() -> None:
    assert parse_uuid("6a069ae96f83d511c5602fbd") is None


def test_parse_uuid_accepts_canonical_uuid() -> None:
    value = uuid4()
    assert parse_uuid(str(value)) == value
    assert parse_uuid(value) == value


def test_create_access_token_rejects_non_uuid_subject() -> None:
    with pytest.raises(InvalidUserIdError):
        create_access_token("6a069ae96f83d511c5602fbd")


def test_decode_auth_token_requires_uuid_subject() -> None:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": "6a069ae96f83d511c5602fbd",
            "type": "access",
            "token_version": 0,
            "jti": str(uuid4()),
            "iss": settings.JWT_ISSUER,
            "aud": settings.JWT_AUDIENCE,
            "iat": now,
            "nbf": now,
            "exp": now + timedelta(minutes=5),
        },
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )

    with pytest.raises(InvalidUserIdError):
        decode_auth_token(token, expected_type="access")
    assert verify_token(token, expected_type="access") is None


def test_decode_auth_token_returns_uuid_payload() -> None:
    user_id = uuid4()
    token = create_access_token(user_id, token_version=2)
    decoded = decode_auth_token(token, expected_type="access")

    assert isinstance(decoded.user_id, UUID)
    assert decoded.user_id == user_id
    assert decoded.token_version == 2
    assert decoded.token_type == "access"
    assert decoded.issuer == get_settings().JWT_ISSUER
    assert decoded.audience == get_settings().JWT_AUDIENCE
    assert decoded.issued_at <= decoded.not_before + get_settings().JWT_LEEWAY_SECONDS
