# Positioning — Agent Commerce

Claims below cite paths in this repo. Anything not implemented is marked **尚未实现**.

## What it is

**Agent Commerce** is a single-process, open-source commerce stack where **customers**, **merchants**, and **AI agents** share one domain model (`src/services/commerce.ts`) and talk through three surfaces:

| Surface | Entry | Code |
|---------|-------|------|
| HTTP API (+ optional SPA static) | `npm run server` → `:8787` | `src/server/` · contract `docs/openapi.json` |
| Customer / merchant UI | `npm run dev` → `#/` · `#/merchant` | `src/App.tsx` · `src/merchant/MerchantApp.tsx` |
| MCP (stdio + Streamable HTTP) | `npm run mcp` / `mcp:http` | `src/mcp/` — **17 tools** (`src/mcp/tools.ts` + `recommend_products` in `src/mcp/create-mcp-server.ts`) |

Agent discovery document: `GET /.well-known/ai-commerce.json` (`src/ai/well-known.ts`).

Hard conventions enforced in code:

- Money = **integer cents** (`src/domain/money.ts`)
- Writes need **`Idempotency-Key`** (`src/domain/idempotency.ts`)
- Errors = `{ code, message, hint?, retryable }` (`src/domain/errors.ts`)
- Cursor pagination (`src/ai/pagination.ts`)
- Three roles + agent scopes (`src/server/auth.ts`: `customer` / `merchant` / `agent` + `agent:customer` / `agent:merchant`)
- Audit query API (`src/ai/audit.ts` → `GET /api/agent/audit`, `GET /api/merchant/audit`)

## Who it is for

### Customer (human shopper)

- Browse / cart / place / pay / receive / request return via UI or `/api/customer/*` (`docs/API.md`, `src/server/routes.ts`).
- Demo opaque Bearer `customer-token` only when demos are enabled (`src/server/auth.ts` `DEMO_TOKENS` + `demoCredentialsEnabled`).

### Merchant (human operator)

- Catalog, stock deltas, promotions, ship / deliver, return approve/reject via `#/merchant` and `/api/merchant/*`.
- Metrics at `GET /api/merchant/metrics`.
- Auth: `merchant` role or `agent:merchant` scope — bare `agent` grants nothing (`src/server/auth.ts`).

### AI agent

- Prefer MCP tools or `/api/agent/*` after reading `/.well-known/ai-commerce.json`.
- Shopping needs `agent:customer`; merchant-ops / audit need `agent:merchant` (`src/ai/well-known.ts` `conventions.rbac`).
- Catalog fields include `agentNotes` and list `available` for sellable checks (`src/domain/product.ts`, `src/domain/search.ts`).

## What it deliberately is NOT

| Not this | Why (code fact or gap) |
|----------|-------------------------|
| A hosted multi-tenant SaaS | Single SQLite/JSON store per process (`src/repo/`); **no tenant id** anywhere — **尚未实现** multi-tenant isolation. |
| A real payment processor | `POST /api/webhooks/payment` is an **in-process simulated** provider callback (`src/domain/payment.ts`, `CommerceService.handlePaymentWebhook`) — **尚未实现** Stripe/Alipay/WeChat Pay rails, card vaults, or settlement. |
| A CDN / edge storefront | Static files served from the same Node process (`src/server/static.ts`) — **尚未实现** CDN, image pipeline, or edge cache. |
| A fraud / risk platform | No device fingerprint, chargeback, or abuse scoring modules — **尚未实现**. |
| An HTML-scraping target for agents | Agents should use OpenAPI / MCP / well-known — not the React DOM (`docs/AI-INTEGRATION.md`). |
| A full marketplace | One merchant subject in the demo model; no multi-seller fees, payouts, or storefront themes — **尚未实现**. |

## One-line summary

Runnable **AI-native commerce reference**: integer-cents domain + idempotent HTTP + MCP 17 tools + three-role RBAC — self-hostable, inspectable, and honest about production gaps.
