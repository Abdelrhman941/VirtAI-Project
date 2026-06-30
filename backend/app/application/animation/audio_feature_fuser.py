from typing import Any


class AudioFeatureFuser:
    @staticmethod
    def clamp(value: float, low: float, high: float) -> float:
        return max(low, min(high, value))

    def normalize_time_segments(
        self, raw_segments: Any, duration_s: float
    ) -> list[dict[str, float]]:
        if not isinstance(raw_segments, list):
            return []

        normalized: list[dict[str, float]] = []
        for item in raw_segments:
            if not isinstance(item, dict):
                continue

            start = item.get("start_time")
            end = item.get("end_time")
            if not isinstance(start, float | int) or not isinstance(end, float | int):
                continue

            s = self.clamp(float(start), 0.0, duration_s)
            e = self.clamp(float(end), 0.0, duration_s)
            if e - s <= 0:
                continue
            normalized.append({"start_time": s, "end_time": e})

        normalized.sort(key=lambda seg: seg["start_time"])
        return normalized

    def normalize_energy_curve(self, raw_curve: Any, duration_s: float) -> list[dict[str, float]]:
        if not isinstance(raw_curve, list):
            return []

        normalized: list[dict[str, float]] = []
        for point in raw_curve:
            if not isinstance(point, dict):
                continue
            t = point.get("time")
            v = point.get("value")
            if not isinstance(t, float | int) or not isinstance(v, float | int):
                continue

            normalized.append(
                {
                    "time": self.clamp(float(t), 0.0, duration_s),
                    "value": self.clamp(float(v), 0.0, 1.0),
                }
            )

        normalized.sort(key=lambda p: p["time"])
        return normalized

    def normalize_emphasis(self, raw_marks: Any, duration_s: float) -> list[float]:
        if not isinstance(raw_marks, list):
            return []

        marks: list[float] = []
        for mark in raw_marks:
            if not isinstance(mark, float | int):
                continue
            marks.append(round(self.clamp(float(mark), 0.0, duration_s), 3))
        marks.sort()
        return marks

    def allocate_segment_windows(
        self, segments: list[str], duration_s: float
    ) -> list[tuple[float, float]]:
        if not segments:
            return []

        weights: list[float] = []
        for segment in segments:
            words = max(1, len(segment.split()))
            punctuation_boost = segment.count("!") * 0.35 + segment.count("?") * 0.25
            weights.append(words + punctuation_boost)

        total = sum(weights) or float(len(segments))
        windows: list[tuple[float, float]] = []
        cursor = 0.0

        for idx, weight in enumerate(weights):
            share = duration_s * (weight / total)
            if idx == len(weights) - 1:
                end = duration_s
            else:
                end = self.clamp(cursor + share, 0.0, duration_s)

            if end - cursor < 0.06:
                end = self.clamp(cursor + 0.06, 0.0, duration_s)

            windows.append((round(cursor, 4), round(end, 4)))
            cursor = end

        if windows:
            start, _ = windows[-1]
            windows[-1] = (start, duration_s)

        return windows

    def average_energy(
        self, energy_curve: list[dict[str, float]], start_time: float, end_time: float
    ) -> float:
        if not energy_curve:
            return 0.5

        values = [
            float(point["value"])
            for point in energy_curve
            if start_time <= float(point["time"]) <= end_time
        ]
        if not values:
            return 0.5
        return sum(values) / len(values)
