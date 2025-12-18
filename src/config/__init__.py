"""
Contains:
- settings.py : YAML file reading
- logger.py   : Logging system
"""

from .settings import settings
from .logger import log

# When someone does: from src.config import * => Only these items will be imported
__all__ = ["settings", "log"]
