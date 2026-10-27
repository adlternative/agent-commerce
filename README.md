# Agent Commerce

**30 seconds:** Open-source commerce where **customers**, **merchants**, and **AI agents** share one domain — HTTP + MCP (17 tools) + UI. Integer cents, `Idempotency-Key`, structured errors, three-role RBAC. Not a hosted SaaS and not a real payment processor (see [docs/product/POSITIONING.md](docs/product/POSITIONING.md)).

## 60-second run

```bash
npm ci
JWT_SECRET=dev-only-change-me npm run server   # API + static SPA → :8787
# other terminal
npm run dev                                    # Vite UI → :5173 (#/ customer, #/merchant)
```

Smoke:

```bash
curl -sS http://127.0.0.1:8787/healthz
curl -sS http://127.0.0.1:8787/.well-known/ai-commerce.json | head -c 120; echo
```

Docker (requires a strong secret; compose refuses unset `JWT_SECRET`; runtime image has **no apt/tini** — compose uses `init: true`):

```bash
export JWT_SECRET="$(openssl rand -hex 32)"
docker compose up --build -d
curl -sS http://127.0.0.1:8787/healthz
```

MCP for agents:

```bash
JWT_SECRET=dev-only-change-me npm run mcp          # stdio
# or: MCP_HTTP_PORT=8790 ALLOW_DEMO_TOKENS=1 npm run mcp:http
```

Demo Bearer tokens (`customer-token` / `merchant-token` / `agent-token` / `agent-merchant-token`) only when `ALLOW_DEMO_TOKENS=1` or non-production — see `src/server/auth.ts`. Default Playwright E2E uses per-worker `DATA_DIR` (SQLite; `/healthz` → `store: "sqlite"`); JSON legacy is a separate config.

## Docs

Static site (VitePress): `npm run docs:dev` → `http://localhost:5173/agent-commerce/` · `npm run docs:build`

| Doc | What |
|-----|------|
| [docs/index.md](docs/index.md) | Getting Started (docs site home) |
| [docs/product/POSITIONING.md](docs/product/POSITIONING.md) | What it is / who / what it is **not** |
| [docs/product/WHY-OPEN.md](docs/product/WHY-OPEN.md) | Open vs closed SaaS — code-cited |
| [docs/product/COMPARISON.md](docs/product/COMPARISON.md) | vs closed SaaS vs greenfield (+ honest gaps) |
| [docs/product/INTEGRATION.md](docs/product/INTEGRATION.md) | REST · MCP · merchant webhooks (runnable) |
| [docs/reference/api.generated.md](docs/reference/api.generated.md) | API ref (**from** `openapi.json`) |
| [docs/reference/mcp-tools.generated.md](docs/reference/mcp-tools.generated.md) | MCP tools (**from** code) |
| [docs/engineering/adr/README.md](docs/engineering/adr/README.md) | ADRs |
| [docs/deploy.md](docs/deploy.md) | GitHub Pages / Cloudflare Pages (free) |
| [docs/API.md](docs/API.md) · [docs/openapi.json](docs/openapi.json) | HTTP contract |
| [docs/MCP.md](docs/MCP.md) | Tools / resources / prompts |
| [docs/AI-INTEGRATION.md](docs/AI-INTEGRATION.md) | Discovery, pagination, audit, rate limit |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layering & storage |
| [docs/engineering/adr/0008-pwa-first-mobile.md](docs/engineering/adr/0008-pwa-first-mobile.md) | PWA-first mobile (defer Expo/RN); push/native **尚未实现** |

Installable PWA: `public/manifest.webmanifest` + `public/sw.js` + icons; offline shell at `/offline.html`. Customer UI remains the Vite React SPA (Add to Home Screen; no app store).

## Develop

| Command | Role |
|---------|------|
| `npm test` | Vitest + Playwright (SQLite e2e + JSON legacy) |
| `npm run typecheck` / `build` / `build:server` | Frontend + `dist-server/` |
| `npm run openapi:check` | OpenAPI drift gate |
| `npm run test:mcp:http` | Streamable HTTP real-client smoke |
| `npm run docs:gen` | Regenerate `docs/reference/*.generated.md` |
| `npm run docs:dev` / `docs:build` | VitePress preview / static build |
| `npm run docs:check` | Assert generated refs match OpenAPI + MCP code |

Stack: TypeScript strict · Node 22 · zod · Vitest · React 18 · Vite · VitePress · `@modelcontextprotocol/sdk` · `node:sqlite`.
