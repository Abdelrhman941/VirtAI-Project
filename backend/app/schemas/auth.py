"""Pydantic request / response schemas for authentication endpoints."""

from pydantic import BaseModel, ConfigDict, EmailStr, Field


def _to_camel(name: str) -> str:
    parts = name.split("_")
    return parts[0] + "".join(w.capitalize() for w in parts[1:])


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class SignupRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class GoogleCallbackRequest(BaseModel):
    code: str = Field(min_length=1)
    state: str = Field(min_length=1)


class SetupStatusRequest(BaseModel):
    setup_complete: bool = True


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """Serialises to camelCase so the React frontend can consume it directly."""

    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=_to_camel,
        populate_by_name=True,
    )

    id: str
    full_name: str
    email: str
    setup_complete: bool
