from typing import Any

from fastapi import status


class AvatarBaseException(Exception):
    """Base exception for all avatar app errors"""

    def __init__(
        self,
        message: str,
        code: str = "UNKNOWN_ERROR",
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: dict[str, Any] | None = None,
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class ASRException(AvatarBaseException):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message=f"ASR Error: {message}", code="ASR_ERROR", details=details)


class LLMException(AvatarBaseException):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message=f"LLM Error: {message}", code="LLM_ERROR", details=details)


class TTSException(AvatarBaseException):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message=f"TTS Error: {message}", code="TTS_ERROR", details=details)


class RAGException(AvatarBaseException):
    """Raised when RAG ingestion or retrieval fails."""

    def __init__(self, message: str, details: dict | None = None):
        super().__init__(
            message=f"RAG Error: {message}",
            code="RAG_ERROR",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details=details,
        )


class EmptyDocumentError(RAGException):
    def __init__(self, message: str = "Document is empty", details: dict | None = None):
        super().__init__(message=message, details=details)


class UnsupportedFileType(RAGException):
    def __init__(self, message: str = "Unsupported file type", details: dict | None = None):
        self.status_code = status.HTTP_400_BAD_REQUEST
        super().__init__(message=message, details=details)


class IngestionCancelledException(RAGException):
    def __init__(self, message: str = "Ingestion cancelled", details: dict | None = None):
        super().__init__(message=message, details=details)


class ChunkLimitExceeded(RAGException):
    def __init__(
        self, message: str = "Document exceeds maximum chunk limit", details: dict | None = None
    ):
        self.status_code = status.HTTP_400_BAD_REQUEST
        super().__init__(message=message, details=details)


class VectorDimensionMismatch(RAGException):
    def __init__(self, expected: int, actual: int):
        self.expected = expected
        self.actual = actual
        super().__init__(
            message=f"Vector dimension mismatch. Expected {expected}, got {actual}",
            details={"expected": expected, "actual": actual},
        )


class AuthenticationException(AvatarBaseException):
    """Raised when authentication fails (invalid credentials, expired token)."""

    def __init__(
        self,
        message: str = "Authentication failed",
        details: dict | None = None,
    ) -> None:
        super().__init__(
            message=message,
            code="AUTHENTICATION_ERROR",
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=details,
        )


class InvalidTokenError(AuthenticationException):
    """JWT is malformed, has the wrong type, or is missing required claims."""

    def __init__(self, message: str = "Invalid token", details: dict | None = None) -> None:
        super().__init__(message=message, details=details)
        self.code = "INVALID_TOKEN"


class ExpiredTokenError(AuthenticationException):
    """JWT signature is valid but the token is expired."""

    def __init__(self, message: str = "Token has expired", details: dict | None = None) -> None:
        super().__init__(message=message, details=details)
        self.code = "EXPIRED_TOKEN"


class InvalidUserIdError(AuthenticationException):
    """Token or request carried a non-UUID user identifier."""

    def __init__(
        self, message: str = "Invalid user identifier", details: dict | None = None
    ) -> None:
        super().__init__(message=message, details=details)
        self.code = "INVALID_USER_ID"


class RevokedTokenError(AuthenticationException):
    """JWT was explicitly revoked or superseded by refresh rotation."""

    def __init__(
        self, message: str = "Token has been revoked", details: dict | None = None
    ) -> None:
        super().__init__(message=message, details=details)
        self.code = "REVOKED_TOKEN"


class InvalidAuthStateError(AuthenticationException):
    """Authentication state is internally inconsistent or superseded."""

    def __init__(
        self,
        message: str = "Invalid authentication state",
        details: dict | None = None,
    ) -> None:
        super().__init__(message=message, details=details)
        self.code = "INVALID_AUTH_STATE"


class WebSocketException(Exception):
    """Custom WebSocket exception"""

    def __init__(self, message: str, code: str = "WS_ERROR"):
        self.message = message
        self.code = code
        super().__init__(message)
