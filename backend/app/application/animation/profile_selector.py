import math
import random
import re
from dataclasses import dataclass
from pathlib import Path
from typing import ClassVar

from app.shared.config import get_settings


@dataclass(frozen=True)
class AnimationProfile:
    animation_id: str
    asset_name: str
    gesture_type: str
    intensity: float
    start_frame: int
    end_frame: int
    transition_out_frame: int
    loop_start_frame: int
    loop_end_frame: int


class ProfileSelector:
    GESTURE_INTENT_AFFINITY: ClassVar[dict[str, tuple[str, ...]]] = {
        "explanatory": ("explanation", "transition"),
        "emphasis": ("emphasis",),
        "inquisitive": ("question",),
        "warm": ("reassurance",),
        "neutral": ("transition", "explanation"),
    }

    def __init__(self) -> None:
        self._profiles = self._build_profiles()

    def select_profile(
        self,
        intent: str,
        tone: str,
        recent_assets: list[str],
        profile_usage: dict[str, int],
        previous_intent: str | None = None,
    ) -> AnimationProfile:
        candidates: list[tuple[AnimationProfile, float]] = []
        last_asset = recent_assets[-1] if recent_assets else None

        for profile in self._profiles:
            score = 1.0

            if intent in self.GESTURE_INTENT_AFFINITY.get(profile.gesture_type, ()):
                score += 1.35

            if tone in {"excited", "happy"}:
                score += profile.intensity * 0.6
            elif tone in {"neutral", "thinking", "curious"}:
                score += (1.0 - abs(profile.intensity - 0.62)) * 0.35

            if previous_intent and previous_intent == intent:
                score += 0.1

            for recency_index, asset in enumerate(reversed(recent_assets), start=1):
                if asset == profile.asset_name:
                    score -= max(0.08, 0.62 / recency_index)

            usage_penalty = min(1.2, profile_usage.get(profile.asset_name, 0) * 0.12)
            score -= usage_penalty

            if last_asset == profile.asset_name:
                score -= 1.25

            score = max(score, 0.05)
            candidates.append((profile, score))

        return self._softmax_pick(candidates)

    def _softmax_pick(
        self, scored_profiles: list[tuple[AnimationProfile, float]]
    ) -> AnimationProfile:
        temperature = 0.85
        exps = [math.exp(score / temperature) for _, score in scored_profiles]
        total = sum(exps)
        threshold = random.random() * total
        cumulative = 0.0

        for idx, (profile, _) in enumerate(scored_profiles):
            cumulative += exps[idx]
            if cumulative >= threshold:
                return profile
        return scored_profiles[-1][0]

    def blend_for_transition(self, previous: str | None, current: AnimationProfile) -> float:
        if previous is None:
            return 0.28
        prev_profile = next((p for p in self._profiles if p.asset_name == previous), None)
        if prev_profile is None:
            return 0.26
        intensity_delta = abs(prev_profile.intensity - current.intensity)
        return max(0.18, min(0.45, 0.22 + intensity_delta * 0.32))

    def _build_profiles(self) -> list[AnimationProfile]:
        assets = self._discover_talk_assets()
        profiles: list[AnimationProfile] = []

        gesture_map = {
            1: "neutral",
            2: "explanatory",
            3: "inquisitive",
            4: "emphasis",
            5: "warm",
            6: "emphasis",
            7: "explanatory",
        }

        for asset in assets:
            match = re.match(r"Talk_(\d+)", asset)
            if not match:
                continue

            talk_id = int(match.group(1))
            variant = 1
            animation_id = f"talk{talk_id}"

            start = 8 + (variant * 2)
            end = 50 + talk_id % 3 + (1 if variant == 2 else 0)
            transition_out = max(start + 8, end - 4)
            loop_start = min(start + 4, end - 10)
            loop_end = max(loop_start + 4, end - 6)

            base_intensity = 0.45 + (talk_id * 0.055)
            intensity = min(0.95, base_intensity + (0.04 if variant == 2 else 0.0))

            profiles.append(
                AnimationProfile(
                    animation_id=animation_id,
                    asset_name=asset,
                    gesture_type=gesture_map.get(talk_id, "neutral"),
                    intensity=round(intensity, 3),
                    start_frame=start,
                    end_frame=end,
                    transition_out_frame=transition_out,
                    loop_start_frame=loop_start,
                    loop_end_frame=loop_end,
                )
            )

        if profiles:
            return profiles

        fallback_assets = [f"Talk{i}.1" for i in range(1, 8)]
        for idx, asset in enumerate(fallback_assets, start=1):
            profiles.append(
                AnimationProfile(
                    animation_id=f"talk{idx}",
                    asset_name=asset,
                    gesture_type="neutral",
                    intensity=0.55 + (idx * 0.04),
                    start_frame=10,
                    end_frame=48,
                    transition_out_frame=44,
                    loop_start_frame=14,
                    loop_end_frame=40,
                )
            )
        return profiles

    def _discover_talk_assets(self) -> list[str]:
        base = Path(get_settings().ANIMATION_ASSETS_DIR)
        if not base.exists():
            return []

        assets = []
        for file in base.glob("Talk*.fbx"):
            assets.append(file.stem)
        assets.sort()
        return assets
