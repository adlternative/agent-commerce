# AI Integration

Agents should start at **capability discovery**, then call HTTP or MCP — never scrape the React UI.

## Discovery

```http
GET /.well-known/ai-commerce.json
```

Document includes:

- Bearer opaque tokens, API keys (`X-API-Key`), and HS256 JWT (`sub` + `role` + agent `scopes`)
- Three-role RBAC with agent scopes (`agent:customer` / `agent:merchant` — no implicit merchant power)
- Idempotency-Key convention
- Structured error shape + common `errorCodes`
- HTTP route lists (customer / merchant / agent)
- MCP tool catalog (17), resources (with completion), prompts, sampling, error mapping
- Rate-limit algorithm (`token_bucket`) and audit query API

## Conventions

1. **Money** — integer cents only.  
2. **Idempotency-Key** — required on every write; same key + same payload replays; same key + different payload → `409 IDEMPOTENCY_KEY_REUSE`.  
3. **Errors** — `{ code, message, hint?, retryable }`. Respect `retryable` (e.g. `RATE_LIMITED`).  
4. **Pagination** — `cursor` + `limit` → `{ items, nextCursor, hasMore }`.  
5. **Audit** — `GET /api/agent/audit` (or `/api/merchant/audit`) with filters: `actor`, `role`, `method`, `pathPrefix`, `pathContains`, `status`, `code`, `traceId`, `since`, `until`, `limit`. Requires `agent:merchant` (or merchant role).  
6. **Rate limit** — per `role:subject` token bucket; `429` + `RATE_LIMITED` + `Retry-After` when exhausted.  
7. **Tracing** — send or read `X-Trace-Id` on every call; scrape `GET /metrics` for request counters.  
8. **Auth** — prefer API key or short-lived JWT for agents; include `scopes: ["agent:customer"]` and/or `["agent:merchant"]`. Demo `agent-token` is shopping-only; use `agent-merchant-token` for merchant surfaces.

## Suggested agent flows

**Shopper** (`agent:customer` / `agent-token`)

1. `search_products` / `GET /api/agent/products?q=` — each list item includes integer **`available`** (sellable = onHand − reserved). Skip SKUs with `available: 0`.  
2. Optional `check_inventory` for full `{ onHand, reserved, available }` detail.  
3. `create_cart` → `add_cart_item` → optional `apply_promotion` → `quote_cart`  
4. `place_order` → (HTTP) pay → `get_order`

Sellable rule: prefer list-field `available > 0`. Blind add-to-cart when stock is exhausted returns **`409 INSUFFICIENT_STOCK`** (do not retry without lowering qty or picking another SKU).

**Merchant** (`agent:merchant` / `agent-merchant-token` or `merchant-token`)

1. `upsert_product` / `adjust_stock`  
2. `list_orders` → ship/deliver via merchant HTTP  
3. Inspect `GET /api/merchant/metrics`

## MCP

See [MCP.md](./MCP.md) for paste-ready Cursor config (`npm run mcp`).

## OpenAPI

Machine-readable HTTP contract: [openapi.json](./openapi.json). CI fails if the committed file drifts from `buildOpenApi()`.
