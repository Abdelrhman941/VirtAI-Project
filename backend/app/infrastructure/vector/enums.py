"""Vector DB provider enums for the agentic RAG pipeline."""

from enum import Enum


class VectorDBBackend(str, Enum):
    """Supported vector database backends."""

    QDRANT = "QDRANT"
    PGVECTOR = "PGVECTOR"


class DistanceMethod(str, Enum):
    """Vector similarity distance methods."""

    COSINE = "cosine"
    DOT = "dot"


class PgVectorColumn(str, Enum):
    """Column names for dynamic PGVector collection tables."""

    ID = "id"
    TEXT = "text"
    VECTOR = "vector"
    CHUNK_ID = "chunk_id"
    METADATA = "metadata"
    PREFIX = "collection"


class PgVectorDistanceOps(str, Enum):
    """PostgreSQL pgvector distance operator classes."""

    COSINE = "vector_cosine_ops"
    DOT = "vector_l2_ops"


class PgVectorIndexType(str, Enum):
    """pgvector index strategies."""

    HNSW = "hnsw"
    IVFFLAT = "ivfflat"
