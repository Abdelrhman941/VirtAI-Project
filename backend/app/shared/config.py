import json
from enum import Enum
from functools import lru_cache
from pathlib import Path
from typing import Literal, Union

from pydantic import Field, field_validator, model_validator, AliasChoices
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Environment(str, Enum):
    development = "development"
    testing = "testing"
    production = "production"


class Settings(BaseSettings):
    _DEFAULT_JWT_SECRET = "change-me-in-production-use-a-long-random-string"

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True, extra="ignore"
    )

    # App
    APP_NAME: str = "Avatar AI Backend"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: Environment = Environment.development
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool = False

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:4173",
        "http://localhost:3001",
    ]
    PRODUCTION_ALLOWED_ORIGINS: list[str] = []

    @field_validator("ALLOWED_ORIGINS", "PRODUCTION_ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: Union[str, list[str]]) -> list[str]:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return [origin.strip() for origin in v.split(",")]
        return v


    # ASR
    ASR_PROVIDER: Literal["groq", "disabled"] = "groq"
    ASR_MODEL: str = "whisper-large-v3"
    ASR_LANGUAGE: str = "en"
    ASR_RESPONSE_FORMAT: str = "verbose_json"
    MAX_AUDIO_BUFFER_SIZE: int = 10_485_760
    AUDIO_CHUNK_TIMEOUT: int = 30

    # LLM for chat

    LLM_MAX_TOKENS: int = 512
    LLM_TEMPERATURE: float = 0.7
    LLM_SYSTEM_PROMPT: str = (
        "You are a smart and friendly educational assistant. "
        "You explain concepts in a simple and clear manner. "
        "Your answers are concise and helpful."
    )

    # TTS
    TTS_VOICE: str = "en-US-AriaNeural"
    TTS_RATE: str = "+0%"
    TTS_VOLUME: str = "+0%"
    TTS_PITCH: str = "+0Hz"
    TTS_VISEME_DEFAULT_DURATION_MS: float = 60.0
    TTS_TIMEOUT_SEC: float = 20.0
    ENABLE_FILLER_AUDIO: bool = False

    # Avatar
    DEFAULT_AVATAR_ID: str = "avatar1"
    VALID_AVATAR_IDS: list[str] = ["avatar1", "avatar2", "avatar3"]
    ANIMATION_ASSETS_DIR: str = str(
        BASE_DIR.parent / "frontend" / "public" / "models" / "animations" / "Talk"
    )

    # WebSocket
    WS_HEARTBEAT_INTERVAL: int = 30
    WS_HEARTBEAT_TIMEOUT: int = 90
    WS_MAX_MESSAGE_SIZE: int = 10_485_760
    WS_MAX_ACTIVE_CONNECTIONS: int = 500

    # Session
    SESSION_TIMEOUT_SEC: int = 300
    SESSION_CLEANUP_INTERVAL: int = 60

    # Rate limiting
    RATE_LIMIT_LOGIN_REQUESTS: int = 5
    RATE_LIMIT_LOGIN_WINDOW: int = 60
    RATE_LIMIT_SIGNUP_REQUESTS: int = 3
    RATE_LIMIT_SIGNUP_WINDOW: int = 300
    RATE_LIMIT_REFRESH_REQUESTS: int = 10
    RATE_LIMIT_REFRESH_WINDOW: int = 60
    RATE_LIMIT_WS_CONNECT_REQUESTS: int = 3
    RATE_LIMIT_WS_CONNECT_WINDOW: int = 10
    RATE_LIMIT_MESSAGES_PER_MINUTE: int = 60
    TRUST_PROXY_HEADERS: bool = False

    # Storage
    AUDIO_STORAGE_PATH: str = str(BASE_DIR / ".data" / "sessions")
    AUDIO_FILE_TTL_HOURS: int = 24
    UPLOAD_BASE_PATH: str = str(BASE_DIR / ".data" / "uploads")

    # Audio
    AUDIO_MAX_DURATION_SEC: int = 30
    AUDIO_SAMPLE_RATE: int = 16000

    # PostgreSQL
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "virtai"

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CHAT_CONTEXT_TTL: int = 3600
    REDIS_TTS_CACHE_TTL: int = 86400
    REDIS_LLM_CACHE_TTL: int = 1800
    REDIS_JWT_BLACKLIST_TTL: int = 604800
    REDIS_AUTH_SESSION_TTL: int = 900
    REDIS_TOKEN_VALIDATION_TTL: int = 120
    REDIS_CONNECT_RETRIES: int = 3
    REDIS_CONNECT_RETRY_DELAY_SEC: float = 1.0

    # Cookies
    COOKIE_DOMAIN: str | None = None

    # JWT
    JWT_SECRET_KEY: str = _DEFAULT_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"
    JWT_PRIVATE_KEY: str = ""
    JWT_PUBLIC_KEY: str = ""
    JWT_KID: str = ""
    JWT_ISSUER: str = "virtai-api"
    JWT_AUDIENCE: str = "virtai-client"
    JWT_LEEWAY_SECONDS: int = 30
    JWT_MAX_IAT_SKEW_SECONDS: int = 60
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    REFRESH_REUSE_INCIDENT_TTL_DAYS: int = 30
    REFRESH_ROTATION_LOCK_SECONDS: int = 10

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:3000/auth/callback"

    # RAG
    VECTOR_DB_BACKEND: Literal["PGVECTOR", "QDRANT"] = "PGVECTOR"
    VECTOR_DB_DISTANCE_METHOD: Literal["cosine", "dot"] = "cosine"
    RAG_MIN_HYBRID_SCORE: float = 0.015
    RAG_MIN_DENSE_SCORE: float = 0.5

    EMBEDDING_PROVIDER: Literal["cohere", "openai", "fastembed"] = "cohere"
    EMBEDDING_MODEL: str = Field(
        default="embed-multilingual-v3.0",
        validation_alias=AliasChoices("EMBEDDING_MODEL", "EMBEDDING_MODEL_ID")
    )
    EMBEDDING_DIMENSION: int = Field(
        default=1024,
        validation_alias=AliasChoices("EMBEDDING_DIMENSION", "EMBEDDING_MODEL_SIZE")
    )
    FASTEMBED_CACHE_DIR: str = str(BASE_DIR / ".cache" / "fastembed")
    FASTEMBED_LAZY_LOAD: bool = False

    GENERATION_PROVIDER: Literal["cohere"] = "cohere"
    GENERATION_MODEL: str = "command-a-03-2025"
    GENERATION_MAX_TOKENS: int = 1000
    GENERATION_TEMPERATURE: float = 0.3

    RERANKER_PROVIDER: Literal["cohere"] = "cohere"
    RERANKER_MODEL: str = "rerank-multilingual-v3.0"
    CROSS_ENCODER_MODEL: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    VISION_PROVIDER: Literal["gemini", "disabled"] = "gemini"
    VISION_MODEL: str = "gemini-2.5-flash"
    VISION_MAX_IMAGES_PER_DOC: int = 15
    GOOGLE_API_KEY: str = ""

    OPENAI_API_KEY: str = ""
    COHERE_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    HF_TOKEN: str = ""
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    EMBEDDING_BATCH_SIZE: int = 32
    MAX_CHUNKS_PER_DOCUMENT: int = 2000
    MAX_UPLOAD_SIZE_MB: int = 25
    ALLOWED_FILE_TYPES: list[str] = ["pdf", "txt", "md"]
    STALE_QUEUE_THRESHOLD_MINUTES: int = 15
    MAX_ACTIVE_JOBS_PER_USER: int = 3
    ARQ_MAX_TRIES: int = 3

    PRIMARY_LANG: str = "en"
    DEFAULT_LANG: str = "en"

    NAPKIN_API_KEY: str = ""

    @field_validator(
        "RATE_LIMIT_LOGIN_REQUESTS",
        "RATE_LIMIT_LOGIN_WINDOW",
        "RATE_LIMIT_SIGNUP_REQUESTS",
        "RATE_LIMIT_SIGNUP_WINDOW",
        "RATE_LIMIT_REFRESH_REQUESTS",
        "RATE_LIMIT_REFRESH_WINDOW",
        "RATE_LIMIT_WS_CONNECT_REQUESTS",
        "RATE_LIMIT_WS_CONNECT_WINDOW",
        "RATE_LIMIT_MESSAGES_PER_MINUTE",
        "ACCESS_TOKEN_EXPIRE_MINUTES",
        "REFRESH_TOKEN_EXPIRE_DAYS",
        "REFRESH_REUSE_INCIDENT_TTL_DAYS",
        "REFRESH_ROTATION_LOCK_SECONDS",
        "REDIS_AUTH_SESSION_TTL",
        "REDIS_TOKEN_VALIDATION_TTL",
        "REDIS_CONNECT_RETRIES",
        "ARQ_MAX_TRIES",
        "EMBEDDING_BATCH_SIZE",
        "MAX_CHUNKS_PER_DOCUMENT",
    )
    @classmethod
    def ensure_positive_ints(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("must be greater than 0")
        return v

    @field_validator("DEBUG", mode="before")
    @classmethod
    def reject_legacy_debug_values(cls, v: object) -> object:
        if isinstance(v, str) and v.strip().lower() in {"release", "prod", "production", "dev"}:
            raise ValueError(
                "DEBUG must be a boolean. Use ENVIRONMENT=production|development|testing separately."
            )
        return v

    @field_validator("ENVIRONMENT", mode="before")
    @classmethod
    def reject_legacy_environment_values(cls, v: object) -> object:
        if isinstance(v, str) and v.strip().lower() in {"release", "prod", "dev"}:
            raise ValueError(
                "ENVIRONMENT must be one of development, testing, production. "
                "Use DEBUG=true|false separately."
            )
        return v

    @model_validator(mode="after")
    def warn_legacy_env_vars(self) -> "Settings":
        import os
        from loguru import logger
        legacy_map = {
            "EMBEDDING_BACKEND": "EMBEDDING_PROVIDER",
            "EMBEDDING_MODEL_ID": "EMBEDDING_MODEL",
            "EMBEDDING_MODEL_SIZE": "EMBEDDING_DIMENSION",
        }
        for legacy, new in legacy_map.items():
            if os.getenv(legacy):
                logger.warning(f"[CONFIG] Legacy env var '{legacy}' detected. Use '{new}' instead.")
        return self

    @model_validator(mode="after")
    def validate_production_safety(self):
        if self.HF_TOKEN:
            import os

            os.environ["HF_TOKEN"] = self.HF_TOKEN

        if Environment.production != self.ENVIRONMENT:
            return self
        if self.DEBUG:
            raise ValueError("DEBUG must be False when ENVIRONMENT=production")
        if self.JWT_SECRET_KEY == self._DEFAULT_JWT_SECRET:
            raise ValueError("JWT_SECRET_KEY must be changed for production")
        if not self.GOOGLE_CLIENT_ID or not self.GOOGLE_CLIENT_SECRET:
            raise ValueError("Google OAuth client credentials are required in production")
        redirect_uri = self.GOOGLE_REDIRECT_URI.lower()
        if "localhost" in redirect_uri or "127.0.0.1" in redirect_uri:
            raise ValueError("GOOGLE_REDIRECT_URI cannot target localhost in production")
        if not (self.PRODUCTION_ALLOWED_ORIGINS or self.ALLOWED_ORIGINS):
            raise ValueError("At least one CORS origin must be configured in production")
        return self

    @property
    def cors_origins(self) -> list[str]:
        if self.ENVIRONMENT in {Environment.development, Environment.testing}:
            return self.ALLOWED_ORIGINS
        if self.PRODUCTION_ALLOWED_ORIGINS:
            return self.PRODUCTION_ALLOWED_ORIGINS
        return [
            origin
            for origin in self.ALLOWED_ORIGINS
            if "localhost" not in origin and "127.0.0.1" not in origin
        ]

    @property
    def is_production(self) -> bool:
        return Environment.production == self.ENVIRONMENT

    @property
    def is_testing(self) -> bool:
        return Environment.testing == self.ENVIRONMENT


@lru_cache
def get_settings() -> Settings:
    return Settings()
