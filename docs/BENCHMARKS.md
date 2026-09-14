# ProjectBase Benchmarks — v1.0 published run

> **Measured:** 2026-08-24 · ProjectBase (PocketBase 0.39.11, single binary) ·
> harness: `scripts/bench/bench.py` (stdlib-only, reproducible).
> **Reproduce:** `python3 scripts/bench/bench.py --issues 10000 --cold-starts 5 --query-runs 30 --json bench.json`

## Environment

- CPU: AMD Ryzen 9 8945HX · RAM: 28.6 GB · Kernel: 7.0.0-28-generic (Linux x86_64)
- Storage: NVMe. All latency numbers are localhost HTTP (client-side), so they
  include ~0.5–1 ms of TCP/HTTP overhead per request.

## Headline numbers (10,000 issues, single process)

| Metric | Result |
|---|---|
| RAM, idle after boot | **50.2 MB** |
| RAM, after 10k issues + query workload | **98.1 MB** |
| Cold start, fresh data dir (incl. all JS migrations) | **96 ms** |
| Cold start, existing data dir (median of 4) | **36 ms** |
| Sustained issue writes via public REST API | **2,692 writes/s** |

## Query latency at 10,000 issues (p50 / p95, 30 runs each)

| Query | p50 | p95 |
|---|---|---|
| Board/list view — one project, `sort=order,-created`, 50/page (uses `idx_issues_project_order`) | **2.0 ms** | 3.1 ms |
| Filtered `status='todo' && priority='high'`, 50/page | 2.8 ms | 4.8 ms |
| Title substring search `title~'regression'` (~10% hit rate) | 3.9 ms | 5.7 ms |
| Count of project issues | 1.1 ms | 1.3 ms |
| Worst case: global `sort=-created` across all projects, no filter | 45.1 ms | 47.6 ms |

The worst case is included on purpose: a cross-project sort with no filter. It
now has a covering index (`idx_issues_created`, migration `1710000017`), which
dropped its p50 from 62.5 ms → 45.1 ms at 10k issues. Every view the UI
actually renders is project-scoped and lands in single-digit milliseconds at
10k issues.

> **Historical note:** the FastMCP JSON-RPC agent-lifecycle benchmarks
> (`scripts/bench/agent_workflow_bench.py`, measured 2026-08-27) were removed
> together with the stripped engine hooks (`91_mcp_server.pb.js`), which the
> FastMCP endpoint depended on. Numbers were: `list_projects` p50 0.9 ms,
> `create_issue` 1.6 ms, `move_issue` 1.2 ms, `add_comment` 1.0 ms, idle RAM
> 54.2 MB, warm boot 41.5 ms. The harness lives on the `engine-experiments`
> branch and returns with the engines if they are ever reinstated.

## Comparison: Plane CE (cited, not re-measured here)

ProjectBase numbers above are **measured on this host**. Plane CE numbers below
are **Plane's own published requirements**, not measurements on identical
hardware — treat the RAM row as "what the vendor says you need", not a
same-hardware A/B.

| | ProjectBase (measured) | Plane CE (official docs) |
|---|---|---|
| Minimum RAM | **50 MB** idle process; 98 MB with 10k issues | **4 GB** minimum, 8 GB recommended for production |
| CPU | 1 core, one process | 2 cores |
| Runtime shape | 1 static binary + SQLite file | Docker Compose: **13 containers** — web, space, admin, api, worker, beat-worker, live, migrator, proxy, PostgreSQL, Redis, RabbitMQ, MinIO |
| Cold start | 36–96 ms (binary start to first 200) | Not published; multi-container orchestration start |

Sources (fetched 2026-08-24):

1. Plane system requirements — CPU 2 cores, RAM 4 GB (8 GB recommended):
   <https://developers.plane.so/self-hosting/methods/overview>
2. Plane CE community docker-compose service list:
   <https://github.com/makeplane/plane/blob/preview/deployments/cli/community/docker-compose.yml>
   (13 service containers: admin, api, beat-worker, live, migrator, plane-db,
   plane-minio, plane-mq, plane-redis, proxy, space, web, worker)

## Methodology notes & honest caveats

- The harness never touches the live instance: it boots an isolated scratch
  PocketBase on a random localhost port with its own `pb_data`, seeds via the
  public REST API as a normal superuser client (8 concurrent writers), verifies
  the seeded count before timing, then measures and tears everything down.
- Cold start = wall time from process spawn to first HTTP 200 from
  `/api/health`. "Fresh dir" includes applying every JS migration on an empty
  database; "warm dir" boots the already-migrated database.
- RAM is `VmRSS` from `/proc/<pid>/status` — resident set of the single
  ProjectBase process. Plane CE's figure is a vendor-stated *requirement* for
  the whole compose stack, not an RSS measurement; the comparison is about
  order of magnitude (single ~100 MB process vs multi-GB, multi-container
  stack), not a controlled benchmark.
- Query percentiles: one warmup run excluded, then 30 timed runs per case;
  p50 = median, p95 = 20-quantile method (max when fewer than 20 samples).
- Single-user, single-host workload. No concurrent-read contention, no network
  latency. Your numbers will differ on other hardware — run the harness.

## Raw result

Machine-readable output is committed at
[`docs/research/bench/bench-10k-2026-08-24.json`](research/bench/bench-10k-2026-08-24.json)
(pre-index baseline) and
[`docs/research/bench/bench-10k-2026-08-24-postindex.json`](research/bench/bench-10k-2026-08-24-postindex.json)
(post-index, migration `1710000017`). The post-index run measured the
worst-case global sort at **45.07 ms p50 / 47.62 ms p95** (30 runs), consistent with the
45.1 ms headline above.
