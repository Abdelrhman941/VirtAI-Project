from __future__ import annotations

import os
import sys
from pathlib import Path
from types import ModuleType

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ["DEBUG"] = "False"
os.environ.setdefault("ENVIRONMENT", "development")

try:
    import prometheus_client  # noqa: F401
except ModuleNotFoundError:

    class _Metric:
        def __init__(self, *args, **kwargs) -> None:
            pass

        def labels(self, *args, **kwargs):
            return self

        def inc(self, *args, **kwargs) -> None:
            pass

        def dec(self, *args, **kwargs) -> None:
            pass

        def observe(self, *args, **kwargs) -> None:
            pass

    prometheus_stub = ModuleType("prometheus_client")
    prometheus_stub.Counter = _Metric
    prometheus_stub.Gauge = _Metric
    prometheus_stub.Histogram = _Metric
    sys.modules["prometheus_client"] = prometheus_stub
