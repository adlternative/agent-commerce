# Infrastructure decisions

Self-host + free-tier only by default. No paid SaaS, no paid domains required for the reference paths below.

Companion: [DEPLOYMENT.md](./DEPLOYMENT.md) (runbooks, gateway config, observability compose, backup).

## What exists today (cite code)

| Capability | Where |
|------------|--------|
| SQLite + `DATA_DIR` / `DATA_PATH` | `src/repo/data-dir.ts`, `src/repo/create-repository.ts` — default `$DATA_DIR/commerce.sqlite` (`DATA_DIR` → `./data`) |
| Single-process write safety | `src/repo/sqlite-repository.ts` — in-process mutex + `BEGIN IMMEDIATE`; WAL + `busy_timeout=5000` |
| Docker compose + volume | root `docker-compose.yml` — `DATA_DIR=/app/data`, named volume `commerce-data`, `init: true` |
| JWT fail-closed | `src/server/auth.ts` (`resolveJwtSecret` / `MissingJwtSecretError`); compose requires `${JWT_SECRET:?…}`; `ALLOW_DEMO_TOKENS` defaults to `0` |
| Prometheus `/metrics` | `src/server/metrics.ts` + `GET /metrics` in `src/server/router.ts` (text exposition 0.0.4) |
| Structured logs | `src/server/logger.ts` — one JSON line per event on stdout (`ts`, `level`, `msg`, `traceId`, …) |
| Probes | public `GET /healthz`, `GET /readyz` (SQLite RW check) |

## Storage

### SQLite bounds (supported)

SQLite is the **default and supported** production store for single-node deploys:

- One Node process owns the DB file under `DATA_DIR` (compose: `/app/data`).
- Oversell-safe for that one process (mutex + `BEGIN IMMEDIATE`).
- Suitable for demos, labs, and small shops where concurrent writers fit one API instance.

**Practical bounds (ops guidance, not hard-coded limits):**

| Dimension | Comfortable | Stretch / risk |
|-----------|-------------|----------------|
| API replicas writing the same file | **1** | >1 writers → lock contention / corruption risk |
| Concurrent HTTP clients | tens–low hundreds | high write QPS on one file |
| DB size on local disk / volume | GBs OK with WAL + backups | multi-tenant “platform” scale |
| Horizontal scale-out | no | need shared DB (**尚未实现**) |

### When Postgres

Move off SQLite when **any** of these become true:

1. You need **multiple API replicas** sharing one store.
2. You need managed HA, point-in-time recovery, or cross-AZ failover beyond file snapshots.
3. Write concurrency / lock wait exceeds what WAL + single process can absorb.

**尚未实现:** no Postgres (or other SQL) repository adapter. Path sketched in [DEPLOYMENT.md § Backup & migrate](./DEPLOYMENT.md#backup--migrate).

### Object store (MinIO / S3)

Today products/orders live in SQLite; the Vite SPA is baked into the image (`STATIC_DIR=/app/dist`). There is **no** product-image or attachment blob pipeline in-tree.

Use MinIO (self-host) or an S3-compatible free tier **only when** you add durable binary assets (images, invoices, export dumps). Until then, skip it.

**尚未实现:** object-store client, signed URLs, image upload APIs.

### Redis necessity

| Concern today | Implementation | Redis needed? |
|---------------|----------------|---------------|
| Rate limit | in-process token bucket (`src/ai/*`) | **No** on single node |
| Audit log | in-memory ring buffer (`src/ai/audit.ts`) | **No** (lost on restart; query APIs still work while up) |
| Sessions / cart | persisted in SQLite via domain repos | **No** |
| Multi-replica shared rate limit / audit | — | **Yes**, if/when you scale out |

**尚未实现:** Redis (or other shared cache) integration. Default deploy does **not** run Redis.

## Topologies (ASCII)

### Single (default — free, self-host)

```
                  +---------------------------+
  clients ------->| api (:8787)               |
  (browser/MCP)   |  + STATIC_DIR (Vite dist) |
                  |  + SQLite @ DATA_DIR      |
                  |  + /metrics /healthz      |
                  +---------------------------+
```

Matches root `docker-compose.yml` (one `api` service + `commerce-data` volume).

### Small (gateway + optional observability)

```
  clients --> [ Caddy :443 ] --> [ api + SQLite ]
                    |
                    +--> [ Prometheus ] --> [ Grafana ]
                         scrapes /metrics
```

Still one writer. Caddy terminates TLS; Prometheus/Grafana are optional compose sidecars (snippet in DEPLOYMENT.md). **尚未实现** as shipped compose services — copy the snippet locally.

### Medium (target; mostly 尚未实现)

```
  clients --> [ Caddy ] --> [ api × N ] ----+--> [ Postgres ]
                       \                   +--> [ MinIO/S3 ]   (blobs)
                        \                  +--> [ Redis ]      (rate limit / audit)
                         +--> [ Prometheus/Grafana ]
```

Requires Postgres adapter, shared rate-limit/audit, and sticky-or-stateless auth (JWT already is). **Do not run multiple API replicas against one SQLite file.**

## Default recommendation

1. **Ship single topology** with compose + required `JWT_SECRET`.
2. Add **Caddy** when you need TLS or a stable public hostname.
3. Add **Prometheus + Grafana** when you care about dashboards (app already exposes `/metrics` + JSON logs).
4. Defer Postgres / MinIO / Redis until the bounds above are hit — all marked **尚未实现** in code.
