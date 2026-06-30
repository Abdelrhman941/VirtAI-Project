__all__ = ["ConversationPipeline"]


from typing import Any


def __getattr__(name: str) -> Any:
    if name == "ConversationPipeline":
        from app.application.voice.handle_voice_turn import ConversationPipeline

        return ConversationPipeline
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
