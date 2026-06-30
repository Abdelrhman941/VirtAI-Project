# VirtAI Quality & Observability Dashboard (Grafana)

This dashboard tracks the RAG architecture's performance, stability, and A/B shadow testing discrepancies using Prometheus metrics.

## PromQL Queries

### 1. RAG Requests Throughput (QPS)
Calculates the rate of incoming RAG requests over the last 5 minutes, grouped by `task_type` and `locale`.
```promql
sum by (task_type, locale) (rate(rag_requests_total[5m]))
```

### 2. RAG Error Rate (%)
Measures the percentage of failed RAG queries relative to total requests.
```promql
sum(rate(rag_errors_total[5m])) / sum(rate(rag_requests_total[5m])) * 100
```

### 3. RAG p95 Latency
Calculates the 95th percentile latency of RAG queries across the entire corpus.
```promql
histogram_quantile(0.95, sum by (le, task_type) (rate(rag_latency_seconds_bucket[5m])))
```

### 4. Active Concurrent Requests
Tracks the current load on the Use Cases.
```promql
sum by (task_type) (rag_active_requests)
```

---

## Mock Grafana Dashboard (ASCII Representation)

```text
+-----------------------------------------------------------------------------+
| VirtAI RAG Observability Dashboard                                  [Last 1h] |
+-----------------------------------------------------------------------------+
| [RAG Error Rate]          | [p95 Latency]          | [Active Requests]      |
|                           |                        |                        |
|          0.00%            |        2.14s           |           8            |
|       (Target: <1%)       |     (Target: <4s)      |     (Capacity: 50)     |
+-----------------------------------------------------------------------------+
| RAG Throughput by Task Type (QPS)                                           |
| 10 +   /\                                                                   |
|    |  /  \/\   _--__    [chat: 6.2 qps]                                     |
|  5 + /      \ /     \   [explain: 2.1 qps]                                  |
|    |/        V       \  [quiz: 0.8 qps]                                     |
|  0 +-------------------------------------                                   |
|    12:00    12:15    12:30    12:45    13:00                                |
+-----------------------------------------------------------------------------+
| p95 Latency by Locale (Seconds)                                             |
| 4s +                                                                        |
|    |          __                                                            |
| 2s +   /\    /  \      [en: 1.8s]                                           |
|    |  /  \/\/    \     [ar: 2.4s]                                           |
| 0s +-------------------------------------                                   |
|    12:00    12:15    12:30    12:45    13:00                                |
+-----------------------------------------------------------------------------+
```

## A/B Shadow Testing Logs
The A/B shadow results are not stored in Prometheus due to cardinality constraints (to avoid blowing up TSDB with raw strings). Instead, they are securely rotated and stored via `SizedTimedRotatingFileHandler`.

**Log Location:** `/var/log/rag_ab.log`

Logs can be ingested by Promtail and viewed inside Grafana Loki to compare `"new_path.response"` vs `"legacy_path.response"`.
