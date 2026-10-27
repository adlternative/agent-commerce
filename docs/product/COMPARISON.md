# Comparison — open Agent Commerce vs closed SaaS vs greenfield

Facts cite this repo. Gaps marked **尚未实现**.

## Summary table

| Dimension | This repo (open) | Typical closed commerce SaaS | Greenfield (build from scratch) |
|-----------|------------------|------------------------------|----------------------------------|
| Domain model | One `CommerceService` (`src/services/commerce.ts`) for UI + HTTP + MCP | Often split Admin API / Storefront API / “AI beta” with different semantics | You own everything; months before cart↔inventory consistency |
| Agent surface | MCP 17 tools (`src/mcp/tools.ts` + sampling) + `/api/agent/*` | Proprietary plugin / ChatGPT Action / no MCP | Must invent tools, errors, discovery |
| Discovery | `/.well-known/ai-commerce.json` (`src/ai/well-known.ts`) | Portal docs + private keys | None until you design it |
| Money | Integer cents only (`src/domain/money.ts`) | Mixed float / decimal strings | Easy to get wrong early |
| Idempotency | Required `Idempotency-Key` (`src/domain/idempotency.ts`) | Vendor-specific or missing on some writes | Usually bolted on after double-charges |
| Errors | `{ code, message, hint?, retryable }` (`src/domain/errors.ts`) | HTML error pages or untyped JSON | Ad hoc |
| Pagination | Cursor + stable keyset search (`src/ai/pagination.ts`) | Often offset-only | Often offset-only |
| Auth / RBAC | 3 roles + agent scopes (`src/server/auth.ts`) | Rich but closed; agent scope rarely first-class | Easy to ship “one key” |
| Audit | Queryable in-memory ring + HTTP filters (`src/ai/audit.ts`) | Admin UI only | Deferred |
| Persistence | SQLite (`node:sqlite`) + JSON migrate (`src/repo/`) | Managed cloud DB | You pick stack |
| Payments | Simulated webhook (`POST /api/webhooks/payment`) | Real card/APM rails | Integrate PSP yourself |
| Multi-tenant | Single store per process | Core product | Design tenancy first |
| CDN / media | Same-process static (`src/server/static.ts`) | Global CDN | Later |
| Fraud / risk | None | Often bundled SKUs | Separate vendor |
| Self-host / fork | Yes (this GitHub repo) | Contract + egress fees | Full ownership cost |
| Time to first agent cart | Minutes (`npm run mcp` / Docker) | Days of partner onboarding | Weeks+ |

## When to choose which

| Choose | If |
|--------|----|
| **This repo** | You need a **reference / self-hosted** agent commerce loop with inspectable MCP + OpenAPI, and can accept simulated payments + single-tenant SQLite. |
| **Closed SaaS** | You need **real settlement, PCI, multi-store, CDN, fraud** tomorrow and will accept opaque agent APIs. |
| **Greenfield** | Your domain diverges hard (marketplace fees, B2B RFQ, custom ledger) and you will re-implement conventions anyway. |

## Honest gaps in *this* open stack

| Gap | Status | Evidence |
|-----|--------|----------|
| Real payment rails (Stripe / Alipay / WeChat Pay / cards) | **尚未实现** | Only domain + webhook simulation: `src/domain/payment.ts`, `CommerceService.handlePaymentWebhook` |
| Multi-tenant / org isolation | **尚未实现** | No tenant field in schemas; one `DATA_DIR` SQLite |
| CDN / image CDN / edge cache | **尚未实现** | `Dockerfile` + `src/server/static.ts` serve local `dist/` |
| Fraud / bot / chargeback scoring | **尚未实现** | No matching modules under `src/` |
| Horizontal HA / managed replicas | **尚未实现** | Single Node process; SQLite file |
| MCP pay / ship / approve-return tools | **尚未实现** as MCP tools | Pay/ship via HTTP (`docs/API.md`); MCP stops shopping at `place_order` (+ `request_return`) in `src/mcp/tools.ts` |
| Durable audit beyond process memory | Partial | `AuditLog` is an in-memory ring (`src/ai/audit.ts` max 1000) — not a durable warehouse (**尚未实现** persistent audit store) |

## Migration posture

Forking this stack is a **protocol + domain head start**, not a drop-in replacement for Shopify/Stripe. Wire a real PSP into `handlePaymentWebhook`’s event shape, or replace the webhook path — the idempotent eventId contract is already there (`PaymentWebhookEventSchema` in `src/domain/payment.ts`).
