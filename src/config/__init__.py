"""
Contains:
- settings.py : YAML file reading
- logger.py   : Logging system
"""

# ------------------------------------------------------------
# Setup Logger First:
# ------------------------------
from .logger import setup_logger, logger, LogContext, log_exception

# Initial setup
setup_logger()

# ------------------------------------------------------------
# Load Settings:
# ------------------------------
from .settings import settings

# ------------------------------------------------------------
# Reconfigure Logger based on Settings"
# ------------------------------
# Now we have settings from YAML, use them
setup_logger(
    log_level=settings.log_level,
    log_dir="logs",
    app_name="avatar_chatbot",
    console_output=True,
    file_output=True,
)

logger.info("✅ All settings loaded successfully")

# ------------------------------------------------------------
# Exports:
# ------------------------------
__all__ = [
    "settings",
    "logger",
    "LogContext",
    "log_exception",
]
