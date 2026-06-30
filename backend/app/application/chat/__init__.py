__all__ = ["Session", "ConversationSession", "SessionManager", "handle_text_turn", "handle_message"]


from typing import Any


def __getattr__(name: str) -> Any:
    if name in {"handle_text_turn", "handle_message"}:
        from app.application.chat import handle_text_turn as handle_text_turn_module

        return getattr(handle_text_turn_module, name)
    if name in {"Session", "ConversationSession", "SessionManager"}:
        from app.application.chat import session_manager as session_manager_module

        return getattr(session_manager_module, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
