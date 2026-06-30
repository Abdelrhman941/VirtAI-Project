"""
JWT Key Manager for handling both symmetric (HS256) and asymmetric (RS256) keys.
Supports loading keys from config for key rotation.
"""

from typing import Any

from app.shared.config import get_settings


def get_signing_key() -> tuple[str, str, dict[str, Any]]:
    """
    Returns the key, algorithm, and headers to use for signing new tokens.
    If JWT_PRIVATE_KEY is set, it prefers RS256. Otherwise falls back to HS256.
    """
    settings = get_settings()
    if settings.JWT_PRIVATE_KEY:
        headers = {}
        if settings.JWT_KID:
            headers["kid"] = settings.JWT_KID
        return settings.JWT_PRIVATE_KEY, "RS256", headers

    return settings.JWT_SECRET_KEY, "HS256", {}


def get_verification_keys() -> list[tuple[str, str]]:
    """
    Returns a list of valid (key, algorithm) pairs for verifying tokens.
    If RS256 is enabled, it returns the public key. It also returns the HS256 key
    to allow graceful rotation (so existing HS256 tokens don't instantly break).
    """
    settings = get_settings()
    keys = []

    if settings.JWT_PUBLIC_KEY:
        keys.append((settings.JWT_PUBLIC_KEY, "RS256"))

    # Always include the fallback/legacy key for seamless rotation
    keys.append((settings.JWT_SECRET_KEY, "HS256"))

    return keys


def get_jwks() -> dict:
    """
    Generate JSON Web Key Set (JWKS) if RS256 is configured.
    Normally we would parse the PEM to get n and e parameters, but for simplicity
    in some libraries, returning the PEM or a placeholder is a start.
    A full implementation would use cryptography to extract RSA public numbers.
    """
    settings = get_settings()
    if not settings.JWT_PUBLIC_KEY or not settings.JWT_KID:
        return {"keys": []}

    # Note: A real JWKS endpoint requires `n` and `e` from the RSA key.
    # Since we are using python-jose or PyJWT, they can decode the PEM directly internally.
    # This JWKS is minimal for external introspection if needed.
    return {"keys": [{"kty": "RSA", "use": "sig", "kid": settings.JWT_KID, "alg": "RS256"}]}
