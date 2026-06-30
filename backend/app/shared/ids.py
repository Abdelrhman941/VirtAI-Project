"""Identifier parsing helpers.

The database identity standard is PostgreSQL UUID. Public transports still
carry IDs as strings, so every boundary must parse before repository access.
"""

from __future__ import annotations

from uuid import UUID


def parse_uuid(value: str | UUID | None) -> UUID | None:
    """Return a UUID for valid UUID input, otherwise None.

    This helper intentionally never raises. Use it at HTTP, WebSocket, cache,
    and repository boundaries before values are bound to UUID columns.
    """
    if isinstance(value, UUID):
        return value
    if not isinstance(value, str):
        return None

    raw = value.strip()
    if not raw:
        return None

    try:
        return UUID(raw)
    except (TypeError, ValueError, AttributeError):
        return None


def require_uuid(value: str | UUID | None, *, field_name: str = "id") -> UUID:
    parsed = parse_uuid(value)
    if parsed is None:
        raise ValueError(f"Invalid UUID for {field_name}")
    return parsed
