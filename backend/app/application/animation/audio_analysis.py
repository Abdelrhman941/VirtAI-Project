"""Lightweight audio feature extraction for animation timeline v2."""

from __future__ import annotations

from collections.abc import Iterable

import numpy as np

from app.domain.voice.entities import TTSResult
from app.schemas.ws_messages import MouthCue


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _merge_segments(
    segments: Iterable[tuple[float, float]],
    *,
    gap_tolerance: float,
    min_duration: float,
) -> list[tuple[float, float]]:
    ordered = sorted(
        ((max(0.0, start), max(0.0, end)) for start, end in segments if end > start),
        key=lambda x: x[0],
    )
    if not ordered:
        return []

    merged: list[list[float]] = []
    for start, end in ordered:
        if not merged:
            merged.append([start, end])
            continue

        prev = merged[-1]
        if start - prev[1] <= gap_tolerance:
            prev[1] = max(prev[1], end)
        else:
            merged.append([start, end])

    return [(start, end) for start, end in merged if end - start >= min_duration]


def _speaking_segments_from_cues(
    cues: list[MouthCue], duration_s: float
) -> list[tuple[float, float]]:
    raw = []
    for cue in cues:
        start = _clamp(float(cue.start), 0.0, duration_s)
        end = _clamp(float(cue.end), 0.0, duration_s)
        if end > start:
            raw.append((start, end))

    return _merge_segments(raw, gap_tolerance=0.09, min_duration=0.06)


def _pause_segments_from_speaking(
    speaking: list[tuple[float, float]],
    duration_s: float,
    *,
    min_gap: float,
) -> list[tuple[float, float]]:
    if duration_s <= 0:
        return []

    if not speaking:
        return [(0.0, duration_s)]

    pauses: list[tuple[float, float]] = []
    cursor = 0.0

    for start, end in speaking:
        if start - cursor >= min_gap:
            pauses.append((cursor, start))
        cursor = max(cursor, end)

    if duration_s - cursor >= min_gap:
        pauses.append((cursor, duration_s))

    return pauses


def _viseme_weight(viseme_id: int) -> float:
    if viseme_id in (0, 1, 2):
        return 0.25
    if viseme_id in (3, 4, 5, 6):
        return 0.55
    if viseme_id in (7, 8, 9, 10, 11, 12):
        return 0.75
    if viseme_id in (13, 14, 15, 16):
        return 0.9
    return 0.65


def _build_energy_curve(
    tts_result: TTSResult,
    speaking_segments: list[tuple[float, float]],
    duration_s: float,
) -> list[dict[str, float]]:
    sample_rate_hz = 12.0
    sample_count = max(12, int(duration_s * sample_rate_hz) + 1)
    times = np.linspace(0, duration_s, sample_count)
    values = np.zeros(sample_count)

    for start, end in speaking_segments:
        mask = (times >= start) & (times <= end)
        values[mask] += 0.18

    for viseme in tts_result.visemes:
        center = float(viseme.offset_ms) / 1000.0
        spread = max(0.04, float(viseme.duration_ms) / 1000.0 * 0.8)
        weight = _viseme_weight(int(viseme.viseme_id))
        values += weight * np.exp(-0.5 * ((times - center) / spread) ** 2)

    peak = float(np.max(values)) if len(values) > 0 else 0.0
    if peak > 0:
        values = values / peak

    return [
        {"time": round(float(t), 3), "value": round(_clamp(float(v), 0.0, 1.0), 4)}
        for t, v in zip(times.tolist(), values.tolist(), strict=False)
    ]


def _pick_emphasis_timestamps(
    energy_curve: list[dict[str, float]],
    *,
    min_peak: float,
    min_spacing: float,
) -> list[float]:
    if len(energy_curve) < 3:
        return []

    picks: list[float] = []
    last_pick = -10.0

    for idx in range(1, len(energy_curve) - 1):
        prev_v = float(energy_curve[idx - 1]["value"])
        curr_v = float(energy_curve[idx]["value"])
        next_v = float(energy_curve[idx + 1]["value"])
        curr_t = float(energy_curve[idx]["time"])

        if curr_v < min_peak:
            continue
        if curr_v < prev_v or curr_v < next_v:
            continue
        if curr_t - last_pick < min_spacing:
            continue

        picks.append(round(curr_t, 3))
        last_pick = curr_t

    return picks


def analyze_tts_for_animation(
    tts_result: TTSResult,
    mouth_cues: list[MouthCue],
    text: str,
) -> dict[str, object]:
    """Extract compact audio features for semantic + motion fusion."""
    duration_s = max(0.1, float(tts_result.audio_duration_ms) / 1000.0)
    speaking_segments = _speaking_segments_from_cues(mouth_cues, duration_s)

    if not speaking_segments and text.strip():
        speaking_segments = [(0.0, duration_s)]

    pause_segments = _pause_segments_from_speaking(speaking_segments, duration_s, min_gap=0.12)
    energy_curve = _build_energy_curve(tts_result, speaking_segments, duration_s)
    emphasis_timestamps = _pick_emphasis_timestamps(
        energy_curve,
        min_peak=0.62,
        min_spacing=0.18,
    )

    speaking_duration = sum(max(0.0, end - start) for start, end in speaking_segments)
    word_count = len(tts_result.word_boundaries)
    if word_count == 0:
        word_count = len([w for w in text.split() if w.strip()])

    speech_rate_wps = word_count / max(
        0.2, speaking_duration if speaking_duration > 0 else duration_s
    )
    peak_energy = max((float(point["value"]) for point in energy_curve), default=0.0)

    return {
        "duration_s": round(duration_s, 3),
        "speech_rate_wps": round(speech_rate_wps, 3),
        "peak_energy": round(peak_energy, 4),
        "speaking_segments": [
            {"start_time": round(start, 3), "end_time": round(end, 3)}
            for start, end in speaking_segments
        ],
        "pause_segments": [
            {"start_time": round(start, 3), "end_time": round(end, 3)}
            for start, end in pause_segments
        ],
        "emphasis_timestamps": emphasis_timestamps,
        "energy_curve": energy_curve,
    }
