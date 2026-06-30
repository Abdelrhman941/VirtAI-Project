"""Authentication API endpoints — login, signup, Google OAuth, token refresh, logout."""

from __future__ import annotations

# 1. Standard Library
import secrets

# 2. Third-Party
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from fastapi.security import HTTPAuthorizationCredentials
from loguru import logger
from redis.asyncio.client import Redis as AsyncRedis

# 3. Local Application
from app.application.auth.auth_use_cases import (
    authenticate_user,
    build_google_auth_url,
    change_user_password,
    exchange_google_code,
    get_or_create_google_user,
    get_user_by_email,
    get_user_by_id,
    register_user,
    revoke_user_token_version,
    rotate_refresh_token_version,
    set_user_setup_complete,
)
from app.domain.user.entities import AuthProvider, UserEntity
from app.infrastructure.cache.auth_session_cache import (
    cache_auth_session,
    invalidate_auth_session,
)
from app.infrastructure.cache.cache_keys import auth_refresh_key
from app.infrastructure.cache.jwt_blacklist import blacklist_token, is_blacklisted
from app.infrastructure.cache.rate_limiter import check_rate_limit
from app.infrastructure.cache.redis_client import get_redis
from app.infrastructure.cache.refresh_token_family import (
    acquire_refresh_rotation_lock,
    is_refresh_family_revoked,
    is_refresh_jti_consumed,
    mark_refresh_rotated,
    release_refresh_rotation_lock,
    revoke_all_refresh_families,
    revoke_refresh_family,
    store_initial_refresh_token,
)
from app.presentation.http.v1.dependencies import (
    UserRepositoryDep,
    _bearer,
    _current_user,
    _serialize_user_for_cache,
)
from app.schemas.auth import (
    ChangePasswordRequest,
    GoogleCallbackRequest,
    LoginRequest,
    SetupStatusRequest,
    SignupRequest,
    UserResponse,
)
from app.shared.config import Environment, get_settings
from app.shared.errors import (
    ExpiredTokenError,
    InvalidAuthStateError,
    InvalidTokenError,
    InvalidUserIdError,
    RevokedTokenError,
)
from app.shared.metrics import (
    auth_login_attempts,
    auth_login_failures,
    auth_refresh_rotations,
)
from app.shared.security import (
    create_access_token,
    create_refresh_token,
    decode_auth_token,
    extract_jti,
    extract_user_id,
    verify_token,
)

router = APIRouter()

COOKIE_KEY = "refresh_token"
COOKIE_PATH = "/api/v1/auth"


def _extract_client_ip(request: Request) -> str:
    settings = get_settings()
    if settings.TRUST_PROXY_HEADERS:
        forwarded_for = request.headers.get("x-forwarded-for", "")
        if forwarded_for:
            first_hop = forwarded_for.split(",")[0].strip()
            if first_hop:
                return first_hop
    return request.client.host if request.client else "unknown"


async def _assert_rate_limit_login(request: Request) -> None:
    settings = get_settings()
    client_ip = _extract_client_ip(request)
    allowed = await check_rate_limit(
        identifier=f"auth:login:{client_ip}",
        limit=settings.RATE_LIMIT_LOGIN_REQUESTS,
        window=settings.RATE_LIMIT_LOGIN_WINDOW,
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts",
            headers={"Retry-After": str(settings.RATE_LIMIT_LOGIN_WINDOW)},
        )


async def _assert_rate_limit_signup(request: Request) -> None:
    settings = get_settings()
    client_ip = _extract_client_ip(request)
    allowed = await check_rate_limit(
        identifier=f"auth:signup:{client_ip}",
        limit=settings.RATE_LIMIT_SIGNUP_REQUESTS,
        window=settings.RATE_LIMIT_SIGNUP_WINDOW,
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many signup attempts",
            headers={"Retry-After": str(settings.RATE_LIMIT_SIGNUP_WINDOW)},
        )


async def _assert_rate_limit_refresh(request: Request) -> None:
    settings = get_settings()
    client_ip = _extract_client_ip(request)
    allowed = await check_rate_limit(
        identifier=f"auth:refresh:{client_ip}",
        limit=settings.RATE_LIMIT_REFRESH_REQUESTS,
        window=settings.RATE_LIMIT_REFRESH_WINDOW,
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many refresh attempts",
            headers={"Retry-After": str(settings.RATE_LIMIT_REFRESH_WINDOW)},
        )


async def _assert_rate_limit_google_callback(request: Request) -> None:
    settings = get_settings()
    client_ip = _extract_client_ip(request)
    allowed = await check_rate_limit(
        identifier=f"auth:google_callback:{client_ip}",
        limit=settings.RATE_LIMIT_LOGIN_REQUESTS,
        window=settings.RATE_LIMIT_LOGIN_WINDOW,
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts",
            headers={"Retry-After": str(settings.RATE_LIMIT_LOGIN_WINDOW)},
        )


async def _check_account_lockout(email: str) -> None:
    """Exponential backoff after repeated failures for the same email."""
    redis_client: AsyncRedis = get_redis()
    key = f"virtai:auth:lockout:{email}"
    failures: bytes | None = await redis_client.execute_command("GET", key)
    if failures and int(failures) >= 10:
        raise HTTPException(
            status_code=423,
            detail="Account temporarily locked due to repeated failed attempts",
        )


async def _record_login_failure(email: str) -> None:
    redis_client: AsyncRedis = get_redis()
    key = f"virtai:auth:lockout:{email}"
    from redis.asyncio.client import Pipeline

    pipe: Pipeline = redis_client.pipeline()
    pipe.incr(key)
    pipe.expire(key, 900)  # 15 minute window
    await pipe.execute()


def _refresh_cookie_max_age() -> int:
    settings = get_settings()
    return settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60


from typing import Literal


def _refresh_cookie_policy() -> tuple[bool, Literal["lax", "strict", "none"]]:
    settings = get_settings()
    return Environment.production == settings.ENVIRONMENT, "lax"


def _set_refresh_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    secure, same_site = _refresh_cookie_policy()
    response.set_cookie(
        key=COOKIE_KEY,
        value=token,
        httponly=True,
        secure=secure,
        samesite=same_site,
        path=COOKIE_PATH,
        max_age=_refresh_cookie_max_age(),
        domain=getattr(settings, "COOKIE_DOMAIN", None),
    )


def _delete_refresh_cookie(response: Response) -> None:
    settings = get_settings()
    secure, same_site = _refresh_cookie_policy()
    response.delete_cookie(
        key=COOKIE_KEY,
        httponly=True,
        secure=secure,
        samesite=same_site,
        path=COOKIE_PATH,
        domain=getattr(settings, "COOKIE_DOMAIN", None),
    )


def _user_response(user: UserEntity) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        setup_complete=user.setup_complete,
    )


def _issue_tokens(user: UserEntity, family_id: str | None = None) -> tuple[str, str, str]:
    refresh = create_refresh_token(user.id, user.refresh_token_version, family_id=family_id)
    refresh_payload = decode_auth_token(refresh, expected_type="refresh")
    if refresh_payload.family_id is None:
        raise InvalidAuthStateError("Refresh token missing family")

    resolved_family_id = str(refresh_payload.family_id)
    access = create_access_token(user.id, user.refresh_token_version, family_id=resolved_family_id)

    return access, refresh, resolved_family_id


async def _store_initial_refresh(
    user: UserEntity, refresh: str, family_id: str, request: Request
) -> None:
    refresh_payload = decode_auth_token(refresh, expected_type="refresh")
    client_ip = _extract_client_ip(request)
    user_agent = request.headers.get("user-agent", "unknown")
    await store_initial_refresh_token(
        str(user.id),
        family_id,
        refresh,
        refresh_payload.jti,
        _refresh_cookie_max_age(),
        client_ip=client_ip,
        user_agent=user_agent,
    )


@router.post("/login")
async def login(
    body: LoginRequest,
    response: Response,
    request: Request,
    repo: UserRepositoryDep,
) -> dict:
    from app.application.auth.auth_use_cases import (
        LoginUseCase,
        RateLimitExceededError,
        AccountLockedError,
        InvalidCredentialsError,
        InactiveAccountError,
    )

    use_case = LoginUseCase(repo)
    try:
        result = await use_case.execute(
            email=body.email,
            password=body.password,
            client_ip=_extract_client_ip(request),
            user_agent=request.headers.get("user-agent", "unknown"),
        )
    except RateLimitExceededError as e:
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts",
            headers={"Retry-After": str(e.retry_after)},
        )
    except AccountLockedError:
        raise HTTPException(
            status_code=423,
            detail="Account temporarily locked due to repeated failed attempts",
        )
    except InvalidCredentialsError:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    except InactiveAccountError:
        raise HTTPException(status_code=403, detail="User account is inactive")

    _set_refresh_cookie(response, result.refresh_token)
    return {
        "access_token": result.access_token,
        "token_type": "bearer",
        "user": _user_response(result.user).model_dump(by_alias=True),
    }


@router.post("/signup", status_code=201)
async def signup(
    body: SignupRequest,
    response: Response,
    request: Request,
    repo: UserRepositoryDep,
) -> dict:
    from app.application.auth.auth_use_cases import (
        SignupUseCase,
        RateLimitExceededError,
        EmailAlreadyRegisteredError,
    )

    use_case = SignupUseCase(repo)
    try:
        result = await use_case.execute(
            full_name=body.full_name,
            email=body.email,
            password=body.password,
            client_ip=_extract_client_ip(request),
            user_agent=request.headers.get("user-agent", "unknown"),
        )
    except RateLimitExceededError as e:
        raise HTTPException(
            status_code=429,
            detail="Too many signup attempts",
            headers={"Retry-After": str(e.retry_after)},
        )
    except EmailAlreadyRegisteredError:
        raise HTTPException(status_code=409, detail="Email already registered")

    _set_refresh_cookie(response, result.refresh_token)
    return {
        "access_token": result.access_token,
        "token_type": "bearer",
        "user": _user_response(result.user).model_dump(by_alias=True),
    }


@router.get("/me")
async def me(user: UserEntity = Depends(_current_user)) -> dict:
    return _user_response(user).model_dump(by_alias=True)


@router.patch("/me/setup")
async def update_setup_status(
    body: SetupStatusRequest,
    repo: UserRepositoryDep,
    user: UserEntity = Depends(_current_user),
) -> dict:
    updated = await set_user_setup_complete(repo, user.id, body.setup_complete)
    if updated is None:
        raise HTTPException(status_code=404, detail="User not found")
    await invalidate_auth_session(str(user.id))
    await cache_auth_session(str(updated.id), _serialize_user_for_cache(updated))
    return _user_response(updated).model_dump(by_alias=True)


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    repo: UserRepositoryDep,
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    user: UserEntity = Depends(_current_user),
) -> dict:
    if user.provider != AuthProvider.LOCAL:
        raise HTTPException(
            status_code=400, detail="Password change is only supported for local accounts"
        )

    updated_user = await change_user_password(
        repo, user.id, body.current_password, body.new_password
    )
    if updated_user is None:
        raise HTTPException(status_code=400, detail="Invalid current password")

    # Revoke all refresh families and invalidate cache so user must log in again
    await revoke_all_refresh_families(str(user.id), reason="password_changed")
    await invalidate_auth_session(str(user.id))

    if creds is not None:
        access_jti = extract_jti(creds.credentials)
        if access_jti:
            settings = get_settings()
            await blacklist_token(access_jti, ttl_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)

    return {"detail": "Password changed successfully. Please log in again."}


@router.get("/csrf")
async def get_csrf_token(request: Request, response: Response) -> dict:
    return {"detail": "CSRF cookie set"}


@router.get("/google/url")
async def google_url() -> dict:
    state = secrets.token_urlsafe(32)
    redis_client: AsyncRedis = get_redis()
    await redis_client.execute_command("SETEX", f"oauth:state:{state}", 300, "1")
    return {"url": build_google_auth_url(state)}


@router.post("/google/callback")
async def google_callback(
    body: GoogleCallbackRequest,
    response: Response,
    request: Request,
    repo: UserRepositoryDep,
) -> dict:
    from app.application.auth.auth_use_cases import (
        GoogleLoginUseCase,
        RateLimitExceededError,
        InvalidOAuthStateError,
        InactiveAccountError,
    )

    use_case = GoogleLoginUseCase(repo)
    try:
        result = await use_case.execute(
            code=body.code,
            state=body.state,
            client_ip=_extract_client_ip(request),
            user_agent=request.headers.get("user-agent", "unknown"),
        )
    except RateLimitExceededError as e:
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts",
            headers={"Retry-After": str(e.retry_after)},
        )
    except InvalidOAuthStateError:
        raise HTTPException(status_code=400, detail="Invalid or expired state parameter")
    except InactiveAccountError:
        raise HTTPException(status_code=403, detail="User account is inactive")

    _set_refresh_cookie(response, result.refresh_token)
    return {
        "access_token": result.access_token,
        "token_type": "bearer",
        "user": _user_response(result.user).model_dump(by_alias=True),
    }


@router.post("/refresh")
async def refresh(
    request: Request,
    response: Response,
    repo: UserRepositoryDep,
    refresh_token: str | None = Cookie(None, alias=COOKIE_KEY),
) -> dict:
    await _assert_rate_limit_refresh(request)
    if refresh_token is None:
        raise HTTPException(status_code=401, detail="Missing refresh token")
    try:
        token_payload = decode_auth_token(refresh_token, expected_type="refresh")
        user_id = token_payload.user_id
        jti = token_payload.jti
        token_version = token_payload.token_version
        family_id = str(token_payload.family_id) if token_payload.family_id else None
        if family_id is None:
            raise InvalidAuthStateError("Refresh token missing family")
        if jti and await is_blacklisted(jti):
            raise RevokedTokenError("Refresh token has been revoked")
        if await is_refresh_family_revoked(str(user_id), family_id):
            raise RevokedTokenError("Refresh token family has been revoked")
        if await is_refresh_jti_consumed(jti):
            await revoke_all_refresh_families(
                str(user_id), reason="refresh_reuse_detected", replay_jti=jti
            )
            await revoke_user_token_version(repo, user_id)
            await invalidate_auth_session(str(user_id))
            await blacklist_token(jti)
            raise RevokedTokenError("Refresh token reuse detected")

        lock_token = await acquire_refresh_rotation_lock(str(user_id), family_id)
        if lock_token is None:
            raise HTTPException(status_code=409, detail="Refresh already in progress")

        redis_client: AsyncRedis = get_redis()
        try:
            stored_refresh_bytes: bytes | None = await redis_client.execute_command(
                "GET", auth_refresh_key(str(user_id), family_id)
            )
            stored_refresh: str | None = (
                stored_refresh_bytes.decode("utf-8") if stored_refresh_bytes else None
            )
            if stored_refresh is not None and stored_refresh != refresh_token:
                raise RevokedTokenError("Refresh token has been superseded")

            user = await get_user_by_id(repo, user_id)
            if user is None:
                raise InvalidTokenError("User not found")
            if not user.is_active:
                raise HTTPException(status_code=403, detail="User account is inactive")
            if token_version != user.refresh_token_version:
                raise RevokedTokenError("Refresh token invalid or superseded")

            rotated_user = await rotate_refresh_token_version(repo, user_id, token_version)
            if rotated_user is None:
                raise RevokedTokenError("Refresh token invalid or superseded")

            new_access, new_refresh, _ = _issue_tokens(rotated_user, family_id=family_id)
            new_refresh_payload = decode_auth_token(new_refresh, expected_type="refresh")

            try:
                await mark_refresh_rotated(
                    str(user_id),
                    family_id,
                    jti,
                    new_refresh_payload.jti,
                    new_refresh,
                    _refresh_cookie_max_age(),
                )
                await blacklist_token(jti)
            except Exception as redis_err:
                # COMPENSATE: Roll back the DB version bump
                logger.error(
                    f"Redis failed after DB version bump — compensating | "
                    f"user={user_id} | error={redis_err}"
                )
                # The safest compensating action is to revoke all families
                # so the user must re-login cleanly instead of being left in a corrupted state
                await revoke_all_refresh_families(str(user_id), reason="redis_compensation_failure")
                raise HTTPException(
                    status_code=503,
                    detail="Session refresh failed — please log in again",
                ) from redis_err

            await invalidate_auth_session(str(user_id))
            _set_refresh_cookie(response, new_refresh)
            auth_refresh_rotations.labels(status="success").inc()
            return {"access_token": new_access, "token_type": "bearer"}
        finally:
            await release_refresh_rotation_lock(str(user_id), family_id, lock_token)
    except (
        ExpiredTokenError,
        InvalidAuthStateError,
        InvalidTokenError,
        InvalidUserIdError,
        RevokedTokenError,
    ):
        auth_refresh_rotations.labels(status="failure").inc()
        _delete_refresh_cookie(response)
        raise


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    user: UserEntity = Depends(_current_user),
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    refresh_token: str | None = Cookie(None, alias=COOKIE_KEY),
) -> dict:
    # Blacklist access token
    if creds is not None:
        verified = verify_token(creds.credentials, expected_type="access")
        access_jti = None
        if verified is not None:
            user_id = verified[0]
            access_jti = verified[1]
            await invalidate_auth_session(user_id)
        else:
            access_jti = extract_jti(creds.credentials)
            user_id = extract_user_id(creds.credentials)
            if user_id:
                await invalidate_auth_session(user_id)
        if access_jti:
            settings = get_settings()
            await blacklist_token(access_jti, ttl_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)

            # If no refresh token is provided, we still want to kill the WS connection
            # by broadcasting the family_id embedded in the access token.
            if refresh_token is None:
                try:
                    payload = decode_auth_token(creds.credentials, expected_type="access")
                    if payload.family_id:
                        from app.infrastructure.cache.pubsub import publish_session_invalidation

                        await publish_session_invalidation(str(user_id), str(payload.family_id))
                except Exception:
                    pass
    # Blacklist refresh token
    if refresh_token is not None:
        refresh_payload = None
        try:
            refresh_payload = decode_auth_token(refresh_token, expected_type="refresh")
        except (ExpiredTokenError, InvalidAuthStateError, InvalidTokenError, InvalidUserIdError):
            refresh_payload = None
        refresh_jti = refresh_payload.jti if refresh_payload else extract_jti(refresh_token)
        refresh_user_id = (
            str(refresh_payload.user_id) if refresh_payload else extract_user_id(refresh_token)
        )
        if refresh_jti:
            await blacklist_token(refresh_jti)
        if refresh_user_id and refresh_payload and refresh_payload.family_id:
            await revoke_refresh_family(
                refresh_user_id,
                str(refresh_payload.family_id),
                reason="logout",
                replay_jti=None,
            )
    _delete_refresh_cookie(response)
    return {"detail": "Logged out"}


@router.get("/sessions")
async def list_sessions(user: UserEntity = Depends(_current_user)) -> dict:
    """List all active refresh families with device metadata."""
    redis_client: AsyncRedis = get_redis()
    from app.infrastructure.cache.cache_keys import (
        auth_refresh_family_meta_key,
        auth_refresh_user_families_key,
    )

    result = await redis_client.execute_command(
        "SMEMBERS", auth_refresh_user_families_key(str(user.id))
    )
    raw_families: set[bytes] = (
        result if isinstance(result, set) else set(result) if isinstance(result, list) else set()
    )
    sessions = []
    for fam_raw in raw_families:
        fam = fam_raw.decode() if isinstance(fam_raw, bytes) else str(fam_raw)
        # Check if family is revoked
        if await is_refresh_family_revoked(str(user.id), fam):
            continue
        result = await redis_client.execute_command(
            "HGETALL", auth_refresh_family_meta_key(str(user.id), fam)
        )
        meta: dict[bytes, bytes] = result if isinstance(result, dict) else {}
        if meta:

            def _decode(v: bytes | str) -> str:
                return v.decode() if isinstance(v, bytes) else str(v)

            sessions.append(
                {
                    "family_id": fam,
                    "ip": _decode(meta.get(b"ip", b"unknown")),
                    "user_agent": _decode(meta.get(b"ua", b"unknown")),
                    "device_name": _decode(meta.get(b"device_name", b"unknown")),
                    "created_at": _decode(meta.get(b"created_at", b"")),
                    "last_seen": _decode(meta.get(b"last_seen", b"")),
                }
            )
    return {"sessions": sessions}


@router.delete("/sessions/{family_id}")
async def revoke_session(
    family_id: str,
    user: UserEntity = Depends(_current_user),
) -> dict:
    """Revoke a specific session family (remote logout)."""
    await revoke_refresh_family(str(user.id), family_id, reason="user_revoked")
    return {"detail": "Session revoked"}
