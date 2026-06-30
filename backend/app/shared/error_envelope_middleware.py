import traceback
from datetime import datetime

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger
from pydantic import ValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.shared.config import get_settings
from app.shared.errors import AvatarBaseException


def standard_error_response(
    status_code: int, code: str, message: str, details: dict | None = None
) -> JSONResponse:
    content = {
        "error": {
            "code": code,
            "message": message,
            "retryable": status_code in [408, 429, 500, 502, 503, 504],
            "details": details or {},
        }
    }
    return JSONResponse(status_code=status_code, content=content)


async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(f"Global exception caught: {exc}\n{traceback.format_exc()}")
    return standard_error_response(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred.")


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return standard_error_response(exc.status_code, "HTTP_ERROR", str(exc.detail))


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    details = {"errors": exc.errors()}
    return standard_error_response(
        422, "VALIDATION_ERROR", "Request validation failed.", details=details
    )


async def pydantic_validation_exception_handler(
    request: Request, exc: ValidationError
) -> JSONResponse:
    details = {"errors": exc.errors()}
    return standard_error_response(
        422, "VALIDATION_ERROR", "Data validation failed.", details=details
    )


async def avatar_exception_handler(request: Request, exc: AvatarBaseException) -> JSONResponse:
    if exc.status_code >= 500:
        logger.error(f"[{exc.code}] {exc.message} | Details: {exc.details}")
    else:
        logger.warning(f"[{exc.code}] {exc.message} | Path: {request.url.path}")

    settings = get_settings()
    details = exc.details if (settings.DEBUG and exc.details) else {}
    details["timestamp"] = datetime.utcnow().isoformat()
    details["path"] = request.url.path

    return standard_error_response(
        status_code=exc.status_code, code=exc.code, message=exc.message, details=details
    )


def setup_error_handlers(app):
    app.add_exception_handler(Exception, global_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(ValidationError, pydantic_validation_exception_handler)
    app.add_exception_handler(AvatarBaseException, avatar_exception_handler)
