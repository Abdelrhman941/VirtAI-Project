from collections import defaultdict
from typing import Any

from app.application.animation.audio_feature_fuser import AudioFeatureFuser
from app.application.animation.intent_scorer import IntentScorer
from app.application.animation.profile_selector import ProfileSelector


class TimelineBuilder:
    def __init__(self) -> None:
        self.intent_scorer = IntentScorer()
        self.profile_selector = ProfileSelector()
        self.audio_fuser = AudioFeatureFuser()

    def build_timeline(
        self,
        text: str,
        recent_assets: list[str] | None = None,
        emotion: str | None = None,
        profile_usage: dict[str, int] | None = None,
        intent_history: list[str] | None = None,
    ) -> dict[str, Any]:
        if profile_usage is None:
            profile_usage = defaultdict(int)
        if intent_history is None:
            intent_history = []
        recent = recent_assets or []
        segments = self.intent_scorer.segment_text(text)
        timeline: list[dict[str, Any]] = []
        recent_window = list(recent[-6:])
        previous_intent = intent_history[-1] if intent_history else None
        intent_trace: list[str] = []

        for segment in segments:
            mapping = self.intent_scorer.map_segment(
                segment,
                emotion=emotion,
                previous_intent=previous_intent,
            )
            intent_scores = mapping.intent_scores
            intent = mapping.intent
            tone = mapping.tone
            profile = self.profile_selector.select_profile(
                intent=intent,
                tone=tone,
                recent_assets=recent_window,
                profile_usage=profile_usage,
                previous_intent=previous_intent,
            )
            blend = self.profile_selector.blend_for_transition(
                previous=recent_window[-1] if recent_window else None, current=profile
            )

            timeline.append(
                {
                    "animation": profile.animation_id,
                    "animation_asset": profile.asset_name,
                    "start_frame": profile.start_frame,
                    "end_frame": profile.end_frame,
                    "transition_out_frame": profile.transition_out_frame,
                    "loop_start_frame": profile.loop_start_frame,
                    "loop_end_frame": profile.loop_end_frame,
                    "blend": round(blend, 3),
                    "intent": intent,
                    "intent_scores": {k: round(v, 4) for k, v in intent_scores.items()},
                    "tone": tone,
                    "text": segment,
                }
            )
            recent_window.append(profile.asset_name)
            recent_window = recent_window[-6:]
            profile_usage[profile.asset_name] += 1
            previous_intent = intent
            intent_trace.append(intent)

        if intent_trace:
            intent_history.extend(intent_trace)
            intent_history[:] = intent_history[-24:]

        return {
            "timeline": timeline,
            "meta": {
                "segments": len(segments),
                "source": "heuristic-probabilistic-v1",
                "uses_softmax": True,
                "intent_trace": intent_trace,
            },
        }

    def build_timeline_v2(
        self,
        text: str,
        audio_features: dict[str, Any],
        recent_assets: list[str] | None = None,
        emotion: str | None = None,
        profile_usage: dict[str, int] | None = None,
        intent_history: list[str] | None = None,
    ) -> dict[str, Any]:
        if profile_usage is None:
            profile_usage = defaultdict(int)
        if intent_history is None:
            intent_history = []

        duration_s = float(audio_features.get("duration_s") or 0.0)
        duration_s = max(0.2, duration_s)

        semantic_segments = self.intent_scorer.segment_text(text)
        if not semantic_segments and text.strip():
            semantic_segments = [text.strip()]

        windows = self.audio_fuser.allocate_segment_windows(semantic_segments, duration_s)
        energy_curve = self.audio_fuser.normalize_energy_curve(
            audio_features.get("energy_curve"), duration_s
        )
        emphasis_marks = self.audio_fuser.normalize_emphasis(
            audio_features.get("emphasis_timestamps"),
            duration_s,
        )
        speech_rate = float(audio_features.get("speech_rate_wps") or 2.3)
        pause_segments = self.audio_fuser.normalize_time_segments(
            audio_features.get("pause_segments"), duration_s
        )

        timeline: list[dict[str, Any]] = []
        recent_window = list((recent_assets or [])[-6:])
        previous_intent = intent_history[-1] if intent_history else None
        intent_trace: list[str] = []

        for segment, (start_time, end_time) in zip(semantic_segments, windows, strict=False):
            if end_time - start_time < 0.06:
                continue

            mapping = self.intent_scorer.map_segment(
                segment,
                emotion=emotion,
                previous_intent=previous_intent,
            )
            intent_scores = mapping.intent_scores
            intent = mapping.intent
            tone = mapping.tone
            profile = self.profile_selector.select_profile(
                intent=intent,
                tone=tone,
                recent_assets=recent_window,
                profile_usage=profile_usage,
                previous_intent=previous_intent,
            )

            local_energy = self.audio_fuser.average_energy(energy_curve, start_time, end_time)
            emphasis_hits = sum(1 for mark in emphasis_marks if start_time <= mark <= end_time)
            intensity = self.audio_fuser.clamp(
                profile.intensity * 0.58 + local_energy * 0.34 + min(0.18, emphasis_hits * 0.07),
                0.22,
                1.0,
            )
            speed = self.audio_fuser.clamp(
                0.92
                + (speech_rate - 2.3) * 0.13
                + (local_energy - 0.5) * 0.22
                + emphasis_hits * 0.03,
                0.75,
                1.35,
            )
            blend_weight = self.audio_fuser.clamp(
                self.profile_selector.blend_for_transition(
                    previous=recent_window[-1] if recent_window else None,
                    current=profile,
                )
                + min(0.08, emphasis_hits * 0.03),
                0.16,
                0.52,
            )

            transition_type = "emphasis" if emphasis_hits > 0 else "smooth"
            timeline.append(
                {
                    "start_time": round(start_time, 3),
                    "end_time": round(end_time, 3),
                    "animation": profile.animation_id,
                    "animation_asset": profile.asset_name,
                    "blend_weight": round(blend_weight, 3),
                    "speed": round(speed, 3),
                    "intensity": round(intensity, 3),
                    "transition_type": transition_type,
                    "intent": intent,
                    "intent_scores": {k: round(v, 4) for k, v in intent_scores.items()},
                    "tone": tone,
                    "text": segment,
                    "start_frame": profile.start_frame,
                    "end_frame": profile.end_frame,
                    "transition_out_frame": profile.transition_out_frame,
                    "loop_start_frame": profile.loop_start_frame,
                    "loop_end_frame": profile.loop_end_frame,
                }
            )

            recent_window.append(profile.asset_name)
            recent_window = recent_window[-6:]
            profile_usage[profile.asset_name] += 1
            previous_intent = intent
            intent_trace.append(intent)

        for pause in pause_segments:
            start_time = float(pause["start_time"])
            end_time = float(pause["end_time"])
            if end_time - start_time < 0.12:
                continue

            timeline.append(
                {
                    "start_time": round(start_time, 3),
                    "end_time": round(end_time, 3),
                    "animation": "idle",
                    "animation_asset": "Idle",
                    "blend_weight": 0.2,
                    "speed": 1.0,
                    "intensity": 0.24,
                    "transition_type": "pause",
                    "intent": "transition",
                    "intent_scores": {"transition": 1.0},
                    "tone": "neutral",
                    "text": "",
                    "start_frame": 0,
                    "end_frame": 36,
                    "transition_out_frame": 30,
                    "loop_start_frame": 8,
                    "loop_end_frame": 30,
                }
            )

        timeline = self._normalize_timeline_ranges(timeline, duration_s)

        if intent_trace:
            intent_history.extend(intent_trace)
            intent_history[:] = intent_history[-24:]

        return {
            "timeline": timeline,
            "meta": {
                "segments": len(semantic_segments),
                "source": "audio-semantic-v2",
                "duration_s": round(duration_s, 3),
                "speech_rate_wps": round(speech_rate, 3),
                "emphasis_count": len(emphasis_marks),
                "intent_trace": intent_trace,
            },
        }

    def _normalize_timeline_ranges(
        self,
        timeline: list[dict[str, Any]],
        duration_s: float,
    ) -> list[dict[str, Any]]:
        if not timeline:
            return []

        ordered = sorted(
            timeline, key=lambda item: (item.get("start_time", 0.0), item.get("end_time", 0.0))
        )
        normalized: list[dict[str, Any]] = []

        for item in ordered:
            start = self.audio_fuser.clamp(float(item.get("start_time", 0.0)), 0.0, duration_s)
            end = self.audio_fuser.clamp(float(item.get("end_time", start + 0.08)), 0.0, duration_s)

            if normalized:
                prev_end = float(normalized[-1]["end_time"])
                if start < prev_end:
                    start = prev_end
            if end - start < 0.06:
                end = self.audio_fuser.clamp(start + 0.06, 0.0, duration_s)

            if end <= start:
                continue

            item["start_time"] = round(start, 3)
            item["end_time"] = round(end, 3)
            normalized.append(item)

        return normalized
