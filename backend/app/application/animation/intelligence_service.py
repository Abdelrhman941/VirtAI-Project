"""
Animation intelligence engine.

Transforms LLM response text into a dynamic animation timeline tuned for
frontend blending behavior (crossfades, continuity, and repetition avoidance).
"""

from typing import Any

from app.application.animation.timeline_builder import TimelineBuilder


class AnimationIntelligenceService:
    def __init__(self) -> None:
        self.timeline_builder = TimelineBuilder()

    def build_timeline(
        self,
        text: str,
        recent_assets: list[str] | None = None,
        emotion: str | None = None,
        profile_usage: dict[str, int] | None = None,
        intent_history: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Build animation timeline from response text.

        Output contract is optimized for frontend AnimationMixer-based playback.
        """
        return self.timeline_builder.build_timeline(
            text=text,
            recent_assets=recent_assets,
            emotion=emotion,
            profile_usage=profile_usage,
            intent_history=intent_history,
        )

    def build_timeline_v2(
        self,
        text: str,
        audio_features: dict[str, Any],
        recent_assets: list[str] | None = None,
        emotion: str | None = None,
        profile_usage: dict[str, int] | None = None,
        intent_history: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Build an audio-synchronized timeline by fusing semantic intent and speech features.
        """
        return self.timeline_builder.build_timeline_v2(
            text=text,
            audio_features=audio_features,
            recent_assets=recent_assets,
            emotion=emotion,
            profile_usage=profile_usage,
            intent_history=intent_history,
        )
