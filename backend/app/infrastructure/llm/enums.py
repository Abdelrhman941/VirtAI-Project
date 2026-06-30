"""LLM provider enums for the agentic RAG pipeline."""

from enum import Enum


class LLMProvider(str, Enum):
    """Supported LLM provider backends."""

    OPENAI = "OPENAI"
    COHERE = "COHERE"


class OpenAIRole(str, Enum):
    """Chat message roles for OpenAI-compatible APIs."""

    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"


class CoHereRole(str, Enum):
    """Chat message roles for Cohere API."""

    SYSTEM = "SYSTEM"
    USER = "USER"
    CHATBOT = "CHATBOT"
    DOCUMENT = "search_document"
    QUERY = "search_query"


class DocumentTypeEnum(str, Enum):
    """Embedding input type discriminator (affects embedding quality)."""

    DOCUMENT = "document"
    QUERY = "query"
