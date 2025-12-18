"""
Contains all project handlers:
- ASR    : Convert speech → text
- TTS    : Convert text   → speech
- LLM    : Natural language processing
- VAD    : Human voice detection
- Avatar : Avatar animation
"""

from .base_handler import BaseHandler, HandlerType

__all__ = ["BaseHandler", "HandlerType"]
