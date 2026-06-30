import uuid
from enum import Enum
from typing import Dict, Protocol

from pydantic import BaseModel


class SessionState(Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"


class IncomingMessage(BaseModel):
    content: str


class DomainEvent(BaseModel):
    content: str


class TurnStarted(DomainEvent):
    pass


class PipelineYielded(DomainEvent):
    pass


class OutboundSender(Protocol):
    async def send_event(self, event: DomainEvent) -> None: ...


class SessionManager:
    """
    Global session manager tracking states and outbound endpoints
    for all active WebSocket connections.
    """

    def __init__(self) -> None:
        self._states: Dict[str, SessionState] = {}
        self._outbounds: Dict[str, OutboundSender] = {}

    async def register_connection(self, user_id: str, outbound: OutboundSender) -> str:
        session_id = str(uuid.uuid4())
        self._states[session_id] = SessionState.DRAFT
        self._outbounds[session_id] = outbound
        return session_id

    def get_state(self, session_id: str) -> SessionState:
        if session_id not in self._states:
            raise ValueError(f"Session {session_id} not found")
        return self._states[session_id]

    async def handle_message(self, session_id: str, message: IncomingMessage) -> None:
        if session_id not in self._states:
            raise ValueError(f"Session {session_id} not found")
            
        self._activate_if_draft(session_id)
        await self._execute_pipeline(session_id, message)

    def _activate_if_draft(self, session_id: str) -> None:
        if self._states[session_id] == SessionState.DRAFT:
            self._states[session_id] = SessionState.ACTIVE

    async def _execute_pipeline(self, session_id: str, message: IncomingMessage) -> None:
        outbound = self._outbounds.get(session_id)
        if not outbound:
            return

        await outbound.send_event(TurnStarted(content=message.content))
        await outbound.send_event(PipelineYielded(content=message.content))

    def cleanup_session(self, session_id: str) -> None:
        self._states.pop(session_id, None)
        self._outbounds.pop(session_id, None)
