from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import TYPE_CHECKING

from loguru import logger

if TYPE_CHECKING:
    from loguru import Record

from app.shared.config import Environment, get_settings

_JWT_PATTERN = re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b")
_BEARER_PATTERN = re.compile(r"Bearer\s+[A-Za-z0-9._-]+", re.IGNORECASE)


def _redact_secrets(record: Record) -> None:
    """Redact sensitive API keys from log messages in-place."""
    settings = get_settings()
    if settings.COHERE_API_KEY and settings.COHERE_API_KEY in record["message"]:
        record["message"] = record["message"].replace(settings.COHERE_API_KEY, "[REDACTED]")
    if settings.GOOGLE_API_KEY and settings.GOOGLE_API_KEY in record["message"]:
        record["message"] = record["message"].replace(settings.GOOGLE_API_KEY, "[REDACTED]")
    record["message"] = _BEARER_PATTERN.sub("Bearer [REDACTED]", record["message"])
    record["message"] = _JWT_PATTERN.sub("[JWT_REDACTED]", record["message"])


def _inject_trace_id(record: Record) -> None:
    """Inject trace_id from contextvar into log record extra."""
    from app.shared.request_context import get_trace_id

    record["extra"]["request_id"] = get_trace_id()


def setup_logging() -> None:
    settings = get_settings()
    logger.remove()
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    effective_level = "DEBUG" if settings.DEBUG else settings.LOG_LEVEL.upper()
    if Environment.production == settings.ENVIRONMENT and effective_level == "DEBUG":
        effective_level = "INFO"

    fmt = (
        "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{line}</cyan> | "
        "<cyan>{function}</cyan> | "
        "req={extra[request_id]} | "
        "<magenta>PID:{process}</magenta> | "
        "<level>{message}</level>"
    )

    logger.add(
        sys.stdout,
        format=fmt,
        level=effective_level,
        colorize=True,
        backtrace=settings.DEBUG,
        diagnose=settings.DEBUG,
        enqueue=True,
    )

    logger.add(
        "logs/app_{time:YYYY-MM-DD}.log",
        format=fmt,
        level=effective_level,
        rotation="50 MB",
        retention="30 days",
        compression="gz",
        encoding="utf-8",
        enqueue=True,
        backtrace=settings.DEBUG,
        diagnose=settings.DEBUG,
    )

    logger.add(
        "logs/errors_{time:YYYY-MM-DD}.log",
        format=fmt,
        level="ERROR",
        rotation="10 MB",
        retention="90 days",
        compression="gz",
        encoding="utf-8",
        enqueue=True,
        backtrace=settings.DEBUG,
        diagnose=settings.DEBUG,
    )

    if Environment.production == settings.ENVIRONMENT or settings.LOG_JSON:
        json_dir = Path("logs/json")
        json_dir.mkdir(parents=True, exist_ok=True)
        logger.add(
            "logs/json/app_{time:YYYY-MM-DD}.json",
            format="{message}",
            level=effective_level,
            rotation="100 MB",
            retention="7 days",
            compression="gz",
            serialize=True,
            enqueue=True,
        )

    def _patcher(record):
        _inject_trace_id(record)
        _redact_secrets(record)

    logger.configure(patcher=_patcher, extra={"request_id": "-"})

    logger.info(
        f"[*] Logging initialized | env={settings.ENVIRONMENT} | level={effective_level} | json={settings.LOG_JSON}"
    )
    logger.debug(f"Debug mode enabled: {settings.DEBUG}")


def get_logger(module_name: str):
    return logger.bind(module=module_name)
