# Deployment runbook

Default path: **self-host + free tier only** (no paid SaaS, no paid domain required). Decisions and scale bounds: [INFRA.md](./INFRA.md).

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

### Pick: Caddy

Recommended for the small topology: one binary, automatic HTTPS when DNS points at the host.

Example `Caddyfile` (place beside compose; **not shipped in-repo — 尚未实现 as a compose service**):

```caddyfile
# Replace with your hostname, or use :443 with tls internal for lab-only.
{$ACP_HOST:localhost} {
  encode gzip

  # Keep Prometheus scraping off the public internet when possible.
  @metrics path /metrics
  respond @metrics 404

  reverse_proxy api:8787
}
```

Compose overlay idea (optional local file — **尚未实现** in root compose):

```yaml
services:
  caddy:
    image: caddy:2.8-alpine
    ports:
      - "80:80"
      - "443:443"
    environment:
      ACP_HOST: ${ACP_HOST:-localhost}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
    depends_on:
      api:
        condition: service_healthy

volumes:
  caddy-data:
```

Lab without DNS: set `tls internal` in the site block, or skip Caddy and hit `:8787` directly (single topology).

## Observability

### Already in the app

- `GET /metrics` — counters/sums: `http_requests_total`, `http_request_duration_ms_sum`, `http_request_duration_ms_count` (path cardinality capped for unmatched routes).
- Structured logs — JSON on stdout; correlate with `X-Trace-Id` / `traceId`.
- `GET /healthz`, `GET /readyz` — liveness / SQLite readiness.

### Prometheus + Grafana compose snippet

**尚未实现** as part of the default `docker-compose.yml`. Copy locally when needed (free OSS images only):

```yaml
# compose.observability.yml — docker compose -f docker-compose.yml -f compose.observability.yml up -d
services:
  prometheus:
    image: prom/prometheus:v2.54.1
    volumes:
      - ./deploy/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prom-data:/prometheus
    # Bind to localhost only; scrape api on the compose network.
    ports:
      - "127.0.0.1:9090:9090"
    depends_on:
      api:
        condition: service_healthy

  grafana:
    image: grafana/grafana:11.2.0
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-admin}
      GF_USERS_ALLOW_SIGN_UP: "false"
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - grafana-data:/var/lib/grafana
    depends_on:
      - prometheus

volumes:
  prom-data:
  grafana-data:
```

Example `deploy/prometheus.yml` (**尚未实现** in-tree — create beside the overlay):

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: agent-commerce
    metrics_path: /metrics
    static_configs:
      - targets: ["api:8787"]
```

JSON logs: use `docker compose logs -f api` or ship stdout to any free log stack later. **尚未实现:** log shipper / Loki / Alertmanager wiring.

## Backup & migrate

### SQLite backup (supported ops pattern)

With the API briefly quiet (or accepting that WAL may need a checkpoint):

```bash
# volume is mounted at /app/data inside the container
docker compose exec api \
  node -e "const fs=require('fs');fs.copyFileSync('/app/data/commerce.sqlite','/app/data/commerce.sqlite.bak')"

# or host-side after locating the named volume
docker run --rm -v agent-commerce_commerce-data:/data -v "$PWD:/out" alpine \
  cp /data/commerce.sqlite /out/commerce-$(date +%F).sqlite
```

Prefer `sqlite3 .backup` when the `sqlite3` CLI is available on an admin image; the runtime image intentionally has **no apt** (see `Dockerfile`), so use a sidecar/toolbox container for CLI tools.

Restore: stop API → replace `commerce.sqlite` (+ drop stale `-wal`/`-shm` if present) → start API → `curl /readyz`.

**尚未实现:** scheduled backup job, retention policy, or volume snapshot automation in compose.

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
| SQLite on volume | Required | **Yes** | Local disk / named Docker volume |
| Caddy | Optional (small+) | **Yes** | OSS; public LE needs a hostname (free DDNS OK) |
| Nginx / Traefik | Alternative | **Yes** | OSS; not required |
| Cloudflare proxy / Tunnel | Optional | **Yes** (free plan) | No paid domain required for Tunnel lab setups |
| Prometheus | Optional | **Yes** | OSS image; keep scrape port localhost-bound |
| Grafana | Optional | **Yes** | OSS image; change admin password |
| MinIO | Only with blobs | **Yes** (self-host) | **尚未实现** in app; skip until needed |
| S3-compatible SaaS | Optional | Sometimes free tier | Prefer MinIO self-host to stay $0 |
| Postgres | Medium topology | Self-host **Yes** / managed often paid | **尚未实现** adapter |
| Redis | Multi-replica only | **Yes** (self-host) | **尚未实现**; unnecessary on single node |
| Paid CDN / paid DB / paid domain | — | **No** | Out of default scope |

## Checklist

- [ ] `JWT_SECRET` set (strong random); demos off unless `ALLOW_DEMO_TOKENS=1`
- [ ] Persist `DATA_DIR` / compose volume; confirm `/readyz`
- [ ] Do not run multiple writers on one SQLite file
- [ ] If public: Caddy (or Tunnel) in front; block public `/metrics`
- [ ] Backup SQLite before upgrades
- [ ] Add Prometheus/Grafana overlay only when you will look at dashboards
