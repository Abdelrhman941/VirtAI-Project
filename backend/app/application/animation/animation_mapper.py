"""Semantic animation mapping with keyword scoring + softmax normalization."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import ClassVar


@dataclass(frozen=True)
class AnimationMappingDecision:
    """Result of mapping a text segment to animation intent and tone."""

    intent: str
    tone: str
    intent_scores: dict[str, float]


from app.domain.animation.intent_definitions import INTENT_KEYWORDS


class AnimationMapper:
    """Maps text segments to animation intents using weighted keyword signals."""

    _INTENT_KEYWORDS: ClassVar[dict[str, tuple[str, ...]]] = INTENT_KEYWORDS

    @staticmethod
    def _softmax_distribution(
        scores: dict[str, float], temperature: float = 0.85
    ) -> dict[str, float]:
        bounded_temperature = max(temperature, 1e-6)
        exps = {key: math.exp(value / bounded_temperature) for key, value in scores.items()}
        total = sum(exps.values()) or 1.0
        return {key: val / total for key, val in exps.items()}

    @staticmethod
    def _detect_tone(segment: str, emotion: str | None) -> str:
        lower = segment.lower()
        if emotion:
            return emotion.lower()
        if "!" in segment:
            return "excited"
        if "?" in segment:
            return "curious"
        if any(token in lower for token in ("sorry", "understand", "help")):
            return "empathetic"
        return "neutral"

    def map_segment(
        self,
        segment: str,
        *,
        emotion: str | None = None,
        previous_intent: str | None = None,
    ) -> AnimationMappingDecision:
        """Return intent + tone using keyword-weighted softmax scoring."""
        lower = segment.lower()
        base_scores: dict[str, float] = dict.fromkeys(self._INTENT_KEYWORDS, 0.12)

        for intent, keywords in self._INTENT_KEYWORDS.items():
            for keyword in keywords:
                if keyword in lower:
                    base_scores[intent] += 0.65

        if "?" in segment:
            base_scores["question"] += 0.7
        if "!" in segment:
            base_scores["emphasis"] += 0.45
        if ";" in segment or ":" in segment:
            base_scores["explanation"] += 0.3

        if previous_intent and previous_intent in base_scores:
            base_scores[previous_intent] *= 0.82
            for intent in base_scores:
                if intent != previous_intent:
                    base_scores[intent] += 0.06

        intent_scores = self._softmax_distribution(base_scores, temperature=0.85)
        if not intent_scores:
            mapped_intent = "neutral"
        else:
            mapped_intent = max(intent_scores, key=lambda k: intent_scores[k])
        tone = self._detect_tone(segment, emotion)

        return AnimationMappingDecision(
            intent=mapped_intent,
            tone=tone,
            intent_scores={k: round(v, 4) for k, v in intent_scores.items()},
        )
