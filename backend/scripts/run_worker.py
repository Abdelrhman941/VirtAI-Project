import sys
from pathlib import Path

# Ensure the backend directory is in the path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from arq import run_worker  # type: ignore[import-not-found]

from app.infrastructure.worker.arq_settings import WorkerSettings

if __name__ == "__main__":
    run_worker(WorkerSettings)
