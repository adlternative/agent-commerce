---
title: App deployment
description: Self-host Agent Commerce — compose, gateway, observability, backup, free-tier costs
---

# Deployment runbook

Default path: **self-host + free tier only** (no paid SaaS, no paid domain required). Decisions and scale bounds: [INFRA.md](./INFRA.md). Day-2 ops: [RUNBOOK.md](./RUNBOOK.md).

> Docs-site (VitePress) hosting is separate: see [部署（文档站）](/deploy).

## Quick start (existing compose)

```bash
export JWT_SECRET="$(openssl rand -hex 32)"
# optional local demos only:
# export ALLOW_DEMO_TOKENS=1
docker compose up --build -d

curl -sS http://127.0.0.1:8787/healthz
curl -sS http://127.0.0.1:8787/metrics | head
curl -sS http://127.0.0.1:8787/   # Vite dist via STATIC_DIR
```

Facts from the repo:

- **Compose** (`docker-compose.yml`): `NODE_ENV=production`, `DATA_DIR=/app/data`, volume `commerce-data`, `init: true`, healthcheck via Node `fetch` → `/healthz`.
- **JWT fail-closed:** compose uses `${JWT_SECRET:?Set JWT_SECRET — …}` (no insecure default). Runtime: `resolveJwtSecret` throws `MissingJwtSecretError` when `NODE_ENV=production` and `JWT_SECRET` is unset (`src/server/auth.ts` → `src/server/index.ts` exits 1). `ALLOW_DEMO_TOKENS` defaults to `0`.
- **SQLite path:** `$DATA_DIR/commerce.sqlite` unless `DATA_PATH` is set (`src/repo/data-dir.ts`).
- **Metrics:** `GET /metrics` Prometheus text 0.0.4 (`src/server/metrics.ts`, routed in `src/server/router.ts`).
- **Logs:** structured JSON lines on stdout (`src/server/logger.ts`).

## Red line — SQLite single-instance only

Ship **one** API writer. Do not multi-replica against one SQLite file. Move to Postgres when you need shared storage across replicas, managed HA/PITR, or write load beyond one process — adapter **尚未实现** (see [INFRA.md](./INFRA.md)).

## Gateway (front proxy)

### Why put a proxy in front?

The Node process can bind `0.0.0.0:8787` and serve API + static, but a front proxy still helps for:

- TLS termination (Let’s Encrypt or tunnel) without baking certs into the app image
- HTTP → HTTPS redirect, HSTS, compression, request size limits
- Hiding `/metrics` from the public internet (scrape on a private network only)
- Future multi-upstream routing (medium topology — **尚未实现** for multi-replica)

### Comparison (free / self-host)

| Option | Pros | Cons | Free tier notes |
|--------|------|------|-----------------|
| **Caddy** (pick) | Auto-HTTPS, tiny Caddyfile, good defaults | Fewer “enterprise” knobs than Nginx | Fully free OSS; needs a hostname for public LE certs (can use free DDNS) |
| Nginx | Ubiquitous, fine-grained | Manual TLS / renewals unless certbot | Free OSS; compose snippet commented in `docker-compose.yml` but **`docker/nginx.conf` 尚未实现** |
| Traefik | Docker label routing, LE built-in | Heavier; more moving parts for one service | Free OSS |
| Cloudflare (free) | CDN, DDoS, optional Tunnel (no open ports) | External dependency; Tunnel config outside repo | Free plan usable; **paid domains not required** if you use Tunnel + local hostname or a free DDNS |

### Pick: Caddy (shipped)

In-repo files:

| File | Role |
|------|------|
| [`deploy/Caddyfile`](../../deploy/Caddyfile) | `api.{$DOMAIN}` → `api:8787`; optional `mcp.{$DOMAIN}` → `mcp:8790`; `encode zstd gzip`; security headers; body size limit; **public `/metrics` → 404** |
| [`deploy/docker-compose.caddy.yml`](../../deploy/docker-compose.caddy.yml) | Caddy as a compose service |
| [`deploy/.env.example`](../../deploy/.env.example) | `JWT_SECRET`, `DOMAIN`, `ACME_EMAIL`, `ALLOW_DEMO_TOKENS=0` + how to generate each |

```bash
cp deploy/.env.example deploy/.env   # fill real values (placeholders only in git)
set -a && source deploy/.env && set +a
docker compose -f docker-compose.yml -f deploy/docker-compose.caddy.yml up --build -d
```

Lab without DNS: set `tls internal` in the site block, or skip Caddy and hit `:8787` directly (single topology).

**MCP HTTP** is **not** public by default (no `mcp` service in root compose). To expose: run MCP on **8790** as a second service, point `mcp.$DOMAIN` (already in the Caddyfile), and keep **separate edge auth** in addition to app JWT. See [RUNBOOK.md](./RUNBOOK.md) and [`deploy/README-fly.md`](../../deploy/README-fly.md).

## Fly.io (shipped)

| File | Role |
|------|------|
| [`deploy/fly.toml`](../../deploy/fly.toml) | Single instance; `internal_port = 8787`; `[mounts]` → `/app/data`; `DATA_DIR` / `STATIC_DIR`; `min_machines_running = 1`; health `/healthz`; **no** `JWT_SECRET` in toml |
| [`deploy/README-fly.md`](../../deploy/README-fly.md) | Zero-to-live: launch → volume → secrets → deploy → verify |

## Observability

### Already in the app

- `GET /metrics` — counters/sums: `http_requests_total`, `http_request_duration_ms_sum`, `http_request_duration_ms_count` (path cardinality capped for unmatched routes).
- Structured logs — JSON on stdout; correlate with `X-Trace-Id` / `traceId`.
- `GET /healthz`, `GET /readyz` — liveness / SQLite readiness.

### Prometheus + Grafana (shipped overlay)

| File | Role |
|------|------|
| [`deploy/docker-compose.observability.yml`](../../deploy/docker-compose.observability.yml) | Prometheus + Grafana; scrape `api:8787/metrics`; ports bound to `127.0.0.1` |
| [`deploy/prometheus.yml`](../../deploy/prometheus.yml) | Minimal scrape config |
| [`deploy/grafana/provisioning/datasources/prometheus.yml`](../../deploy/grafana/provisioning/datasources/prometheus.yml) | Provisioned Prometheus datasource |

```bash
export JWT_SECRET="$(openssl rand -hex 32)"
docker compose -f docker-compose.yml -f deploy/docker-compose.observability.yml up --build -d
```

**`/metrics` must not be public** — align with Caddyfile (404 on `api.$DOMAIN/metrics`). Scrape only on the compose network or localhost.

JSON logs: use `docker compose logs -f api` or ship stdout to any free log stack later. **尚未实现:** log shipper / Loki / Alertmanager wiring.

## Backup & migrate

### SQLite backup (shipped scripts)

| File | Role |
|------|------|
| [`deploy/backup.sh`](../../deploy/backup.sh) | `sqlite3 .backup` via toolbox image (runtime is apt-free); timestamped files; retain N; non-zero on failure; cron-callable |
| [`deploy/restore.sh`](../../deploy/restore.sh) | Restore named backup; safety backup first; post-restore `/readyz` (fallback `/healthz`) |
| [`deploy/crontab.example`](../../deploy/crontab.example) | One daily cron line |

```bash
./deploy/backup.sh
./deploy/restore.sh commerce-YYYYMMDDThhmmssZ.sqlite
```

Prefer these scripts over ad-hoc `copyFileSync`. Manual host-side copy remains possible for emergencies.

### Path to Postgres

1. Keep SQLite until INFRA bounds say otherwise.
2. Export logical dump (products/orders/…) — today: read via API or copy SQLite file. **尚未实现:** first-class `pg_dump`-style export CLI.
3. Add a Postgres `CommerceRepository` adapter (same port as `SqliteRepository`) — **尚未实现**.
4. Cut over behind `STORE_BACKEND` / connection URL env — **尚未实现** (today: `sqlite` | `json` only).
5. JSON → SQLite one-shot already exists (`migrateJsonToSqlite` / `npm run migrate`); treat Postgres as a **new** migration family, not an extension of the JSON importer.

## Cost table (free-tier capable)

Rows marked **free-tier capable** run at $0 cash cost when you use OSS + your own machine / free cloud allowances. Paid rows are optional upgrades — not required by this guide.

| Component | Default | Free-tier capable? | Notes |
|-----------|---------|--------------------|-------|
| API + SPA container | Required | **Yes** | Build from this repo; any free VM / laptop / free-tier VPS |
| SQLite on volume | Required | **Yes** | Local disk / named Docker volume / Fly volume |
| Caddy | Optional (small+) | **Yes** | OSS; `deploy/docker-compose.caddy.yml` |
| Nginx / Traefik | Alternative | **Yes** | OSS; not required; `docker/nginx.conf` **尚未实现** |
| Cloudflare proxy / Tunnel | Optional | **Yes** (free plan) | No paid domain required for Tunnel lab setups |
| Prometheus | Optional | **Yes** | `deploy/docker-compose.observability.yml`; localhost-bound |
| Grafana | Optional | **Yes** | Provisioned datasource; change admin password |
| MinIO | Only with blobs | **Yes** (self-host) | **尚未实现** in app; skip until needed |
| S3-compatible SaaS | Optional | Sometimes free tier | Prefer MinIO self-host to stay $0 |
| Postgres | Medium topology | Self-host **Yes** / managed often paid | **尚未实现** adapter |
| Redis | Multi-replica only | **Yes** (self-host) | **尚未实现**; unnecessary on single node |
| Paid CDN / paid DB / paid domain | — | **No** | Out of default scope |

## Checklist

- [ ] `JWT_SECRET` set (strong random); demos off unless `ALLOW_DEMO_TOKENS=1`
- [ ] Persist `DATA_DIR` / compose volume / Fly `ac_data`; confirm `/readyz`
- [ ] Do not run multiple writers on one SQLite file
- [ ] If public: Caddy (or Tunnel) in front; block public `/metrics`
- [ ] Run `./deploy/backup.sh` before upgrades; install `deploy/crontab.example` when durable
- [ ] Add Prometheus/Grafana overlay only when you will look at dashboards
