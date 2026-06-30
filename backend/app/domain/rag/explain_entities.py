from enum import Enum

from pydantic import BaseModel


class PresentationState(str, Enum):
    EXPLAINING = "EXPLAINING"
    AWAITING = "AWAITING"
    ANSWERING = "ANSWERING"


class SlideStartEvent(BaseModel):
    type: str = "SlideStartEvent"
    slide_index: int
    total_slides: int | None = None


class SlideContentTokens(BaseModel):
    type: str = "SlideContentTokens"
    tokens: str


class SlideEndEvent(BaseModel):
    type: str = "SlideEndEvent"
    slide_index: int | None = None


class AwaitInputEvent(BaseModel):
    type: str = "AwaitInputEvent"
