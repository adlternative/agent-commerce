# AI Integration

Agents should start at **capability discovery**, then call HTTP or MCP — never scrape the React UI.

## Discovery

```http
GET /.well-known/ai-commerce.json
```

Document includes:

- Bearer token roles
- Idempotency-Key convention
- Structured error shape + common `errorCodes`
- HTTP route lists (customer / merchant / agent)
- MCP tool catalog (16), resources, prompts
- Rate-limit algorithm (`token_bucket`) and audit path

## Conventions

1. **Money** — integer cents only.  
2. **Idempotency-Key** — required on every write; same key + same payload replays; same key + different payload → `409 IDEMPOTENCY_KEY_REUSE`.  
3. **Errors** — `{ code, message, hint?, retryable }`. Respect `retryable` (e.g. `RATE_LIMITED`).  
4. **Pagination** — `cursor` + `limit` → `{ items, nextCursor, hasMore }`.  
5. **Audit** — `GET /api/agent/audit` for recent requests (method, path, status, duration, idempotency key, `traceId`).  
6. **Rate limit** — per `role:subject` token bucket; `429` + `RATE_LIMITED` when exhausted.  
7. **Tracing** — send or read `X-Trace-Id` on every call; scrape `GET /metrics` for request counters.

## Suggested agent flows

**Shopper**

1. `search_products` / `GET /api/agent/products?q=`  
2. `check_inventory`  
3. `create_cart` → `add_cart_item` → optional `apply_promotion` → `quote_cart`  
4. `place_order` → (HTTP) pay → `get_order`

**Merchant**

1. `upsert_product` / `adjust_stock`  
2. `list_orders` → ship/deliver via merchant HTTP  
3. Inspect `GET /api/merchant/metrics`

## MCP

See [MCP.md](./MCP.md) for paste-ready Cursor config (`npm run mcp`).

## OpenAPI

Machine-readable HTTP contract: [openapi.json](./openapi.json). CI fails if the committed file drifts from `buildOpenApi()`.
