import secrets
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.shared.config import Environment, get_settings


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        # Check CSRF token for state-changing methods
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            if request.url.path.endswith("/auth/login") or request.url.path.endswith(
                "/auth/signup"
            ):
                pass
            else:
                csrf_cookie = request.cookies.get("csrf_token")
                csrf_header = request.headers.get("x-csrf-token")

                if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
                    return JSONResponse(
                        status_code=403, content={"detail": "CSRF token validation failed"}
                    )

        response = await call_next(request)

        # Set a new CSRF token if one doesn't exist
        if "csrf_token" not in request.cookies:
            token = secrets.token_urlsafe(32)
            settings = get_settings()
            secure = Environment.production == settings.ENVIRONMENT

            response.set_cookie(
                key="csrf_token",
                value=token,
                httponly=False,  # Must be readable by frontend JS
                secure=secure,
                samesite="lax",
                path="/",
            )

        return response
