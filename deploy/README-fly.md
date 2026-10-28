# Fly.io zero-to-live (single SQLite instance)

Preconditions: [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/) installed and logged in (`fly auth login`). Run from the **repo root**. This path is free-tier capable; no paid domain required (use the `*.fly.dev` hostname).

**SQLite red line:** this app is **one writer**. `deploy/fly.toml` sets `min_machines_running = 1` and must not be scaled to multiple machines sharing one volume.

## 1. Launch (no deploy yet)

```bash
fly launch --no-deploy --copy-config --config deploy/fly.toml
```

Edit the generated `app` name if the default is taken. Do **not** set `JWT_SECRET` in the toml.

## 2. Persistent volume

```bash
fly volumes create ac_data --size 1 --region iad --config deploy/fly.toml
```

Name `ac_data` must match `[mounts].source` in `deploy/fly.toml` (mounted at `/app/data` → `DATA_DIR`).

## 3. Secrets (never commit)

```bash
fly secrets set JWT_SECRET="$(openssl rand -hex 32)" --config deploy/fly.toml
# Keep ALLOW_DEMO_TOKENS=0 (toml default). Do not enable demo tokens on a public app.
```

## 4. Deploy

```bash
fly deploy --config deploy/fly.toml
```

## 5. Verify

Replace `APP` with your Fly app name (from `fly status` / `fly.toml`):

```bash
curl -sS "https://APP.fly.dev/healthz"
curl -sS "https://APP.fly.dev/openapi.json" | head -c 120; echo
curl -sS "https://APP.fly.dev/.well-known/ai-commerce.json" | head -c 120; echo
```

Expect `/healthz` → JSON with `ok: true`. OpenAPI and discovery documents should return 200.

## MCP Streamable HTTP — not public by default

The Fly service exposes only the HTTP API (+ baked SPA via `STATIC_DIR=/app/dist`) on internal port **8787**. **MCP Streamable HTTP** (`MCP_HTTP_PORT`, default **8790**, `npm run mcp:http`) is a **separate process** and is **not** started by this Fly config.

To expose MCP over HTTP if you need it:

1. Run MCP as a **second Fly app** (or second process/service) listening on 8790 — do **not** share the SQLite volume with a second writer on the API app.
2. Put a separate hostname / Fly service in front with **its own auth** (app already requires Bearer JWT/API key on MCP HTTP; still terminate TLS and rate-limit at the edge).
3. Prefer private networking between API data plane and MCP, or run MCP stdio locally against a remote API rather than publishing MCP publicly.

See also VPS path: optional `mcp.{$DOMAIN}` in `deploy/Caddyfile` + [RUNBOOK.md](../docs/architecture/RUNBOOK.md).

## Ops pointers

- Logs: `fly logs --config deploy/fly.toml`
- SSH: `fly ssh console --config deploy/fly.toml`
- Rollback: `fly releases --config deploy/fly.toml` then `fly deploy --image <previous>`
- Backup: copy `/app/data/commerce.sqlite` via SSH or volume snapshot; scripts under `deploy/backup.sh` target Docker Compose volumes (adapt paths for Fly SSH).
