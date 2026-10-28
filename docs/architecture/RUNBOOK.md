---
title: Ops runbook
description: First deploy, day-2 release/rollback, troubleshooting, backup drill
---

# Ops runbook (ACP-38)

Executable kit lives under [`deploy/`](https://github.com/adlternative/agent-commerce/tree/main/deploy). Architecture bounds: [INFRA.md](./INFRA.md). Longer context: [DEPLOYMENT.md](./DEPLOYMENT.md).

**Cited defaults from this repo:** API `PORT`/`internal_port` **8787**, `DATA_DIR=/app/data` → `$DATA_DIR/commerce.sqlite`, `STATIC_DIR=/app/dist`, probes `GET /healthz` + `GET /readyz`, metrics `GET /metrics`, discovery `/.well-known/ai-commerce.json`, OpenAPI `/openapi.json`. MCP Streamable HTTP optional on **8790** (not in default compose).

## Red line — SQLite single-instance only

- **One** Node API process may write the SQLite file. Compose and Fly configs are single-replica on purpose (`min_machines_running = 1`, one `api` service).
- Do **not** scale `api` replicas, enable multi-machine autoscale, or attach two writers to the same volume.
- **Move to Postgres** when you need multiple API replicas, managed HA / PITR, or write concurrency beyond one process + WAL (see [INFRA.md § When Postgres](./INFRA.md#when-postgres)). Postgres adapter is **尚未实现**.

## First deploy

### A. Local / VPS compose (API only)

```bash
export JWT_SECRET="$(openssl rand -hex 32)"
# ALLOW_DEMO_TOKENS stays 0 for anything reachable from the internet
docker compose up --build -d
curl -sS http://127.0.0.1:8787/healthz
curl -sS http://127.0.0.1:8787/openapi.json | head -c 80; echo
curl -sS http://127.0.0.1:8787/.well-known/ai-commerce.json | head -c 80; echo
```

### B. VPS + Caddy (+ optional observability)

```bash
cp deploy/.env.example deploy/.env   # fill JWT_SECRET, DOMAIN, ACME_EMAIL
set -a && source deploy/.env && set +a
docker compose -f docker-compose.yml \
  -f deploy/docker-compose.caddy.yml \
  -f deploy/docker-compose.observability.yml up --build -d
```

- Public: `https://api.$DOMAIN` → `api:8787` (Caddy). `/metrics` returns **404** on the public host; Prometheus scrapes `http://api:8787/metrics` on the compose network.
- Grafana/Prometheus bind **127.0.0.1** only (`:3000` / `:9090`).
- Optional `mcp.$DOMAIN` is in the Caddyfile but MCP is **not** started by default — add a separate `mcp` service on **8790** + edge auth before pointing DNS.

### C. Fly.io

Follow [`deploy/README-fly.md`](../../deploy/README-fly.md): `fly launch --no-deploy` → `fly volumes create ac_data --size 1` → `fly secrets set JWT_SECRET=…` → `fly deploy` → verify `/healthz`, `/openapi.json`, `/.well-known/ai-commerce.json`.

## Day-2 operations

### Release

```bash
# Compose
docker compose -f docker-compose.yml build api && docker compose up -d api

# Fly
fly deploy --config deploy/fly.toml
```

### Rollback

- Compose: redeploy the previous image tag / git SHA (`docker compose pull` / rebuild from known-good commit). Restore SQLite only if the bad release migrated data — see backup drill.
- Fly: `fly releases --config deploy/fly.toml` then deploy the prior image.

### Logs

```bash
docker compose logs -f api          # structured JSON lines (src/server/logger.ts)
fly logs --config deploy/fly.toml
```

Correlate with `X-Trace-Id` / `traceId`.

## Troubleshooting

| Symptom | Likely cause | What to do |
|---------|--------------|------------|
| Unhealthy / restart loop | Missing `JWT_SECRET` in production | Compose refuses unset secret; Fly: `fly secrets list`. Process exits on `MissingJwtSecretError`. |
| `/readyz` fails, `/healthz` ok | SQLite not RW (`DATA_DIR` / volume) | Confirm volume mount `/app/data`, disk space, permissions. |
| Volume full | DB + WAL + backups filled disk | Prune `deploy/backups`, grow Fly volume / host disk, check WAL size. |
| JWT 401s | Wrong secret, expired token, demos off | Mint HS256 with current `JWT_SECRET`; `ALLOW_DEMO_TOKENS` must be `1` for opaque demo tokens (keep `0` in prod). Legacy public secrets → 401 by design. |
| SQLite locked / busy | Second writer or long transaction | Ensure **one** API instance; wait for `busy_timeout`; never multi-replica on one file. |
| Public `/metrics` 404 | Expected behind Caddy | Scrape on private network (`api:8787`) or localhost-bound Prometheus. |

## Backup drill

1. Take a backup: `./deploy/backup.sh` (uses `sqlite3 .backup` in a toolbox image; runtime image is apt-free).
2. Note the printed `commerce-*.sqlite` path under `deploy/backups/`.
3. Restore: `./deploy/restore.sh commerce-YYYYMMDDThhmmssZ.sqlite` — creates a safety backup first, replaces DB, restarts `api`, curls `/readyz` (fallback `/healthz`).
4. Schedule: install the line in `deploy/crontab.example` (daily).

**尚未实现:** volume snapshot automation beyond these scripts; Postgres dump/restore; log shipper / Loki / Alertmanager.
