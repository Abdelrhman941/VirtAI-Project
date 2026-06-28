# ARQ Queue Polling Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the unacceptable 32-second job pickup delay in the ARQ worker by optimizing polling frequency and fixing concurrent execution limits.

**Architecture:** We are adjusting the configuration attributes of the ARQ `WorkerSettings` class. The `poll_delay` will be dramatically reduced to `0.05s` for near-instant queue polling. Additionally, the incorrect `max_concurrency` setting will be renamed to the ARQ-supported `max_jobs` parameter, explicitly allowing CPU-bound concurrent ingestion without blocking. We've verified there are no artificial `_defer_by` delays in the enqueue logic.

**Tech Stack:** Python, ARQ (Redis Async Queue), FastAPI

---

### Task 1: Optimize Worker Settings for Low Latency Polling

**Files:**
- Modify: `backend/app/infrastructure/worker/arq_settings.py`

- [ ] **Step 1: Update ARQ `WorkerSettings` configuration**

The current configuration uses the default polling delay (0.5s) and specifies an invalid ARQ parameter (`max_concurrency`), which falls back to default limits and queues jobs unexpectedly. We will explicitly define `poll_delay` and fix the concurrency limit.

```python
from arq.connections import RedisSettings  # type: ignore[import-not-found]
from arq.cron import cron

from app.infrastructure.worker.ingestion_task import run_ingestion_task, sweep_stalled_jobs
from app.infrastructure.worker.worker_startup import worker_shutdown, worker_startup_validation
from app.shared.config import get_settings

settings = get_settings()


class WorkerSettings:
    functions = [run_ingestion_task]
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    max_tries = 3
    retry_backoff = True
    job_timeout = 600
    health_check_interval = 30
    
    # Replaced 'max_concurrency' with the valid ARQ property 'max_jobs'
    max_jobs = 2
    
    # Reduced polling delay from default 0.5s to 0.05s for near-instant pickup
    poll_delay = 0.05
    
    on_startup = worker_startup_validation
    on_shutdown = worker_shutdown
    queue_name = "ingestion"
    cron_jobs = [cron(sweep_stalled_jobs, minute=set(range(0, 60, 10)))]
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/infrastructure/worker/arq_settings.py
git commit -m "perf: optimize arq worker polling speed and concurrency limit"
```
