from enum import Enum


class IngestionStage(str, Enum):
    QUEUED = "QUEUED"
    UPLOADING = "UPLOADING"
    PARSING = "PARSING"
    CHUNKING = "CHUNKING"
    EMBEDDING = "EMBEDDING"
    INDEXING = "INDEXING"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


TERMINAL_STAGES = {IngestionStage.COMPLETE, IngestionStage.FAILED, IngestionStage.CANCELLED}

ALLOWED_TRANSITIONS: dict[IngestionStage, set[IngestionStage]] = {
    IngestionStage.QUEUED: {
        IngestionStage.UPLOADING,
        IngestionStage.PARSING,
        IngestionStage.FAILED,
        IngestionStage.CANCELLED,
    },
    IngestionStage.UPLOADING: {
        IngestionStage.PARSING,
        IngestionStage.FAILED,
        IngestionStage.CANCELLED,
    },
    IngestionStage.PARSING: {
        IngestionStage.CHUNKING,
        IngestionStage.FAILED,
        IngestionStage.CANCELLED,
    },
    IngestionStage.CHUNKING: {
        IngestionStage.EMBEDDING,
        IngestionStage.FAILED,
        IngestionStage.CANCELLED,
    },
    IngestionStage.EMBEDDING: {
        IngestionStage.INDEXING,
        IngestionStage.FAILED,
        IngestionStage.CANCELLED,
    },
    IngestionStage.INDEXING: {
        IngestionStage.COMPLETE,
        IngestionStage.FAILED,
        IngestionStage.CANCELLED,
    },
    IngestionStage.COMPLETE: set(),
    IngestionStage.FAILED: {
        IngestionStage.UPLOADING,
        IngestionStage.PARSING,
        IngestionStage.CHUNKING,
        IngestionStage.EMBEDDING,
        IngestionStage.INDEXING,
    },
    IngestionStage.CANCELLED: set(),
}


class InvalidStageTransition(Exception):
    pass


def assert_transition(current: IngestionStage, next_stage: IngestionStage) -> None:
    if next_stage not in ALLOWED_TRANSITIONS.get(current, set()):
        raise InvalidStageTransition(f"Cannot transition {current} → {next_stage}")


class RetrievalScope(str, Enum):
    GLOBAL = "GLOBAL"
    CLASSROOM = "CLASSROOM"
    CHAT = "CHAT"
    WORKSPACE = "WORKSPACE"
