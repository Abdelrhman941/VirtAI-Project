from typing import Annotated, Any, Literal, Union
from pydantic import BaseModel, Field

class AuthMessage(BaseModel):
    type: Literal["auth"]
    token: str = Field(..., min_length=1)

class SessionRestoreMessage(BaseModel):
    type: Literal["session_restore"]
    session_id: str

class SessionNewMessage(BaseModel):
    type: Literal["session_new"]

class PingMessage(BaseModel):
    type: Literal["ping"]

class WSAckMessage(BaseModel):
    type: Literal["ws.ack"]
    data: dict[str, Any] | None = None

class ChatUserMessagePayload(BaseModel):
    type: Literal["chat.user_message", "text"]
    text: str
    message_id: str | None = None
    session_id: str | None = None

class ChatAbortPayload(BaseModel):
    type: Literal["chat.abort"]
    message_id: str | None = None
    session_id: str | None = None

class ClientSpeechStoppedPayload(BaseModel):
    type: Literal["client.speech_stopped"]
    session_id: str | None = None

IncomingWSMessage = Annotated[
    Union[
        AuthMessage,
        SessionRestoreMessage,
        SessionNewMessage,
        PingMessage,
        WSAckMessage,
        ChatUserMessagePayload,
        ChatAbortPayload,
        ClientSpeechStoppedPayload,
    ],
    Field(discriminator="type"),
]
