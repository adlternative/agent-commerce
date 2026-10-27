# Why open-source agent commerce (code facts only)

Each open capability maps to a **closed-SaaS pain** agents hit when the catalog, cart, and order APIs are proprietary black boxes. Citations are paths in this repo.

## Capability → closed-SaaS pain

| Open fact in this repo | Closed SaaS pain it removes |
|------------------------|-----------------------------|
| **MCP ~17 tools** — 16 in `ToolSchemas` / `TOOL_DESCRIPTIONS` (`src/mcp/tools.ts`) + `recommend_products` (`src/mcp/create-mcp-server.ts`); stdio `src/mcp/stdio.ts`, Streamable HTTP `src/mcp/http.ts` | Agents scrape HTML or maintain brittle private “assistant” plugins; tool schemas are not portable across hosts (Cursor / Claude Desktop / custom MCP clients). |
| **`GET /.well-known/ai-commerce.json`** (`src/ai/well-known.ts`, served from routes) | No machine-readable capability discovery; every vendor invents a different “AI plugin” manifest or hides auth examples behind a dashboard. |
| **Structured errors `{ code, message, hint?, retryable }`** (`src/domain/errors.ts` `ErrorBodySchema`; MCP adds `mcpErrorCode` in `src/mcp/errors.ts`) | Agents retry forever on untyped 4xx/5xx strings; no `retryable` bit for rate limits vs hard domain failures. |
| **`Idempotency-Key` on writes** (`src/domain/idempotency.ts` `requireIdempotencyKey` / `resolveIdempotency`; enforced on HTTP writes) | LLM tool loops double-submit carts/orders; closed APIs either lack keys or return opaque conflicts without replay semantics. |
| **Cursor pagination** (`src/ai/pagination.ts` — offset cursors + stable score/id keyset for ranked search; product lists always `{ items, nextCursor, hasMore }` — see `docs/API.md`, ACP-16) | Offset pages skip/duplicate under concurrent catalog edits; agents cannot resume a ranked search safely. |
| **Integer cents only** (`src/domain/money.ts` `CentsSchema`; discovery `money.unit: "cents"`) | Float prices cause rounding bugs in quotes/refunds; agents invent currency math from scraped `$12.99` strings. |
| **`agentNotes` as a first-class catalog field** (`src/domain/product.ts`; search weight in `src/domain/search.ts` `WEIGHTS.agentNotes`) | Merchants bury LLM context in description HTML; ranking and tool outputs ignore selling-point text agents actually need. |
| **RBAC: 3 roles** `customer` / `merchant` / `agent` + explicit `agent:customer` / `agent:merchant` scopes (`src/server/auth.ts` `ROLES`, `AGENT_SCOPES`; well-known `conventions.rbac`) | Single “API key = god mode” or implicit admin for every bot; agents overreach into merchant mutations. |
| **Audit log query API** (`src/ai/audit.ts` `AuditLog`; `GET /api/agent/audit`, `GET /api/merchant/audit` in `src/server/routes.ts`) | No filterable actor/path/status/code/trace trail for debugging agent sessions; support tickets replace observability. |

## What “open” means here (not marketing)

- **Same domain for UI, REST, and MCP** — `CommerceService` (`src/services/commerce.ts`) is the single write path; transports do not fork business rules.
- **Contract regression** — OpenAPI 3.1 is generated and checked (`docs/openapi.json`, `npm run openapi:check`).
- **Fail-closed auth defaults** — production refuses missing `JWT_SECRET`; demo tokens gated (`src/server/auth.ts` `resolveJwtSecret`, `demoCredentialsEnabled`).

## Honest limits (do not claim these as solved)

| Gap | Label |
|-----|-------|
| Real PSP / card rails | **尚未实现** — only simulated `POST /api/webhooks/payment` (`src/domain/payment.ts`) |
| Multi-tenant SaaS tenancy | **尚未实现** |
| CDN, fraud scoring, chargebacks | **尚未实现** |
| MCP tools past `place_order` for pay/ship | Pay / ship / approve-return are **HTTP / UI** today; MCP has `request_return` but not merchant approve — see `src/mcp/tools.ts` |

Open source wins when agents need **inspectable contracts and retry semantics**. It does not magically replace payments, tenancy, or edge delivery — those remain **尚未实现**.
