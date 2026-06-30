from prometheus_client import Counter, Gauge, Histogram

# Auth & Session Metrics
auth_login_attempts = Counter(
    "virtai_auth_login_attempts_total", "Total login attempts", ["status", "provider"]
)

auth_login_failures = Counter(
    "virtai_auth_login_failures_total", "Total login failures", ["reason"]
)

auth_refresh_rotations = Counter(
    "virtai_auth_refresh_rotations_total", "Total refresh token rotations", ["status"]
)

auth_token_revocations = Counter(
    "virtai_auth_token_revocations_total", "Total tokens blacklisted or revoked", ["reason"]
)

# Rate Limiting
rate_limit_hits = Counter("virtai_rate_limit_hits_total", "Total rate limit breaches", ["scope"])

# WebSocket connection health
ws_connections_active = Gauge(
    "virtai_ws_connections_active",
    "Currently active websocket connections",
)

ws_connection_drops = Counter(
    "virtai_ws_connection_drops_total", "Total abnormal WS disconnects", ["reason"]
)

# Latency & Database
db_query_duration = Histogram(
    "virtai_db_query_duration_seconds", "Database query latency", ["operation"]
)

redis_operation_duration = Histogram(
    "virtai_redis_operation_duration_seconds", "Redis operation latency", ["operation"]
)
# Counters
RAG_REQUESTS_TOTAL = Counter(
    "rag_requests_total", "Total number of RAG requests", ["task_type", "locale"]
)

RAG_ERRORS_TOTAL = Counter(
    "rag_errors_total", "Total number of RAG errors", ["task_type", "locale"]
)

# Histograms
RAG_LATENCY_SECONDS = Histogram(
    "rag_latency_seconds",
    "Latency of RAG requests in seconds",
    ["task_type", "locale"],
    buckets=[0.5, 1.0, 2.0, 3.0, 4.0, 5.0, 10.0],
)

# Gauges
RAG_ACTIVE_REQUESTS = Gauge(
    "rag_active_requests", "Currently active RAG requests", ["task_type", "locale"]
)
