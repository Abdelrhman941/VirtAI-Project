import asyncpg
import httpx
import redis.asyncio as redis

from app.domain.rag.stage_machine import InvalidStageTransition
from app.shared.errors import (
    ChunkLimitExceeded,
    EmptyDocumentError,
    UnsupportedFileType,
    VectorDimensionMismatch,
)

RETRYABLE_TYPES = (
    ConnectionError,
    TimeoutError,
    OSError,
    asyncpg.TooManyConnectionsError,
    redis.ConnectionError,
    httpx.RequestError,
)

NON_RETRYABLE_TYPES = (
    AttributeError,
    UnicodeDecodeError,
    EmptyDocumentError,
    UnsupportedFileType,
    ChunkLimitExceeded,
    VectorDimensionMismatch,
    InvalidStageTransition,
)


def classify(exc: Exception) -> tuple[bool, str]:
    if isinstance(exc, httpx.HTTPStatusError):
        # 4xx errors are generally client faults and shouldn't be retried
        # EXCEPT 429 Too Many Requests
        if exc.response.status_code == 429:
            return True, "HTTP_429_Too_Many_Requests"
        elif 400 <= exc.response.status_code < 500:
            return False, f"HTTP_{exc.response.status_code}_Client_Error"
        else:
            return True, f"HTTP_{exc.response.status_code}_Server_Error"

    exc_name = type(exc).__name__
    if exc_name in ("ResourceExhausted", "APIError", "ClientError"):
        code = getattr(exc, "code", getattr(exc, "status_code", None))
        msg = str(exc).lower()
        if code == 429 or exc_name in ("ResourceExhausted", "ClientError") or "429" in msg:
            if "quota" in msg:
                return False, "Quota_Exhausted_Fatal"
            return True, "Rate_Limit_Retry"

    if exc_name == "FileDataError":
        return False, "Invalid_PDF_Format"

    if isinstance(exc, RETRYABLE_TYPES):
        return True, type(exc).__name__
    if isinstance(exc, NON_RETRYABLE_TYPES):
        return False, type(exc).__name__
    return True, f"unknown:{type(exc).__name__}"
