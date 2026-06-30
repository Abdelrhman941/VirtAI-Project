"""Unit tests for Batch 4 — Docker health check interval configuration.

These tests verify:
1. docker-compose.yml backend healthcheck interval is >= 10s (not 2s).
2. backend healthcheck start_period is >= 10s (enough time for startup).
3. postgres/redis intervals are >= 5s (DB doesn't need sub-second polling).
4. tts interval is >= 10s.
5. worker interval is >= 10s.
"""

from __future__ import annotations

from pathlib import Path

import pytest

COMPOSE_PATH = Path(__file__).resolve().parents[3] / "docker-compose.yml"


def _parse_interval_seconds(interval_str: str) -> int:
    """Parse a docker-compose duration string like '30s' or '1m30s' to seconds."""
    import re

    total = 0
    for match in re.finditer(r"(\d+)([smh])", interval_str):
        value, unit = int(match.group(1)), match.group(2)
        if unit == "s":
            total += value
        elif unit == "m":
            total += value * 60
        elif unit == "h":
            total += value * 3600
    return total


def _load_compose() -> dict:
    import yaml

    with COMPOSE_PATH.open() as f:
        return yaml.safe_load(f)


class TestHealthCheckIntervals:
    def test_compose_file_exists(self) -> None:
        assert COMPOSE_PATH.exists(), f"docker-compose.yml not found at {COMPOSE_PATH}"

    def test_backend_interval_at_least_10s(self) -> None:
        compose = _load_compose()
        hc = compose["services"]["backend"].get("healthcheck", {})
        interval = hc.get("interval", "0s")
        secs = _parse_interval_seconds(interval)
        assert secs >= 10, (
            f"backend healthcheck interval is {interval} ({secs}s) — "
            "should be >= 10s to reduce log spam"
        )

    def test_backend_start_period_at_least_10s(self) -> None:
        compose = _load_compose()
        hc = compose["services"]["backend"].get("healthcheck", {})
        start_period = hc.get("start_period", "0s")
        secs = _parse_interval_seconds(start_period)
        assert secs >= 10, (
            f"backend start_period is {start_period} ({secs}s) — "
            "should be >= 10s to allow startup"
        )

    def test_postgres_interval_at_least_5s(self) -> None:
        compose = _load_compose()
        hc = compose["services"]["postgres"].get("healthcheck", {})
        interval = hc.get("interval", "0s")
        secs = _parse_interval_seconds(interval)
        assert secs >= 5, (
            f"postgres healthcheck interval is {interval} ({secs}s) — "
            "should be >= 5s"
        )

    def test_redis_interval_at_least_5s(self) -> None:
        compose = _load_compose()
        hc = compose["services"]["redis"].get("healthcheck", {})
        interval = hc.get("interval", "0s")
        secs = _parse_interval_seconds(interval)
        assert secs >= 5, (
            f"redis healthcheck interval is {interval} ({secs}s) — "
            "should be >= 5s"
        )

    def test_tts_interval_at_least_10s(self) -> None:
        compose = _load_compose()
        hc = compose["services"]["tts"].get("healthcheck", {})
        interval = hc.get("interval", "0s")
        secs = _parse_interval_seconds(interval)
        assert secs >= 10, (
            f"tts healthcheck interval is {interval} ({secs}s) — "
            "should be >= 10s"
        )

    def test_worker_interval_at_least_10s(self) -> None:
        compose = _load_compose()
        hc = compose["services"]["worker"].get("healthcheck", {})
        interval = hc.get("interval", "0s")
        secs = _parse_interval_seconds(interval)
        assert secs >= 10, (
            f"worker healthcheck interval is {interval} ({secs}s) — "
            "should be >= 10s"
        )

    def test_no_2s_intervals_in_prod_services(self) -> None:
        """No prod service should have a 2-second healthcheck interval."""
        compose = _load_compose()
        violations = []
        for svc_name, svc in compose.get("services", {}).items():
            hc = svc.get("healthcheck", {})
            interval = hc.get("interval", "")
            if interval:
                secs = _parse_interval_seconds(interval)
                if secs < 5:
                    violations.append(f"{svc_name}: {interval} ({secs}s)")
        assert not violations, (
            f"Services with too-frequent healthcheck intervals: {violations}"
        )
