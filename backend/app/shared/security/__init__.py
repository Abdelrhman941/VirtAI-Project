"""JWT token creation / verification and password hashing utilities."""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

import bcrypt
from jose import ExpiredSignatureError, JWTError, jwt

from app.shared.config import get_settings
from app.shared.errors import (
    ExpiredTokenError,
    InvalidAuthStateError,
    InvalidTokenError,
    InvalidUserIdError,
)
from app.shared.ids import parse_uuid
from app.shared.key_manager import get_signing_key, get_verification_keys

BCRYPT_MAX_PASSWORD_BYTES = 72


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------


def hash_password(plain: str) -> str:
    password = plain.encode("utf-8")
    if len(password) > BCRYPT_MAX_PASSWORD_BYTES:
        raise ValueError("Password cannot be longer than 72 bytes")
    return bcrypt.hashpw(password, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class AuthTokenPayload:
    user_id: UUID
    token_type: str
    jti: str
    token_version: int
    issuer: str
    audience: str
    issued_at: int
    not_before: int
    expires_at: int | None = None
    family_id: UUID | None = None


def _create_token(
    data: dict,
    expires_delta: timedelta,
    token_type: str,
) -> str:
    settings = get_settings()
    payload = data.copy()
    now = datetime.now(timezone.utc)
    jti = str(uuid.uuid4())
    payload.update(
        {
            "iss": settings.JWT_ISSUER,
            "aud": settings.JWT_AUDIENCE,
            "iat": now,
            "nbf": now,
            "exp": now + expires_delta,
            "type": token_type,
            "jti": jti,
        }
    )

    key, algorithm, headers = get_signing_key()

    return jwt.encode(
        payload,
        key,
        algorithm=algorithm,
        headers=headers if headers else None,
    )


def _normalize_token_user_id(user_id: str | UUID) -> UUID:
    parsed = parse_uuid(user_id)
    if parsed is None:
        raise InvalidUserIdError()
    return parsed


def create_access_token(
    user_id: str | UUID,
    token_version: int = 0,
    family_id: str | UUID | None = None,
) -> str:
    settings = get_settings()
    uid = _normalize_token_user_id(user_id)
    data = {"sub": str(uid), "token_version": token_version}
    if family_id:
        parsed_family = parse_uuid(family_id)
        if parsed_family:
            data["family_id"] = str(parsed_family)

    return _create_token(
        data=data,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        token_type="access",
    )


def create_refresh_token(
    user_id: str | UUID,
    token_version: int = 0,
    family_id: str | UUID | None = None,
) -> str:
    settings = get_settings()
    uid = _normalize_token_user_id(user_id)
    family_uuid = parse_uuid(family_id) if family_id is not None else uuid.uuid4()
    if family_uuid is None:
        raise InvalidAuthStateError("Refresh token family id is invalid")
    return _create_token(
        data={"sub": str(uid), "token_version": token_version, "family_id": str(family_uuid)},
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        token_type="refresh",
    )


def _required_int_claim(payload: dict, claim: str) -> int:
    try:
        raw_val = payload.get(claim)
        if raw_val is None:
            raise InvalidTokenError(f"Token missing {claim}")
        value = int(raw_val)
    except (TypeError, ValueError) as exc:
        raise InvalidTokenError(f"Token missing {claim}") from exc
    return value


def _validate_temporal_claims(payload: dict) -> tuple[int, int, int | None]:
    settings = get_settings()
    now = int(datetime.now(timezone.utc).timestamp())
    iat = _required_int_claim(payload, "iat")
    nbf = _required_int_claim(payload, "nbf")
    exp = payload.get("exp")
    exp_int = int(exp) if exp is not None else None

    if iat > now + settings.JWT_MAX_IAT_SKEW_SECONDS:
        raise InvalidTokenError("Token issued in the future")
    if nbf < iat - settings.JWT_LEEWAY_SECONDS:
        raise InvalidTokenError("Token not-before precedes issued-at")
    if exp_int is not None and iat >= exp_int:
        raise InvalidTokenError("Token issued-at must precede expiration")
    return iat, nbf, exp_int


def decode_auth_token(token: str, expected_type: str = "access") -> AuthTokenPayload:
    """
    Decode and strictly validate a JWT auth token.

    Required claims:
    - sub: canonical UUID string
    - type: expected token type
    - jti: token identifier used for revocation
    - token_version: non-negative integer
    """
    settings = get_settings()
    valid_keys = get_verification_keys()

    payload = None
    last_expired_error = None

    for key, algorithm in valid_keys:
        try:
            payload = jwt.decode(
                token,
                key,
                algorithms=[algorithm],
                audience=settings.JWT_AUDIENCE,
                issuer=settings.JWT_ISSUER,
                options={"leeway": settings.JWT_LEEWAY_SECONDS},
            )
            break  # Successfully decoded
        except ExpiredSignatureError as exc:
            last_expired_error = exc
        except JWTError:
            continue

    if payload is None:
        if last_expired_error:
            raise ExpiredTokenError() from last_expired_error
        raise InvalidTokenError()

    token_type = payload.get("type", "")
    if token_type != expected_type:
        raise InvalidTokenError("Invalid token type")

    if payload.get("iss") != settings.JWT_ISSUER:
        raise InvalidTokenError("Invalid token issuer")
    if payload.get("aud") != settings.JWT_AUDIENCE:
        raise InvalidTokenError("Invalid token audience")

    user_id = parse_uuid(payload.get("sub"))
    if user_id is None:
        raise InvalidUserIdError()

    jti = payload.get("jti")
    if not isinstance(jti, str) or not jti.strip():
        raise InvalidTokenError("Token missing identifier")

    try:
        token_version_raw = payload.get("token_version")
        if token_version_raw is None:
            raise InvalidAuthStateError("Token missing version")
        token_version = int(token_version_raw)
    except (TypeError, ValueError) as exc:
        raise InvalidAuthStateError("Token missing version") from exc

    if token_version < 0:
        raise InvalidAuthStateError("Token version is invalid")

    family_id = None
    raw_family_id = payload.get("family_id")
    if raw_family_id:
        family_id = parse_uuid(raw_family_id)

    if expected_type == "refresh" and family_id is None:
        raise InvalidAuthStateError("Refresh token missing valid family id")

    iat, nbf, exp = _validate_temporal_claims(payload)
    return AuthTokenPayload(
        user_id=user_id,
        token_type=token_type,
        jti=jti,
        token_version=token_version,
        issuer=str(payload["iss"]),
        audience=str(payload["aud"]),
        issued_at=iat,
        not_before=nbf,
        expires_at=exp,
        family_id=family_id,
    )


def verify_token(
    token: str, expected_type: str = "access"
) -> tuple[str, str] | tuple[str, str, int] | None:
    """
    Backward-compatible wrapper for code/tests that expect tuple-or-None.

    New code should use decode_auth_token() so callers can distinguish expired,
    malformed, revoked, and invalid-identity failures.
    """
    try:
        decoded = decode_auth_token(token, expected_type=expected_type)
    except (ExpiredTokenError, InvalidAuthStateError, InvalidTokenError, InvalidUserIdError):
        return None

    if expected_type == "refresh":
        return str(decoded.user_id), decoded.jti, decoded.token_version
    return str(decoded.user_id), decoded.jti


def extract_jti(token: str) -> str | None:
    """Extract JTI from a token without full verification (for blacklisting on logout)."""
    settings = get_settings()
    valid_keys = get_verification_keys()
    for key, algorithm in valid_keys:
        try:
            payload = jwt.decode(
                token,
                key,
                algorithms=[algorithm],
                audience=settings.JWT_AUDIENCE,
                issuer=settings.JWT_ISSUER,
                options={"verify_exp": False},  # allow expired tokens to be blacklisted
            )
            return payload.get("jti")
        except JWTError:
            continue
    return None


def extract_user_id(token: str) -> str | None:
    """Extract user_id (sub) from a token without full verification."""
    settings = get_settings()
    valid_keys = get_verification_keys()
    for key, algorithm in valid_keys:
        try:
            payload = jwt.decode(
                token,
                key,
                algorithms=[algorithm],
                audience=settings.JWT_AUDIENCE,
                issuer=settings.JWT_ISSUER,
                options={"verify_exp": False},
            )
            parsed = parse_uuid(payload.get("sub"))
            return str(parsed) if parsed else None
        except JWTError:
            continue
    return None
